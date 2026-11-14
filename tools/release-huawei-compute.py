from __future__ import annotations

import json
from pathlib import Path

from huaweicloudsdkcore.auth.credentials import BasicCredentials
from huaweicloudsdkcore.exceptions import exceptions
from huaweicloudsdkdcs.v2 import DcsClient, DeleteSingleInstanceRequest
from huaweicloudsdkdcs.v2.region.dcs_region import DcsRegion
from huaweicloudsdkecs.v2 import (
    DeleteServersRequest,
    DeleteServersRequestBody,
    EcsClient,
    ServerId,
)
from huaweicloudsdkecs.v2.region.ecs_region import EcsRegion
from huaweicloudsdkrds.v3 import DeleteInstanceRequest, RdsClient
from huaweicloudsdkrds.v3.region.rds_region import RdsRegion


ROOT = Path(__file__).resolve().parents[1]
ECS_ID = "1e224f59-c217-4213-97d0-a1a24d6bcc64"
RDS_ID = "dcc5139976314d4c9028f1188a618eb2in01"
REDIS_ID = "5fe2f2e4-1f61-4cb9-865f-f4c96f5c9e6e"


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def result(service: str, action: str, **extra: object) -> dict:
    return {"service": service, "action": action, **extra}


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

    ecs = (
        EcsClient.new_builder()
        .with_credentials(credentials)
        .with_region(EcsRegion.value_of(region))
        .build()
    )
    try:
        response = ecs.delete_servers(
            DeleteServersRequest(
                body=DeleteServersRequestBody(
                    delete_publicip=True,
                    delete_volume=True,
                    servers=[ServerId(id=ECS_ID)],
                )
            )
        )
        output.append(result("ecs", "delete_submitted", job_id=response.job_id))
    except exceptions.ClientRequestException as error:
        output.append(
            result(
                "ecs",
                "delete_failed",
                http_status=error.status_code,
                error_code=error.error_code,
                message=error.error_msg,
            )
        )

    rds = (
        RdsClient.new_builder()
        .with_credentials(credentials)
        .with_region(RdsRegion.value_of(region))
        .build()
    )
    try:
        rds.delete_instance(DeleteInstanceRequest(instance_id=RDS_ID))
        output.append(result("rds", "delete_submitted"))
    except exceptions.ClientRequestException as error:
        output.append(
            result(
                "rds",
                "delete_failed",
                http_status=error.status_code,
                error_code=error.error_code,
                message=error.error_msg,
            )
        )

    dcs = (
        DcsClient.new_builder()
        .with_credentials(credentials)
        .with_region(DcsRegion.value_of(region))
        .build()
    )
    try:
        dcs.delete_single_instance(DeleteSingleInstanceRequest(instance_id=REDIS_ID))
        output.append(result("dcs", "delete_submitted"))
    except exceptions.ClientRequestException as error:
        output.append(
            result(
                "dcs",
                "delete_failed",
                http_status=error.status_code,
                error_code=error.error_code,
                message=error.error_msg,
            )
        )

    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
