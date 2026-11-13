"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const value = line.trim();
    if (!value || value.startsWith("#")) continue;
    const match = value.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let item = match[2].trim();
    if ((item.startsWith('"') && item.endsWith('"')) || (item.startsWith("'") && item.endsWith("'"))) {
      item = item.slice(1, -1);
    }
    process.env[match[1]] = item;
  }
}

loadEnv(path.join(ROOT, ".env"));

function keyPrefix(value) {
  if (value === undefined) return "Bearer ";
  if (value.trim() === "Bearer") return "Bearer ";
  return value;
}

module.exports = {
  root: ROOT,
  port: Number(process.env.PORT || 8000),
  host: process.env.HOST || "0.0.0.0",
  agentUrl: process.env.AGENT_API_URL || "",
  agentKey: process.env.AGENT_API_KEY || "",
  agentModel: process.env.AGENT_MODEL || "default",
  agentKeyHeader: process.env.AGENT_API_KEY_HEADER || "Authorization",
  agentKeyPrefix: keyPrefix(process.env.AGENT_API_KEY_PREFIX),
  agentTimeoutMs: Number(process.env.AGENT_TIMEOUT_MS || 30000),
  agentArtsChatUrl: process.env.AGENTARTS_CHAT_URL || "",
  agentArtsApiKey: process.env.AGENTARTS_API_KEY || "",
  agentArtsApiKeyHeader: process.env.AGENTARTS_API_KEY_HEADER || "Authorization",
  agentArtsApiKeyPrefix: keyPrefix(process.env.AGENTARTS_API_KEY_PREFIX),
  agentArtsSkills: String(process.env.AGENTARTS_SKILLS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, 50),
  agentArtsUserIdHeader: process.env.AGENTARTS_USER_ID_HEADER || "X-Hw-Agentgateway-User-Id",
  obsEndpoint: process.env.OBS_ENDPOINT || "",
  obsBucket: process.env.OBS_BUCKET || "",
  obsAccessKey: process.env.OBS_ACCESS_KEY || "",
  obsSecretKey: process.env.OBS_SECRET_KEY || "",
  databaseUrl: process.env.DATABASE_URL || "",
  redisUrl: process.env.REDIS_URL || "",
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS || 300)
};
