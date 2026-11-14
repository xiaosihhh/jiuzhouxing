from __future__ import annotations

import json
import sys
from pathlib import Path

from huaweicloudsdkcore.auth.credentials import BasicCredentials
from huaweicloudsdkcore.exceptions import exceptions
from huaweicloudsdkecs.v2 import (
    CreatePostPaidServersRequest,
    CreatePostPaidServersRequestBody,
    EcsClient,
    ListServersDetailsRequest,
    NovaCreateKeypairOption,
    NovaCreateKeypairRequest,
    NovaCreateKeypairRequestBody,
    PostPaidServer,
    PostPaidServerNic,
    PostPaidServerPublicip,
    PostPaidServerRootVolume,
    PostPaidServerSecurityGroup,
)
from huaweicloudsdkecs.v2.region.ecs_region import EcsRegion


ROOT = Path(__file__).resolve().parents[1]
SERVER_NAME = "jzx-app"
KEY_NAME = "jzx-ecs-key"
FLAVOR_REF = "at7.large.1"
IMAGE_REF = "48de6f82-7ba1-459b-8c46-8888379e5d7f"


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def find_server(client: EcsClient) -> dict | None:
    response = client.list_servers_details(ListServersDetailsRequest())
    for server in response.servers or []:
        data = server.to_dict()
        if data.get("name") == SERVER_NAME:
            return data
    return None


def ensure_keypair(client: EcsClient) -> None:
    public_key_path = ROOT / "temp" / f"{KEY_NAME}.pub"
    if not public_key_path.exists():
        raise SystemExit(f"Missing public key: {public_key_path}")
    try:
        client.nova_create_keypair(
            NovaCreateKeypairRequest(
                body=NovaCreateKeypairRequestBody(
                    keypair=NovaCreateKeypairOption(
                        name=KEY_NAME,
                        public_key=public_key_path.read_text(encoding="utf-8").strip(),
                        type="ssh",
                    )
                )
            )
        )
        print("KEYPAIR_CREATED")
    except exceptions.ClientRequestException as error:
        if error.status_code != 409:
            raise
        print("KEYPAIR_EXISTS")


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
    client = (
        EcsClient.new_builder()
        .with_credentials(credentials)
        .with_region(EcsRegion.value_of(network["region"]))
        .build()
    )

    existing = find_server(client)
    if existing:
        print(json.dumps({"status": "exists", "server": existing}, ensure_ascii=False, indent=2))
        return

    ensure_keypair(client)
    request = CreatePostPaidServersRequest(
        body=CreatePostPaidServersRequestBody(
            server=PostPaidServer(
                name=SERVER_NAME,
                description="Jiuzhouxing competition application server",
                image_ref=IMAGE_REF,
                flavor_ref=FLAVOR_REF,
                vpcid=network["vpcId"],
                availability_zone=network["appAvailabilityZone"],
                count=1,
                key_name=KEY_NAME,
                nics=[PostPaidServerNic(subnet_id=network["appSubnetId"])],
                security_groups=[
                    PostPaidServerSecurityGroup(id=network["securityGroupId"])
                ],
                publicip=PostPaidServerPublicip(
                    id=network["appPublicIpId"],
                    delete_on_termination=False,
                ),
                root_volume=PostPaidServerRootVolume(
                    volumetype="GPSSD",
                    size=40,
                ),
            )
        )
    )
    try:
        response = client.create_post_paid_servers(request)
    except exceptions.ClientRequestException as error:
        print(
            json.dumps(
                {
                    "status": "failed",
                    "http_status": error.status_code,
                    "error_code": error.error_code,
                    "error_message": error.error_msg,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        sys.exit(1)

    print(
        json.dumps(
            {
                "status": "submitted",
                "server_ids": response.server_ids,
                "job_id": response.job_id,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
