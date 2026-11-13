#!/usr/bin/env python3
"""Rank JZX city candidates from the bundled catalog."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "assets" / "city-catalog.json"


def main(message: str):
    cities = json.loads(CATALOG.read_text("utf-8"))
    budget_match = re.search(r"(?:预算)?\s*(\d+)\s*(万|千)?\s*元?", message)
    budget = 5000
    if budget_match:
        multiplier = 10000 if budget_match.group(2) == "万" else 1000 if budget_match.group(2) == "千" else 1
        budget = max(1000, min(10000, int(budget_match.group(1)) * multiplier))
    ranked = sorted(
        cities,
        key=lambda item: (
            item["price"] <= budget,
            item.get("rating", 0),
            item.get("popular", False),
            -abs(item["price"] - budget),
        ),
        reverse=True,
    )
    print(json.dumps({"budget": budget, "candidates": ranked[:5]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    import sys
    main(" ".join(sys.argv[1:]))
