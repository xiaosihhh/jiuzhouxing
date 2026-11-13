"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");

const MAX_MEDIA_BYTES = 32 * 1024 * 1024;
const MEDIA_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov"
};

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function cleanText(value, max) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, max);
}

function cleanAccountId(value) {
  const id = cleanText(value, 64);
  if (!/^JZX-[A-Z0-9]{8}$/.test(id)) throw badRequest("请先登录九州行账号");
  return id;
}

class CommunityStore {
  constructor(root, objectStore = null) {
    this.root = root;
    this.objectStore = objectStore;
    this.dataDir = path.join(root, "data", "community");
    this.mediaDir = path.join(this.dataDir, "media");
    this.postsFile = path.join(this.dataDir, "posts.json");
    this.queue = Promise.resolve();
  }

  async init() {
    await fsp.mkdir(this.mediaDir, { recursive: true });
    try {
      await fsp.access(this.postsFile);
    } catch {
      await fsp.writeFile(this.postsFile, "[]", "utf8");
    }
  }

  async readPosts() {
    try {
      const value = JSON.parse(await fsp.readFile(this.postsFile, "utf8"));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  async writePosts(posts) {
    await fsp.writeFile(this.postsFile, JSON.stringify(posts.slice(-500), null, 2), "utf8");
  }

  mutate(worker) {
    const task = this.queue.then(async () => {
      const posts = await this.readPosts();
      const result = await worker(posts);
      await this.writePosts(posts);
      return result;
    });
    this.queue = task.catch(() => {});
    return task;
  }

  async list() {
    return (await this.readPosts()).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async hasMedia(key) {
    if (!key) return false;
    const posts = await this.readPosts();
    return posts.some(post => (post.media || []).some(item => item.storage === "obs" && item.key === key));
  }

  async addPost(input) {
    const accountId = cleanAccountId(input.accountId);
    const nickname = cleanText(input.nickname, 40) || "旅行者";
    const city = cleanText(input.city, 40);
    const caption = cleanText(input.caption, 1200);
    const mediaInput = Array.isArray(input.media) ? input.media.slice(0, 4) : [];
    if (!city) throw badRequest("请选择城市");
    if (!caption) throw badRequest("请填写旅行配文");
    if (!mediaInput.length) throw badRequest("请至少上传一张照片或一个视频");

    let totalBytes = 0;
    const savedMedia = [];
    for (const item of mediaInput) {
      const match = String(item || "").match(/^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/);
      if (!match || !MEDIA_TYPES[match[1].toLowerCase()]) throw badRequest("仅支持 JPG、PNG、WebP、GIF、MP4、WebM 或 MOV 文件");
      const type = match[1].toLowerCase();
      const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
      totalBytes += buffer.length;
      if (buffer.length > MAX_MEDIA_BYTES || totalBytes > MAX_MEDIA_BYTES) throw badRequest("照片或视频文件过大，总大小不能超过 32 MB");
      const extension = MEDIA_TYPES[type];
      if (this.objectStore?.configured) {
        const stored = await this.objectStore.put(buffer, type, extension);
        savedMedia.push({ ...stored, storage: "obs", type });
      } else {
        const filename = crypto.randomUUID() + extension;
        await fsp.writeFile(path.join(this.mediaDir, filename), buffer);
        savedMedia.push({ url: "/api/community/media/" + filename, storage: "local", type });
      }
    }

    const post = {
      id: crypto.randomUUID(),
      accountId,
      nickname,
      city,
      caption,
      media: savedMedia,
      likes: [],
      favorites: [],
      comments: [],
      createdAt: new Date().toISOString()
    };
    await this.mutate(posts => {
      posts.push(post);
    });
    return post;
  }

  async toggle(postId, accountIdValue, field) {
    if (!["likes", "favorites"].includes(field)) throw badRequest("不支持的操作");
    const accountId = cleanAccountId(accountIdValue);
    return this.mutate(posts => {
      const post = posts.find(item => item.id === postId);
      if (!post) {
        const error = new Error("分享内容不存在");
        error.status = 404;
        throw error;
      }
      post[field] = Array.isArray(post[field]) ? post[field] : [];
      const index = post[field].indexOf(accountId);
      if (index >= 0) post[field].splice(index, 1);
      else post[field].push(accountId);
      return post;
    });
  }

  async addComment(postId, input) {
    const accountId = cleanAccountId(input.accountId);
    const nickname = cleanText(input.nickname, 40) || "旅行者";
    const text = cleanText(input.text, 500);
    if (!text) throw badRequest("请输入评价内容");
    return this.mutate(posts => {
      const post = posts.find(item => item.id === postId);
      if (!post) {
        const error = new Error("分享内容不存在");
        error.status = 404;
        throw error;
      }
      post.comments = Array.isArray(post.comments) ? post.comments : [];
      const comment = {
        id: crypto.randomUUID(),
        accountId,
        nickname,
        text,
        createdAt: new Date().toISOString()
      };
      post.comments.push(comment);
      post.comments = post.comments.slice(-300);
      return { post, comment };
    });
  }

  async deletePost(postId, accountIdValue) {
    const accountId = cleanAccountId(accountIdValue);
    const removed = await this.mutate(posts => {
      const index = posts.findIndex(item => item.id === postId);
      if (index < 0) {
        const error = new Error("分享内容不存在");
        error.status = 404;
        throw error;
      }
      if (posts[index].accountId !== accountId) {
        const error = new Error("只能删除自己发布的分享");
        error.status = 403;
        throw error;
      }
      return posts.splice(index, 1)[0];
    });
    for (const item of removed.media || []) {
      if (item.storage === "obs" && item.key) {
        await this.objectStore.delete(item.key);
        continue;
      }
      const filename = path.basename(new URL(item.url, "http://localhost").pathname);
      const media = this.mediaFile(filename);
      if (media) {
        try { await fsp.unlink(media.file); } catch {}
      }
    }
    return removed;
  }

  mediaFile(filename) {
    if (!/^[a-f0-9-]{36}\.(?:jpg|png|webp|gif|mp4|webm|mov)$/i.test(filename)) return null;
    const ext = path.extname(filename).toLowerCase();
    const type = {
      ".jpg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime"
    }[ext];
    const file = path.join(this.mediaDir, filename);
    if (!file.startsWith(this.mediaDir + path.sep)) return null;
    return { file, type };
  }
}

module.exports = { CommunityStore, MAX_MEDIA_BYTES };
