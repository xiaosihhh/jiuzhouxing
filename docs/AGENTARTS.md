# AgentArts Managed Agent 接入

## 1. 导入 Skill

1. 登录 AgentArts 控制台。
2. 进入“我的资产 > Skill”。
3. 单击“导入 > 导入压缩包”。
4. 上传 [jzx-travel-planner.zip](../agentarts-skills/exports/jzx-travel-planner.zip)。
5. 确认 Skill 名称为 `jzx-travel-planner`，完成安全检测并启用。

## 2. 创建 Managed Agent

1. 进入“Managed Agents > 智能体 > 创建智能体 > 快速创建”。
2. 名称使用 `jiuzhouxing`。
3. 模型选择已经验证可用的 MaaS GLM 或同类文本模型。
4. 在 Skill 配置中挂载 `jzx-travel-planner`。
5. 将 [agent-system-prompt.md](../agentarts-skills/jzx-travel-planner/references/agent-system-prompt.md) 中的提示词粘贴到系统提示词。
6. 保存并版本化智能体。

## 3. 获取调用信息

从 Managed Agent 详情页获取：

- `access_endpoint`
- Runtime 名称：`managed-jiuzhouxing`
- 入站认证方式与 API Key

将信息写入项目 `.env`：

```text
AGENTARTS_CHAT_URL=https://访问端点/runtimes/managed-jiuzhouxing/invocations/v1/chat/completions
AGENTARTS_API_KEY=...
AGENTARTS_API_KEY_HEADER=Authorization
AGENTARTS_API_KEY_PREFIX=Bearer
AGENTARTS_SKILLS=jzx-travel-planner
```

不要把 API Key 写入前端或提交到 Git。

## 4. 验收

重启后端后访问 `/api/health`，`agent` 应显示：

```text
agentarts-managed
```

提交旅行规划请求，响应应满足：

- `provider=agentarts-managed`
- 返回 `skills` 与 `agentartsTools`
- 预算、候选城市和行程均存在
- AgentArts 控制台能看到调用记录、Token 消耗和 Skill/工具调用

## 5. 降级策略

- AgentArts 超时：保留六项本地 Skills 的结果。
- AgentArts 鉴权失败：记录错误，但页面不崩溃。
- 模型额度耗尽：继续使用本地确定性行程。
