from __future__ import annotations

import argparse
import json
from pathlib import Path

from huaweicloudsdkcore.auth.credentials import BasicCredentials
from huaweicloudsdkecs.v2 import EcsClient, ListFlavorsRequest as EcsListFlavorsRequest
from huaweicloudsdkecs.v2.region.ecs_region import EcsRegion
from huaweicloudsdkeip.v2 import EipClient, ListPublicipsRequest
from huaweicloudsdkeip.v2.region.eip_region import EipRegion
from huaweicloudsdkelb.v3 import (
    ElbClient,
    ListFlavorsRequest as ElbListFlavorsRequest,
    ListLoadBalancersRequest,
)
from huaweicloudsdkelb.v3.region.elb_region import ElbRegion
from huaweicloudsdkims.v2 import ImsClient, ListImagesRequest as ImsListImagesRequest
from huaweicloudsdkims.v2.region.ims_region import ImsRegion
from huaweicloudsdkvpc.v2 import ListSecurityGroupRulesRequest, VpcClient
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


def print_json(value: object) -> None:
    if hasattr(value, "to_dict"):
        value = value.to_dict()
    print(json.dumps(value, ensure_ascii=False, indent=2, default=str))


def main() -> None:
    parser = argparse.ArgumentParser(description="Read-only Huawei Cloud SDK inspection")
    parser.add_argument(
        "command",
        choices=(
            "elb-flavors",
            "elb-list",
            "ecs-flavors",
            "ims-images",
            "vpc-eips",
            "vpc-sg-rules",
        ),
    )
    parser.add_argument("--region", default="cn-north-4")
    parser.add_argument("--max-vcpus", type=int, default=0)
    parser.add_argument("--max-ram-mb", type=int, default=0)
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

    if args.command.startswith("elb"):
        client = (
            ElbClient.new_builder()
            .with_credentials(credentials)
            .with_region(ElbRegion.value_of(args.region))
            .build()
        )
        if args.command == "elb-list":
            result = client.list_load_balancers(ListLoadBalancersRequest(limit=100))
        else:
            result = client.list_flavors(ElbListFlavorsRequest())
    elif args.command == "ecs-flavors":
        client = (
            EcsClient.new_builder()
            .with_credentials(credentials)
            .with_region(EcsRegion.value_of(args.region))
            .build()
        )
        result = client.list_flavors(
            EcsListFlavorsRequest(
                availability_zone=network["availabilityZone"],
                limit=1000,
            )
        )
    elif args.command == "ims-images":
        client = (
            ImsClient.new_builder()
            .with_credentials(credentials)
            .with_region(ImsRegion.value_of(args.region))
            .build()
        )
        result = client.list_images(
            ImsListImagesRequest(
                imagetype="gold",
                os_type="Linux",
                status="active",
                limit=1000,
            )
        )
    elif args.command == "vpc-eips":
        client = (
            EipClient.new_builder()
            .with_credentials(credentials)
            .with_region(EipRegion.value_of(args.region))
            .build()
        )
        result = client.list_publicips(ListPublicipsRequest(limit=100))
    else:
        client = (
            VpcClient.new_builder()
            .with_credentials(credentials)
            .with_region(VpcRegion.value_of(args.region))
            .build()
        )
        result = client.list_security_group_rules(
            ListSecurityGroupRulesRequest(
                security_group_id=network["securityGroupId"],
                limit=100,
            )
        )

    if hasattr(result, "to_dict"):
        result = result.to_dict()
    if args.command == "ecs-flavors":
        flavors = result.get("flavors", [])
        if args.max_vcpus:
            flavors = [item for item in flavors if int(item.get("vcpus", 0)) <= args.max_vcpus]
        if args.max_ram_mb:
            flavors = [item for item in flavors if int(item.get("ram", 0)) <= args.max_ram_mb]
        flavors.sort(key=lambda item: (int(item.get("vcpus", 0)), int(item.get("ram", 0)), item["name"]))
        result = {
            "count": len(flavors),
            "flavors": [
                {
                    "name": item["name"],
                    "vcpus": item["vcpus"],
                    "ram": item["ram"],
                    "status": item.get("os_extra_specs", {}).get("condoperationstatus"),
                    "az": item.get("os_extra_specs", {}).get("condoperationaz"),
                }
                for item in flavors
            ],
        }
    elif args.command == "ims-images":
        images = result.get("images", [])
        keywords = ("ubuntu", "euler", "debian", "centos")
        images = [
            item
            for item in images
            if any(keyword in item.get("name", "").lower() for keyword in keywords)
        ]
        images.sort(key=lambda item: item.get("name", ""))
        result = {
            "count": len(images),
            "images": [
                {
                    "id": item["id"],
                    "name": item["name"],
                    "min_disk": item.get("min_disk"),
                    "min_ram": item.get("min_ram"),
                    "architecture": item.get("architecture"),
                }
                for item in images
            ],
        }
    elif args.command == "vpc-eips":
        publicips = result.get("publicips", [])
        result = {
            "count": len(publicips),
            "publicips": [
                {
                    "id": item["id"],
                    "address": item.get("public_ip_address"),
                    "status": item.get("status"),
                    "port_id": item.get("port_id"),
                    "type": item.get("type"),
                    "bandwidth": item.get("bandwidth"),
                }
                for item in publicips
            ],
        }
    elif args.command == "vpc-sg-rules":
        rules = result.get("security_group_rules", [])
        result = {
            "count": len(rules),
            "rules": [
                {
                    "id": item["id"],
                    "direction": item.get("direction"),
                    "ethertype": item.get("ethertype"),
                    "protocol": item.get("protocol"),
                    "port_range_min": item.get("port_range_min"),
                    "port_range_max": item.get("port_range_max"),
                    "remote_ip_prefix": item.get("remote_ip_prefix"),
                    "remote_group_id": item.get("remote_group_id"),
                }
                for item in rules
            ],
        }
    print_json(result)


if __name__ == "__main__":
    main()
