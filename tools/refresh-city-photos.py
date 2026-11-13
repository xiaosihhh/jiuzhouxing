"""Refresh the city gallery with compressed, locally hosted travel photos.

This is a maintenance script, not a runtime dependency. Search results are
recorded in photo-sources.json so the source of every image remains traceable.
Use only images whose license has been reviewed before a public release.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import html
import io
import json
import re
import shutil
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
CITY_DIR = ROOT / "assets" / "cities"
MANIFEST = CITY_DIR / "manifest.json"
SOURCES = CITY_DIR / "photo-sources.json"
BACKUP_DIR = CITY_DIR / "legacy"
USER_AGENT = "JiuzhouxingDemo/2.0 (competition prototype; image refresh)"
MAX_DOWNLOAD = 18 * 1024 * 1024


def bing_candidates(query: str) -> list[tuple[str, str]]:
    url = "https://www.bing.com/images/search?" + urllib.parse.urlencode(
        {"q": query, "form": "HDRSC2", "first": "1"}
    )
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=25) as response:
        page = response.read().decode("utf-8", "replace")

    results: list[tuple[str, str]] = []
    for match in re.finditer(r"m=\"(\{.*?\})\"", page):
        try:
            meta = json.loads(html.unescape(match.group(1)))
        except json.JSONDecodeError:
            continue
        image_url = str(meta.get("murl") or "")
        page_url = str(meta.get("purl") or url)
        if image_url:
            results.append((image_url, page_url))

    # Bing occasionally emits escaped data outside the structured m attribute.
    if not results:
        for image_url in re.findall(r"murl&quot;:&quot;(.*?)&quot;", page):
            results.append((html.unescape(image_url), url))
    return results


def score_candidate(image_url: str) -> int:
    host = urllib.parse.urlparse(image_url).netloc.lower()
    score = 0
    if host.endswith("upload.wikimedia.org"):
        score += 100
    if host.endswith("cdn.pixabay.com"):
        score += 80
    if host.endswith("images.unsplash.com"):
        score += 80
    if any(part in host for part in ("visit", "travel", "tourism", "gov.cn")):
        score += 35
    if image_url.startswith("http://"):
        score -= 20
    return score


def download_image(image_url: str) -> Image.Image:
    request = urllib.request.Request(
        image_url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        content_type = response.headers.get("content-type", "").lower()
        payload = response.read(MAX_DOWNLOAD + 1)
    if len(payload) > MAX_DOWNLOAD:
        raise ValueError("image exceeds download limit")
    if content_type and not content_type.startswith("image/"):
        raise ValueError(f"unexpected content type: {content_type}")
    image = Image.open(io.BytesIO(payload))
    image.load()
    if image.width < 640 or image.height < 360:
        raise ValueError(f"image is too small: {image.width}x{image.height}")
    if image.width / image.height < 1.15:
        raise ValueError("image is not landscape enough")
    return ImageOps.exif_transpose(image).convert("RGB")


def save_webp(image: Image.Image, destination: Path) -> None:
    fitted = ImageOps.fit(image, (1200, 760), method=Image.Resampling.LANCZOS)
    destination.parent.mkdir(parents=True, exist_ok=True)
    fitted.save(destination, "WEBP", quality=80, method=6)


def refresh_city(city: dict) -> dict:
    name = city["name"]
    file_name = city["file"]
    destination = CITY_DIR / file_name
    query = f"{name} 城市 景点 风景"
    candidates = bing_candidates(query)
    candidates.sort(key=lambda item: score_candidate(item[0]), reverse=True)

    errors: list[str] = []
    for image_url, source_page in candidates[:14]:
        try:
            image = download_image(image_url)
            save_webp(image, destination)
            backup = BACKUP_DIR / file_name
            if backup.exists() and not backup.is_file():
                raise ValueError("backup target is not a file")
            return {
                "city": name,
                "query": query,
                "imageUrl": image_url,
                "sourcePage": source_page,
                "license": "License not verified; review before public release",
                "retrieved": time.strftime("%Y-%m-%d"),
                "localFile": f"assets/cities/{file_name}",
                "realPhoto": True,
                "bytes": destination.stat().st_size,
            }
        except Exception as exc:  # Network sources fail independently.
            errors.append(f"{image_url}: {exc}")
    raise RuntimeError(f"{name}: no usable image; " + " | ".join(errors[-3:]))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if args.limit:
        manifest = manifest[: args.limit]

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    for city in manifest:
        source = CITY_DIR / city["file"]
        backup = BACKUP_DIR / city["file"]
        if source.exists() and not backup.exists():
            shutil.copy2(source, backup)

    records: list[dict] = []
    failures: list[str] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        future_map = {pool.submit(refresh_city, city): city for city in manifest}
        for future in concurrent.futures.as_completed(future_map):
            city = future_map[future]
            try:
                record = future.result()
                records.append(record)
                print(f"OK {city['name']} {record['bytes']} bytes", flush=True)
            except Exception as exc:
                failures.append(str(exc))
                print(f"FAIL {city['name']}: {exc}", flush=True)

    records.sort(key=lambda item: next(i for i, c in enumerate(manifest) if c["name"] == item["city"]))
    existing = []
    if SOURCES.exists():
        try:
            existing = json.loads(SOURCES.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = []
    refreshed_names = {item["city"] for item in records}
    combined = [item for item in existing if item.get("city") not in refreshed_names] + records
    SOURCES.write_text(json.dumps(combined, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    full_manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for city in full_manifest:
        if city["name"] in refreshed_names:
            city["realPhoto"] = True
            city["license"] = "License not verified; review before public release"
    MANIFEST.write_text(json.dumps(full_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    total = sum(item["bytes"] for item in records)
    print(f"UPDATED {len(records)}/{len(manifest)} images, {total / 1024 / 1024:.2f} MiB")
    if failures:
        print(f"FAILURES {len(failures)}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
