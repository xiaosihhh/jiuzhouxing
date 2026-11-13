"use strict";

const config = require("../backend/config");
const { ObjectStore } = require("../backend/object-store");

async function main() {
  const store = new ObjectStore(config);
  const initialized = await store.init();
  if (!initialized) throw new Error("OBS 客户端初始化失败");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2WQAAAAASUVORK5CYII=", "base64");
  const stored = await store.put(png, "image/png", ".png");
  await store.call("copyObject", {
    Bucket: config.obsBucket,
    Key: stored.key,
    CopySource: `/${config.obsBucket}/${stored.key}`,
    MetadataDirective: "REPLACE",
    ContentType: "image/png"
  });
  const head = await store.head(stored.key);
  const signedUrl = await store.signedGetUrl(stored.key);
  const response = await fetch(signedUrl);
  const responseText = /json|xml|text/i.test(response.headers.get("content-type") || "")
    ? (await response.text()).slice(0, 500)
    : "";
  const deleted = await store.delete(stored.key);
  await new Promise(resolve => setTimeout(resolve, 1000));
  let existsAfterDelete = true;
  try {
    await store.head(stored.key);
  } catch {
    existsAfterDelete = false;
  }
  console.log(JSON.stringify({
    stored,
    metadataStatus: head.CommonMsg?.Status,
    headContentType: head.InterfaceResult?.ContentType || head.CommonMsg?.Headers?.["content-type"] || head.CommonMsg?.Headers?.["Content-Type"] || "",
    signedGetStatus: response.status,
    signedGetType: response.headers.get("content-type"),
    signedGetPreview: responseText,
    deleted,
    existsAfterDelete
  }, null, 2));
  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
