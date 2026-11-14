from __future__ import annotations

import json
from pathlib import Path

from huaweicloudsdkcore.auth.credentials import BasicCredentials
from huaweicloudsdkcore.exceptions import exceptions
from huaweicloudsdkecs.v2 import EcsClient, NovaDeleteKeypairRequest
from huaweicloudsdkecs.v2.region.ecs_region import EcsRegion
from huaweicloudsdkeip.v2 import DeletePublicipRequest, EipClient
from huaweicloudsdkeip.v2.region.eip_region import EipRegion
from huaweicloudsdkvpc.v2 import (
    DeleteSecurityGroupRequest,
    DeleteSubnetRequest,
    DeleteVpcRequest,
    VpcClient,
)
from huaweicloudsdkvpc.v2.region.vpc_region import VpcRegion


ROOT = Path(__file__).resolve().parents[1]
RDS_EIP_ID = "6b313fce-4666-447a-9a95-ece34d953ced"
KEYPAIR_NAME = "jzx-ecs-key"


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def record(service: str, action: str, error: Exception | None = None) -> dict:
    if error is None:
        return {"service": service, "action": action, "status": "ok"}
    if isinstance(error, exceptions.ClientRequestException):
        return {
            "service": service,
            "action": action,
            "status": "failed",
            "http_status": error.status_code,
            "error_code": error.error_code,
            "message": error.error_msg,
        }
    return {
        "service": service,
        "action": action,
        "status": "failed",
        "message": str(error),
    }


def main() -> None:
    env = read_env(ROOT / ".env")
    network = json.loads(
        (ROOT / "data" / "huawei-network.json").read_text(encoding="utf-8")
    )
    credentials = BasicCredentials(
        env["OBS_ACCESS_KEY"],
        env["OBS_SECRET_KEY"],
        network["projectId"],
    )
    region = network["region"]
    output: list[dict] = []

    eip = (
        EipClient.new_builder()
        .with_credentials(credentials)
        .with_region(EipRegion.value_of(region))
        .build()
    )
    try:
        eip.delete_publicip(DeletePublicipRequest(publicip_id=RDS_EIP_ID))
        output.append(record("eip", "release 124.70.88.250"))
    except Exception as error:
        output.append(record("eip", "release 124.70.88.250", error))

    ecs = (
        EcsClient.new_builder()
        .with_credentials(credentials)
        .with_region(EcsRegion.value_of(region))
        .build()
    )
    try:
        ecs.nova_delete_keypair(
            NovaDeleteKeypairRequest(keypair_name=KEYPAIR_NAME)
        )
        output.append(record("ecs", "delete keypair"))
    except Exception as error:
        output.append(record("ecs", "delete keypair", error))

    vpc = (
        VpcClient.new_builder()
        .with_credentials(credentials)
        .with_region(VpcRegion.value_of(region))
        .build()
    )
    steps = [
        (
            "vpc",
            "delete security group",
            lambda: vpc.delete_security_group(
                DeleteSecurityGroupRequest(
                    security_group_id=network["securityGroupId"]
                )
            ),
        ),
        (
            "vpc",
            "delete application subnet",
            lambda: vpc.delete_subnet(
                DeleteSubnetRequest(
                    vpc_id=network["vpcId"],
                    subnet_id=network["appSubnetId"],
                )
            ),
        ),
        (
            "vpc",
            "delete database subnet",
            lambda: vpc.delete_subnet(
                DeleteSubnetRequest(
                    vpc_id=network["vpcId"],
                    subnet_id=network["subnetId"],
                )
            ),
        ),
        (
            "vpc",
            "delete vpc",
            lambda: vpc.delete_vpc(
                DeleteVpcRequest(vpc_id=network["vpcId"])
            ),
        ),
    ]
    for service, action, operation in steps:
        try:
            operation()
            output.append(record(service, action))
        except Exception as error:
            output.append(record(service, action, error))

    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
