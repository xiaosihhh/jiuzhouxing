from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
env_path = ROOT / ".env"
network = json.loads((ROOT / "data" / "huawei-network.json").read_text(encoding="utf-8"))
provisioning = json.loads((ROOT / "data" / "huawei-provisioning.json").read_text(encoding="utf-8"))

rds_host = provisioning["eips"]["jzx-rds-eip"]["address"]
rds_url = (
    f"mysql://root:{quote(provisioning['password'], safe='')}@"
    f"{rds_host}:3306/jiuzhou?charset=utf8mb4"
)
redis_host = network["redisIp"]
redis_url = (
    f"redis://:{quote(provisioning['redis']['password'], safe='')}@"
    f"{redis_host}:6379/0"
)

updates = {
    "DATABASE_URL": rds_url,
    "REDIS_URL": redis_url,
}

lines = env_path.read_text(encoding="utf-8").splitlines() if env_path.exists() else []
seen = set()
result = []
for line in lines:
    key = line.split("=", 1)[0].strip() if "=" in line and not line.lstrip().startswith("#") else ""
    if key in updates:
        result.append(f"{key}={updates[key]}")
        seen.add(key)
    else:
        result.append(line)
for key, value in updates.items():
    if key not in seen:
        result.append(f"{key}={value}")

env_path.write_text("\n".join(result).rstrip() + "\n", encoding="utf-8")
print("HUAWEI_ENV_SYNCED")
