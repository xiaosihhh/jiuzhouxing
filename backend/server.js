"use strict";

const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const config = require("./config");
const { HybridCache } = require("./cache");
const { Store } = require("./store");
const { plan, agentConfigured, agentArtsConfigured } = require("./agent");
const { CommunityStore } = require("./community");
const { AuthService } = require("./auth");
const { ObjectStore } = require("./object-store");

const cache = new HybridCache(config.redisUrl, config.cacheTtlSeconds);
const store = new Store(config.root, config.databaseUrl);
const objectStore = new ObjectStore(config);
const community = new CommunityStore(config.root, objectStore);
const auth = new AuthService(store);
const allowedRootFiles = new Set([
  "index.html", "cities.html", "route.html", "hotel.html",
  "community.html", "app-config.js", "favicon.svg"
]);
const allowedDirectories = new Set(["css", "js", "assets"]);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  res.end(body);
}

async function readJson(req, limit = 65536) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("request body too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("invalid JSON"); }
}

function safeThreadId(value) {
  const text = String(value || "");
  return /^[A-Za-z0-9_-]{8,64}$/.test(text) ? text : crypto.randomUUID();
}

async function serveStatic(req, res, url) {
  if (!["GET", "HEAD"].includes(req.method)) {
    sendJson(res, 405, { error: "method not allowed" });
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { sendJson(res, 400, { error: "invalid path" }); return; }
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const first = relative.split("/")[0];
  if (relative.includes("..") || (!allowedRootFiles.has(relative) && !allowedDirectories.has(first))) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  const file = path.resolve(config.root, relative);
  const rootPrefix = config.root + path.sep;
  if (!file.startsWith(rootPrefix)) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  try {
    const stat = await fsp.stat(file);
    if (!stat.isFile()) throw new Error("not a file");
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mime[ext] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "SAMEORIGIN"
    });
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(file).pipe(res);
  } catch {
    sendJson(res, 404, { error: "not found" });
  }
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      services: {
        agent: agentArtsConfigured() ? "agentarts-managed" : agentConfigured ? "configured" : "local",
        database: await store.health(),
        cache: await cache.health(),
        objectStorage: await objectStore.health()
      },
      version: "1.2.0"
    });
    return;
  }
  if (url.pathname === "/api/auth/code" && req.method === "POST") {
    const body = await readJson(req);
    const result = await auth.requestCode(body.phone);
    if (!result.demo) {
      sendJson(res, 503, { error: "短信服务尚未配置，请使用密码登录" });
      return;
    }
    sendJson(res, 200, { ok: true, expiresIn: result.expiresIn, demoCode: result.code });
    return;
  }
  if (url.pathname === "/api/auth/login/code" && req.method === "POST") {
    const body = await readJson(req);
    const result = await auth.loginByCode(body.phone, body.code);
    sendJson(res, 200, { user: auth.publicUser(result.user), created: result.created }, {
      "Set-Cookie": auth.sessionCookie(result.user, req)
    });
    return;
  }
  if (url.pathname === "/api/auth/login/password" && req.method === "POST") {
    const body = await readJson(req);
    const result = await auth.loginByPassword(body.phone, body.password);
    sendJson(res, 200, { user: auth.publicUser(result.user), created: false }, {
      "Set-Cookie": auth.sessionCookie(result.user, req)
    });
    return;
  }
  if (url.pathname === "/api/auth/me" && req.method === "GET") {
    const user = await auth.currentUser(req);
    if (!user) {
      sendJson(res, 401, { error: "not authenticated" });
      return;
    }
    sendJson(res, 200, { user: auth.publicUser(user) });
    return;
  }
  if (url.pathname === "/api/auth/password" && req.method === "POST") {
    const user = await auth.currentUser(req);
    if (!user) {
      sendJson(res, 401, { error: "请先登录" });
      return;
    }
    const body = await readJson(req);
    const updated = await auth.changePassword(user, body.currentPassword, body.newPassword);
    sendJson(res, 200, { user: auth.publicUser(updated) });
    return;
  }
  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    sendJson(res, 200, { ok: true }, { "Set-Cookie": auth.clearCookie() });
    return;
  }
  if (url.pathname === "/api/ai/plan" && req.method === "POST") {
    const body = await readJson(req);
    const message = String(body.message || "").trim().slice(0, 2000);
    if (!message) {
      sendJson(res, 400, { error: "message is required" });
      return;
    }
    const threadId = safeThreadId(body.thread_id);
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const tripIds = Array.isArray(body.trip_ids) ? body.trip_ids.filter(id => typeof id === "string").slice(0, 20) : [];
    const cacheKey = "ai:plan:" + crypto.createHash("sha256").update(JSON.stringify({ message, history, tripIds })).digest("hex");
    let result = await cache.get(cacheKey);
    const cached = Boolean(result);
    if (!result) {
      const communityPosts = await community.list().catch(() => []);
      result = await plan(message, history, tripIds, communityPosts, threadId);
      result.threadId = threadId;
      result.createdAt = new Date().toISOString();
      await cache.set(cacheKey, result);
    }
    await Promise.allSettled([
      store.saveMessage(threadId, "user", message),
      store.saveMessage(threadId, "assistant", result.reply)
    ]);
    sendJson(res, 200, { ...result, threadId, cached });
    return;
  }
  if (url.pathname === "/api/trips" && req.method === "POST") {
    const body = await readJson(req);
    const threadId = safeThreadId(body.thread_id);
    const items = Array.isArray(body.items) ? body.items.filter(id => typeof id === "string").slice(0, 30) : [];
    if (!items.length) {
      sendJson(res, 400, { error: "items is required" });
      return;
    }
    const trip = await store.saveTrip(threadId, body.title, items);
    sendJson(res, 201, { trip });
    return;
  }
  if (url.pathname === "/api/trips" && req.method === "GET") {
    const threadId = safeThreadId(url.searchParams.get("thread_id"));
    sendJson(res, 200, { trips: await store.listTrips(threadId) });
    return;
  }
  if (url.pathname === "/api/community/posts" && req.method === "GET") {
    sendJson(res, 200, { posts: await community.list() });
    return;
  }
  if (url.pathname === "/api/community/posts" && req.method === "POST") {
    const user = await auth.currentUser(req);
    if (!user) {
      sendJson(res, 401, { error: "请先登录后再发布分享" });
      return;
    }
    const body = await readJson(req, 45 * 1024 * 1024);
    const post = await community.addPost({ ...body, accountId: user.accountId, nickname: user.nickname });
    sendJson(res, 201, { post });
    return;
  }
  const mediaMatch = url.pathname.match(/^\/api\/community\/media\/([^/]+)$/);
  if (url.pathname === "/api/community/media/obs" && req.method === "GET") {
    try {
      const key = url.searchParams.get("key");
      if (!(await community.hasMedia(key))) {
        sendJson(res, 404, { error: "media not found" });
        return;
      }
      await objectStore.head(key);
      const location = await objectStore.signedGetUrl(key);
      res.writeHead(302, {
        Location: location,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff"
      });
      res.end();
    } catch {
      sendJson(res, 404, { error: "media not found" });
    }
    return;
  }
  if (mediaMatch && req.method === "GET") {
    const media = community.mediaFile(mediaMatch[1]);
    if (!media) {
      sendJson(res, 404, { error: "media not found" });
      return;
    }
    try {
      const stat = await fsp.stat(media.file);
      res.writeHead(200, {
        "Content-Type": media.type,
        "Content-Length": stat.size,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff"
      });
      fs.createReadStream(media.file).pipe(res);
    } catch {
      sendJson(res, 404, { error: "media not found" });
    }
    return;
  }
  const communityAction = url.pathname.match(/^\/api\/community\/posts\/([a-f0-9-]+)\/(like|favorite|comments)$/i);
  if (communityAction && req.method === "POST") {
    const user = await auth.currentUser(req);
    if (!user) {
      sendJson(res, 401, { error: "请先登录后再参与互动" });
      return;
    }
    const postId = communityAction[1];
    const action = communityAction[2].toLowerCase();
    const body = await readJson(req);
    if (action === "comments") {
      const result = await community.addComment(postId, { ...body, accountId: user.accountId, nickname: user.nickname });
      sendJson(res, 201, result);
    } else {
      const post = await community.toggle(postId, user.accountId, action === "like" ? "likes" : "favorites");
      sendJson(res, 200, { post });
    }
    return;
  }
  const communityDelete = url.pathname.match(/^\/api\/community\/posts\/([a-f0-9-]+)$/i);
  if (communityDelete && req.method === "DELETE") {
    const user = await auth.currentUser(req);
    if (!user) {
      sendJson(res, 401, { error: "请先登录" });
      return;
    }
    const body = await readJson(req);
    await community.deletePost(communityDelete[1], user.accountId);
    sendJson(res, 200, { ok: true });
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    sendJson(res, 404, { error: "api route not found" });
    return;
  }
  await serveStatic(req, res, url);
}

async function start() {
  await Promise.all([cache.init(), store.init(), community.init(), objectStore.init()]);
  const server = http.createServer((req, res) => {
    handle(req, res).catch(error => {
      if (!res.headersSent) sendJson(res, error.status || 500, { error: error.message || "internal error" });
      else res.end();
    });
  });
  server.on("error", error => {
    if (error.code === "EADDRINUSE") {
      console.error(`端口 ${config.port} 已被占用，请先停止旧服务。`);
      process.exit(2);
    }
    throw error;
  });
  server.listen(config.port, config.host, () => {
    console.log(`九州行服务已启动: http://localhost:${config.port}/`);
    console.log(`智能体=${agentConfigured ? "cloud" : "local"} 数据=${store.status()} 缓存=${cache.status()}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch(error => {
  console.error(error);
  process.exit(1);
});
