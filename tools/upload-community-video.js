"use strict";

const fs = require("fs");
const path = require("path");
const config = require("../backend/config");
const { ObjectStore } = require("../backend/object-store");
const { CommunityStore } = require("../backend/community");

async function main() {
  const [sourceArg, cityArg, captionArg] = [
    process.env.JZX_VIDEO_SOURCE || process.argv[2],
    process.env.JZX_VIDEO_CITY || process.argv[3],
    process.env.JZX_VIDEO_CAPTION || process.argv[4]
  ];
  if (!sourceArg || !cityArg || !captionArg) {
    throw new Error("用法: upload-community-video.js <视频路径> <城市> <配文>");
  }

  const source = path.resolve(sourceArg);
  const stat = fs.statSync(source);
  if (!stat.isFile()) throw new Error("视频路径不是文件");
  console.log(`准备上传 ${source} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

  const objectStore = new ObjectStore(config);
  if (!(await objectStore.init())) throw new Error("OBS 初始化失败");
  console.log(`OBS 已连接：${config.obsBucket}`);

  const community = new CommunityStore(config.root, objectStore);
  await community.init();
  const base64 = fs.readFileSync(source).toString("base64");
  const post = await community.addPost({
    accountId: "JZX-TOUR0001",
    nickname: "九州行官方",
    city: cityArg,
    caption: captionArg,
    media: [`data:video/mp4;base64,${base64}`]
  });

  console.log(JSON.stringify({
    postId: post.id,
    city: post.city,
    bytes: stat.size,
    media: post.media
  }, null, 2));
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
