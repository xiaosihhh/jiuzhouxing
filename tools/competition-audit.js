"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const checks = [];

function add(level, title, detail) {
  checks.push({ level, title, detail });
}

function exists(relative) {
  return fs.existsSync(path.join(root, relative));
}

function readJson(relative) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
  } catch {
    return null;
  }
}

async function request(pathname, options = {}) {
  const url = process.env.JZX_BASE_URL || "http://127.0.0.1:8000";
  return fetch(url + pathname, { ...options, signal: AbortSignal.timeout(options.timeout || 10000) });
}

function loadEnv() {
  const file = path.join(root, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

async function main() {
  loadEnv();
  const packageJson = readJson("package.json");
  add(packageJson ? "PASS" : "FAIL", "项目清单", packageJson ? `版本 ${packageJson.version || "unknown"}` : "缺少 package.json");
  add(exists(".git") ? "PASS" : "WARN", "Git 仓库", exists(".git") ? "可用于提交源码" : "尚未初始化 Git 仓库");
  add(exists("LICENSE") || exists("LICENSE.md") ? "PASS" : "FAIL", "开源许可证", "比赛最终提交通常需要明确许可证");
  add(exists("package-lock.json") ? "PASS" : "WARN", "依赖锁文件", exists("package-lock.json") ? "依赖可复现" : "缺少 package-lock.json");

  const skillsRoot = path.join(root, ".codeartsdoer", "skills");
  const skillDirs = fs.existsSync(skillsRoot)
    ? fs.readdirSync(skillsRoot, { withFileTypes: true }).filter(entry => entry.isDirectory())
    : [];
  let validSkills = 0;
  for (const entry of skillDirs) {
    const manifest = path.join(skillsRoot, entry.name, "SKILL.md");
    if (!fs.existsSync(manifest)) continue;
    const text = fs.readFileSync(manifest, "utf8");
    const frontmatter = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
    const name = frontmatter?.[1].match(/^name:\s*(.+)$/m)?.[1].trim();
    const description = frontmatter?.[1].match(/^description:\s*(.+)$/m)?.[1].trim();
    if (name === entry.name && description) validSkills++;
    else add("FAIL", `Skill 清单 ${entry.name}`, "name 必须与目录名一致，且 description 不得为空");
  }
  add(validSkills > 0 ? "PASS" : "FAIL", "CodeArts 项目级 Skills", `${validSkills} 个有效官方格式清单`);
  const agentArtsSkill = path.join(root, "agentarts-skills", "exports", "jzx-travel-planner.zip");
  if (fs.existsSync(agentArtsSkill)) {
    const size = fs.statSync(agentArtsSkill).size;
    add(size <= 10 * 1024 * 1024 ? "PASS" : "FAIL", "AgentArts Skill 导入包", `${Math.round(size / 1024)} KB`);
  } else {
    add("FAIL", "AgentArts Skill 导入包", "缺少 jzx-travel-planner.zip");
  }
  add(process.env.AGENTARTS_CHAT_URL && process.env.AGENTARTS_API_KEY ? "PASS" : "FAIL", "AgentArts Managed Agent", process.env.AGENTARTS_CHAT_URL ? "已配置调用地址" : "尚未配置 Runtime 地址与 API Key");

  let health = null;
  try {
    const response = await request("/api/health");
    health = response.ok ? await response.json() : null;
  } catch {}
  if (!health) {
    add("FAIL", "服务健康检查", "服务不可访问，请先启动 backend/server.js");
  } else {
    add(["configured", "agentarts-managed"].includes(health.services?.agent) ? "PASS" : "FAIL", "华为云智能体", String(health.services?.agent || "unknown"));
    add(health.services?.database === "mysql-rds" ? "PASS" : "WARN", "RDS for MySQL（可选）", String(health.services?.database || "unknown"));
    add(health.services?.cache === "redis" ? "PASS" : "WARN", "DCS for Redis（可选）", String(health.services?.cache || "unknown"));
    add(health.services?.objectStorage === "obs" ? "PASS" : "FAIL", "OBS 对象存储", String(health.services?.objectStorage || "not-configured"));
  }

  if (process.argv.includes("--live-ai")) {
    try {
      const response = await request("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "预算5000元，亲子旅行三天，想看自然风景",
          history: [],
          thread_id: "competition-audit-live",
          trip_ids: []
        }),
        timeout: 180000
      });
      const data = await response.json();
      const skillCount = Array.isArray(data.skills) ? data.skills.length : 0;
      add(response.ok && skillCount >= 6 ? "PASS" : "FAIL", "AI Skills 实时验收", `${skillCount} 项 Skills，provider=${data.provider}`);
      add(data.constraints?.days === 3 && data.constraints?.budget === 5000 ? "PASS" : "FAIL", "中文意图解析", `预算 ${data.constraints?.budget}，天数 ${data.constraints?.days}`);
      add(["agentarts-managed", "cloud-agent"].includes(data.provider) ? "PASS" : "WARN", "云端模型调用", String(data.provider));
    } catch (error) {
      add("FAIL", "AI Skills 实时验收", error.message);
    }
  }

  for (const check of checks) {
    console.log(`[${check.level}] ${check.title}: ${check.detail}`);
  }
  const failures = checks.filter(check => check.level === "FAIL").length;
  const warnings = checks.filter(check => check.level === "WARN").length;
  console.log(`\n比赛就绪审计：${checks.length - failures - warnings} 通过，${warnings} 警告，${failures} 未通过。`);
  process.exitCode = failures ? 1 : 0;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
