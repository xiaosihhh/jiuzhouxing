"use strict";

const config = require("./config");
const { catalog, localPlan } = require("./catalog");
const { runTravelSkills } = require("./skills");
const { callAgentArts, agentArtsConfigured } = require("./agentarts");

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(item => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
    .slice(-8)
    .map(item => ({ role: item.role, content: item.content.slice(0, 4000) }));
}

function extractText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(part => part?.text || part?.content || "").join("");
  if (typeof data?.output_text === "string") return data.output_text;
  if (typeof data?.output?.text === "string") return data.output.text;
  if (typeof data?.text === "string") return data.text;
  if (typeof data?.content === "string") return data.content;
  return "";
}

function parseJsonText(text) {
  const value = String(text || "").trim();
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : value;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const json = candidate.slice(start, end + 1);
  try { return JSON.parse(json); } catch {}

  let repaired = "";
  let inString = false;
  let escaped = false;
  for (const char of json) {
    if (inString) {
      if (escaped) {
        repaired += char;
        escaped = false;
      } else if (char === "\\") {
        repaired += char;
        escaped = true;
      } else if (char === '"') {
        repaired += char;
        inString = false;
      } else if (char === "\n") {
        repaired += "\\n";
      } else if (char === "\r") {
        repaired += "\\r";
      } else if (char === "\t") {
        repaired += "\\t";
      } else {
        repaired += char;
      }
    } else {
      repaired += char;
      if (char === '"') inString = true;
    }
  }
  try { return JSON.parse(repaired); } catch { return null; }
}

function isVisibleReply(value) {
  const text = String(value || "").trim();
  if (text.length < 8) return false;
  return !/(本轮未生成可见回复|未生成可见回复|若上方已有工具结果|no visible response)/i.test(text);
}

function extractQuotedField(text, field) {
  const source = String(text || "");
  const marker = new RegExp(`"${field}"\\s*:\\s*"`, "i").exec(source);
  if (!marker) return "";
  let value = "";
  let escaped = false;
  for (let index = marker.index + marker[0].length; index < source.length; index++) {
    const char = source[index];
    if (escaped) {
      value += `\\${char}`;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === '"') {
      try { return JSON.parse(`"${value}"`); } catch {}
      return value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else {
      value += char;
    }
  }
  if (escaped) value += "\\";
  return value.trim();
}

function coerceAgentResult(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (typeof value.reply === "string" && value.reply.trim().startsWith("{")) {
      const nested = coerceAgentResult(value.reply);
      if (nested && nested !== value) return { ...value, ...nested };
    }
    return value;
  }
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = parseJsonText(text);
  if (parsed) return parsed;
  const reply = extractQuotedField(text, "reply");
  return reply ? { reply, recommendations: [] } : { reply: text, recommendations: [] };
}

function normalizeResult(data, fallback, trips) {
  const parsed = coerceAgentResult(data);
  if (!parsed) return fallback;
  const validIds = new Set(catalog.map(item => item.id));
  const recommendations = (Array.isArray(parsed.recommendations) ? parsed.recommendations : [])
    .map(item => typeof item === "string" ? { id: item, reason: "" } : item)
    .filter(item => item && validIds.has(item.id))
    .slice(0, 5)
    .map(item => ({ id: item.id, reason: String(item.reason || "").slice(0, 500) }));
  const itinerary = Array.isArray(parsed.itinerary) ? parsed.itinerary.slice(0, 14).map((day, index) => ({
    day: Number(day?.day) || index + 1,
    city: String(day?.city || "").slice(0, 80),
    items: Array.isArray(day?.items)
      ? day.items.map(item => String(item).slice(0, 500)).slice(0, 12)
      : String(day?.items || "").split(/\r?\n|；/).map(item => item.trim()).filter(Boolean).slice(0, 12)
  })) : null;
  const reply = String(parsed.reply || parsed.message || parsed.text || "").trim();
  return {
    reply: (isVisibleReply(reply) ? reply : fallback.reply).slice(0, 8000),
    recommendations: recommendations.length ? recommendations : fallback.recommendations,
    itinerary,
    tripIds: trips
  };
}

