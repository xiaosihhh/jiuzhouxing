"use strict";

const http = require("http");

const port = Number(process.env.MOCK_AGENT_PORT || 9001);
const server = http.createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  let message = "旅行建议";
  try {
    const payload = JSON.parse(body);
    message = payload.messages?.at(-1)?.content || message;
  } catch {}
  const result = {
    reply: "这是本地模拟智能体返回的结构化旅行建议，用于验证云接口和降级链路。",
    recommendations: [
      { id: "sanya", reason: "亲子海边度假设施成熟。" },
      { id: "chengdu", reason: "节奏轻松，适合安排亲子活动。" }
    ],
    itinerary: [
      { day: 1, city: "三亚", items: ["抵达酒店", "亚龙湾散步"] },
      { day: 2, city: "三亚", items: ["蜈支洲岛", "海边亲子活动"] }
    ],
    echo: message.slice(0, 80)
  };
  const content = JSON.stringify(result);
  const response = JSON.stringify({ choices: [{ message: { role: "assistant", content } }] });
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(response);
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Mock agent listening on http://127.0.0.1:${port}/v1/chat/completions`);
});
