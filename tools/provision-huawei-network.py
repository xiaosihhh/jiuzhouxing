from __future__ import annotations

import argparse
import json
from pathlib import Path

from huaweicloudsdkcore.auth.credentials import BasicCredentials
from huaweicloudsdkvpc.v2 import (
    CreateSecurityGroupRuleOption,
    CreateSecurityGroupRuleRequest,
    CreateSecurityGroupRuleRequestBody,
    ListSecurityGroupRulesRequest,
    VpcClient,
)
from huaweicloudsdkvpc.v2.region.vpc_region import VpcRegion


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


def main() -> None:
    parser = argparse.ArgumentParser(description="Idempotent security-group setup")
    parser.add_argument("--ssh-source", required=True, help="Allowed SSH CIDR")
    args = parser.parse_args()

    env = read_env(ROOT / ".env")
    network = json.loads(
        (ROOT / "data" / "huawei-network.json").read_text(encoding="utf-8")
    )
    credentials = BasicCredentials(
        env["OBS_ACCESS_KEY"],
        env["OBS_SECRET_KEY"],
        network["projectId"],
    )
    client = (
        VpcClient.new_builder()
        .with_credentials(credentials)
        .with_region(VpcRegion.value_of(network["region"]))
        .build()
    )
    security_group_id = network["securityGroupId"]
    response = client.list_security_group_rules(
        ListSecurityGroupRulesRequest(
            security_group_id=security_group_id,
            limit=100,
        )
    )
    rules = response.security_group_rules or []

    wanted = (
        ("SSH from deployment host", "tcp", 22, 22, args.ssh_source),
        ("Public HTTPS entry", "tcp", 443, 443, "0.0.0.0/0"),
        ("Public HTTP entry", "tcp", 80, 80, "0.0.0.0/0"),
    )
    created: list[str] = []
    for description, protocol, port_min, port_max, remote in wanted:
        exists = any(
            rule.direction == "ingress"
            and rule.protocol == protocol
            and rule.port_range_min == port_min
            and rule.port_range_max == port_max
            and rule.remote_ip_prefix == remote
            for rule in rules
        )
        if exists:
            continue
        client.create_security_group_rule(
            CreateSecurityGroupRuleRequest(
                body=CreateSecurityGroupRuleRequestBody(
                    security_group_rule=CreateSecurityGroupRuleOption(
                        security_group_id=security_group_id,
                        description=description,
                        direction="ingress",
                        ethertype="IPv4",
                        protocol=protocol,
                        port_range_min=port_min,
                        port_range_max=port_max,
                        remote_ip_prefix=remote,
                    )
                )
            )
        )
        created.append(f"{protocol}:{port_min}/{remote}")

    print(
        json.dumps(
            {
                "security_group_id": security_group_id,
                "created": created,
                "unchanged": len(wanted) - len(created),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
