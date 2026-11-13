"use strict";

const fs = require("fs");
const path = require("path");

function loadEnv() {
  const file = path.join(__dirname, "..", ".env");
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

function headBucket(client, bucket) {
  return new Promise((resolve, reject) => {
    client.headBucket({ Bucket: bucket }, error => {
      if (error) reject(error);
      else resolve(true);
    });
  });
}

async function main() {
  const env = loadEnv();
  const accessKey = env.OBS_ACCESS_KEY;
  const secretKey = env.OBS_SECRET_KEY;
  const bucket = env.OBS_BUCKET;
  if (!accessKey || !secretKey || !bucket) {
    throw new Error("OBS_ACCESS_KEY、OBS_SECRET_KEY、OBS_BUCKET 必须全部配置");
  }
  const ObsClient = require("esdk-obs-nodejs");
  const endpoints = [
    env.OBS_ENDPOINT,
    "https://obs.cn-north-4.myhuaweicloud.com",
    "https://obs.cn-east-3.myhuaweicloud.com",
    "https://obs.cn-south-1.myhuaweicloud.com",
    "https://obs.cn-southwest-2.myhuaweicloud.com"
  ].filter(Boolean);
  let found = null;
  const attempts = [];
  for (const endpoint of [...new Set(endpoints)]) {
    const client = new ObsClient({
      access_key_id: accessKey,
      secret_access_key: secretKey,
      server: endpoint,
      max_retry_count: 0,
      timeout: 8000
    });
    try {
      await headBucket(client, bucket);
      found = endpoint;
      attempts.push({ endpoint, ok: true });
      break;
    } catch (error) {
      attempts.push({ endpoint, ok: false, error: error.message });
    }
  }
  console.log(JSON.stringify({ bucket, found, attempts }, null, 2));
  process.exit(found ? 0 : 1);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