async function callAgent(message, history, tripIds, skillContext) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.agentTimeoutMs);
  const systemPrompt = [
    "你是“九州行”中国旅行规划智能体。",
    "结合用户偏好、预算、天数与当前行程，给出可执行的建议。",
    "平台提供的单次人均旅行预算固定为 1000–10000 元。",
    "行程总预算不得超过 10000 元；用户需求超出时应通过缩短天数、调整目的地或降低配置来解决，不得提高预算上限。",
    "必须优先使用服务端 Skills 返回的候选目的地、预算、社区趋势、行程骨架和预订交接信息。",
    "技能结果中不存在的城市、价格或评价不得补充为事实；可以基于技能结果细化安排。",
    "行程结构已由 Skills 完成，不要重复输出 itinerary；reply 控制在 450 个中文字符以内。",
    "只能从 Skills 返回的候选目的地中选择推荐 id。",
    "必须只返回一个 JSON 对象，结构为：",
    '{"reply":"中文说明","recommendations":[{"id":"候选id","reason":"推荐理由"}]}',
    "候选目的地（来自 destination-search Skill）：" + JSON.stringify(skillContext.candidates),
    "Skills 执行结果：" + JSON.stringify(skillContext)
  ].join("\n");
  const messages = [
    { role: "system", content: systemPrompt },
    ...cleanHistory(history),
    { role: "user", content: `当前行程目的地 id：${JSON.stringify(tripIds)}。用户需求：${message}` }
  ];
  const headers = { "Content-Type": "application/json" };
  if (config.agentKey) {
    headers[config.agentKeyHeader] = `${config.agentKeyPrefix}${config.agentKey}`;
  }
  const payload = { model: config.agentModel, messages, temperature: 0.25, max_tokens: 1200, stream: false };

  try {
    const response = await fetch(config.agentUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`agent HTTP ${response.status}`);
    const data = await response.json();
    const text = extractText(data);
    if (!text) throw new Error("agent returned empty text");
    if (!isVisibleReply(text)) throw new Error("agent returned a placeholder response");
    return coerceAgentResult(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function plan(message, history, tripIds, communityPosts = [], threadId = "") {
  const skillResult = await runTravelSkills({ message, tripIds, communityPosts });
  const baseFallback = localPlan(message, tripIds);
  const skillRecommendations = skillResult.context.candidates.slice(0, 4).map(item => ({
    id: item.id,
    reason: `技能筛选：${item.tags.join("、") || item.region}；参考 ${item.duration} 天、约 ¥${item.price.toLocaleString()}`
  }));
  const fallback = {
    ...baseFallback,
    recommendations: skillRecommendations.length ? skillRecommendations : baseFallback.recommendations,
    itinerary: skillResult.context.itineraryDraft.length ? skillResult.context.itineraryDraft : baseFallback.itinerary
  };
  const skillMeta = {
    skills: skillResult.trace,
    constraints: skillResult.context.constraints,
    budget: skillResult.context.budget,
    communityInsights: skillResult.context.communityInsights,
    bookingHandoff: skillResult.context.bookingHandoff
  };
  let agentArtsFailure = "";
  if (agentArtsConfigured) {
    try {
      const result = await callAgentArts({
        message,
        history,
        sessionId: threadId,
        skillContext: skillResult.context
      });
      if (!isVisibleReply(result.reply)) throw new Error("AgentArts 未生成有效回复");
      const parsed = coerceAgentResult(result.reply);
      const normalized = normalizeResult(parsed, fallback, tripIds);
      if (!Array.isArray(normalized.itinerary) || !normalized.itinerary.length) {
        normalized.itinerary = skillResult.context.itineraryDraft;
      }
      return {
        ...normalized,
        ...skillMeta,
        agentartsTools: result.toolCalls,
        agentartsUsage: result.usage,
        provider: "agentarts-managed",
        warning: null
      };
    } catch (agentArtsError) {
      agentArtsFailure = agentArtsError.name === "AbortError" ? "请求超时" : agentArtsError.message;
      if (!config.agentUrl) {
        return {
          ...fallback,
          ...skillMeta,
          provider: "local-fallback",
          warning: `AgentArts 暂不可用：${agentArtsFailure}`
        };
      }
    }
  }
  if (!config.agentUrl) {
    return { ...fallback, ...skillMeta, provider: "local", warning: "未配置 AGENT_API_URL" };
  }
  try {
    const result = await callAgent(message, history, tripIds, skillResult.context);
    const normalized = normalizeResult(result, fallback, tripIds);
    if (!Array.isArray(normalized.itinerary) || !normalized.itinerary.length) {
      normalized.itinerary = skillResult.context.itineraryDraft;
    }
    return {
      ...normalized,
      ...skillMeta,
      provider: "cloud-agent",
      warning: agentArtsFailure ? `AgentArts 暂不可用，已降级到 MaaS：${agentArtsFailure}` : null,
      agentArtsFailure
    };
  } catch (error) {
    return {
      ...fallback,
      ...skillMeta,
      provider: "local-fallback",
      warning: `云端智能体暂不可用：${error.name === "AbortError" ? "请求超时" : "调用失败"}${agentArtsFailure ? `；AgentArts：${agentArtsFailure}` : ""}`
    };
  }
}

module.exports = { plan, agentConfigured: Boolean(config.agentUrl || agentArtsConfigured()), agentArtsConfigured };
