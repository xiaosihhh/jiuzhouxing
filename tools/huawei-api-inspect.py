from __future__ import annotations

import argparse
import hashlib
import hmac
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def sha256_hex(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def hmac_sha256(key: bytes, value: str) -> str:
    return hmac.new(key, value.encode("utf-8"), hashlib.sha256).hexdigest()


def signed_get(
    *,
    host: str,
    path: str,
    canonical_path: str | None = None,
    query: dict[str, str],
    access_key: str,
    secret_key: str,
) -> dict:
    canonical_query = "&".join(
        f"{quote(key, safe='~')}={quote(value, safe='~')}"
        for key, value in sorted(query.items())
    )
    sdk_date = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    canonical_headers = f"host:{host}\nx-sdk-date:{sdk_date}\n"
    signed_headers = "host;x-sdk-date"
    canonical_request = "\n".join(
        [
            "GET",
            canonical_path or path,
            canonical_query,
            canonical_headers,
            signed_headers,
            sha256_hex(b""),
        ]
    )
    string_to_sign = "\n".join(
        [
            "SDK-HMAC-SHA256",
            sdk_date,
            sha256_hex(canonical_request.encode("utf-8")),
        ]
    )
    signature = hmac_sha256(secret_key.encode("utf-8"), string_to_sign)
    url = f"https://{host}{path}"
    if canonical_query:
        url = f"{url}?{canonical_query}"
    request = Request(
        url,
        headers={
            "Host": host,
            "X-Sdk-Date": sdk_date,
            "Authorization": (
                "SDK-HMAC-SHA256 "
                f"Access={access_key}, SignedHeaders={signed_headers}, "
                f"Signature={signature}"
            ),
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {detail}") from error


def summarize_instances(payload: dict, names: tuple[str, ...]) -> list[dict]:
    for key in names:
        value = payload.get(key)
        if isinstance(value, list):
            return value
    return []


def main() -> None:
    parser = argparse.ArgumentParser(description="Read-only Huawei Cloud resource inspection")
    parser.add_argument("service", choices=("dcs", "rds", "ecs", "elb"))
    parser.add_argument("--region", default="cn-north-4")
    args = parser.parse_args()

    env = read_env(ROOT / ".env")
    network = json.loads(
        (ROOT / "data" / "huawei-network.json").read_text(encoding="utf-8")
    )
    access_key = env.get("OBS_ACCESS_KEY", "")
    secret_key = env.get("OBS_SECRET_KEY", "")
    project_id = network["projectId"]
    if not access_key or not secret_key:
        raise SystemExit("OBS_ACCESS_KEY and OBS_SECRET_KEY are required")

    if args.service == "dcs":
        host = f"dcs.{args.region}.myhuaweicloud.com"
        path = f"/v2/{project_id}/instances"
        canonical_path = f"{path}/"
        query = {"limit": "100", "offset": "0"}
        keys = ("instances",)
    elif args.service == "rds":
        host = f"rds.{args.region}.myhuaweicloud.com"
        path = f"/v3/{project_id}/instances"
        canonical_path = f"{path}/"
        query = {"limit": "100", "offset": "0"}
        keys = ("instances",)
    elif args.service == "ecs":
        host = f"ecs.{args.region}.myhuaweicloud.com"
        path = f"/v1/{project_id}/cloudservers/detail"
        canonical_path = f"{path}/"
        query = {}
        keys = ("servers",)
    else:
        host = f"elb.{args.region}.myhuaweicloud.com"
        path = f"/v3/{project_id}/elb/loadbalancers"
        canonical_path = f"{path}/"
        query = {"limit": "100"}
        keys = ("loadbalancers",)

    payload = signed_get(
        host=host,
        path=path,
        canonical_path=canonical_path,
        query=query,
        access_key=access_key,
        secret_key=secret_key,
    )
    instances = summarize_instances(payload, keys)
    output = {
        "service": args.service,
        "region": args.region,
        "count": len(instances),
        "instances": instances,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
