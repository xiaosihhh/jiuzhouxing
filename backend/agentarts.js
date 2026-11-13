"use strict";

const config = require("./config");

function isVisibleReply(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return !/(本轮未生成可见回复|未生成可见回复|若上方已有工具结果|no visible response)/i.test(text);
}

function configured() {
  return Boolean(config.agentArtsChatUrl && config.agentArtsApiKey);
}

function extractSseData(block) {
  const lines = String(block || "").split(/\r?\n/);
  const event = lines.find(line => line.startsWith("event:"))?.slice(6).trim() || "";
  const data = lines
    .filter(line => line.startsWith("data:"))
    .map(line => line.slice(5).trimStart())
    .join("\n");
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return null;
  }
}

async function callAgentArts({ message, history = [], sessionId, skillContext }) {
  if (!configured()) throw new Error("AgentArts Managed Agent 未配置");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(60000, config.agentTimeoutMs));
  const safeSessionId = String(sessionId || "jzx-session").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "jzx-session";
  const contextMessage = [
    `用户需求：${message}`,
    "请优先依据九州行 jzx-travel-planner Skill 生成方案。",
    "服务端预算与候选校验结果如下，不得编造超出结果的事实：",
    JSON.stringify(skillContext)
  ].join("\n");
  const body = {
    query: contextMessage,
    skills: config.agentArtsSkills
  };
  const headers = {
    "Content-Type": "application/json",
    "Accept": "text/event-stream",
    "X-Hw-Agentarts-Session-Id": safeSessionId,
    [config.agentArtsUserIdHeader]: safeSessionId
  };
  if (config.agentArtsApiKey) {
    headers[config.agentArtsApiKeyHeader] = `${config.agentArtsApiKeyPrefix}${config.agentArtsApiKey}`;
  }

  try {
    const response = await fetch(config.agentArtsChatUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`AgentArts HTTP ${response.status}${details ? `: ${details.slice(0, 300)}` : ""}`);
    }
    if (!response.body) throw new Error("AgentArts 未返回流式响应");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let finalText = "";
    const toolCalls = [];
    let usage = null;
    const handleBlock = block => {
      const item = extractSseData(block);
      if (!item) return;
      const { event, data } = item;
      if (event === "chat.delta" && data.content) text += data.content;
      else if (event === "chat.final") {
        if (data.content) finalText = data.content;
        if (data.is_complete === true && isVisibleReply(finalText)) text = finalText;
      } else if (event === "chat.tool_call" || event === "chat.tool_result") {
        toolCalls.push({
          event,
          name: data.tool_call?.name || data.tool_name || "tool",
          displayName: data.tool_call?.display_name || data.tool_name || "tool",
          status: event === "chat.tool_result" ? "completed" : "called"
        });
      } else if (event === "chat.usage_summary") {
        usage = data;
      } else if (event === "chat.error") {
        throw new Error(data.error || "AgentArts 对话失败");
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || "";
      for (const block of blocks) handleBlock(block);
    }
    buffer += decoder.decode();
    if (buffer.trim()) handleBlock(buffer);
    const reply = isVisibleReply(finalText) ? finalText : isVisibleReply(text) ? text : "";
    if (!reply) throw new Error("AgentArts 未生成有效回复");
    return { reply, toolCalls, usage };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { callAgentArts, agentArtsConfigured: configured };
