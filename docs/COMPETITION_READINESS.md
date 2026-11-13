# 华为 ICT 大赛创新赛就绪度

## 当前状态

| 要求 | 状态 | 证据 |
|---|---|---|
| CodeArts 项目级 Skill | 已建立 | `.codeartsdoer/skills/jzx-travel-agent/SKILL.md`、`.codeartsdoer/skills/jzx-huawei-cloud-readiness/SKILL.md` |
| AgentArts Skill 包 | 已生成并导入 | `agentarts-skills/exports/jzx-travel-planner.zip` |
| AgentArts Managed Agent | 已接通 | Runtime、Agent 与 Skill 均已配置 |
| 云端智能体 | 已接通 | `/api/health` 显示 `agent=agentarts-managed` |
| AI Skills 编排 | 已接通 | 每次请求执行 6 项旅行 Skills |
| RDS for MySQL | 未接通 | 当前健康检查为 `local-json` |
| DCS for Redis | 未接通 | 当前健康检查为 `memory` |
| OBS 对象存储 | 已接通 | 华北—北京四桶上传、签名访问、删除清理均已验证 |
| 服务端账号鉴权 | 已完成 | scrypt 密码哈希、HttpOnly 签名会话、社区权限绑定 |
| 用户试点数据 | 未完成 | 尚无真实用户测试报告 |
| Git 与开源许可证 | 部分完成 | MIT License 已添加；GitHub 仓库正在创建 |

## 官方 Skill 使用方式

1. 使用 CodeArts Agent 打开本项目。
2. 在对话中明确调用 `jzx-travel-agent` 检查 AI 主链路。
3. 调用 `jzx-huawei-cloud-readiness` 检查华为云资源与比赛材料。
4. 两个 Skill 都从 `.codeartsdoer/skills` 自动加载。
5. 保存 CodeArts Agent 中的 Skill 执行记录，作为比赛技术材料。

## AgentArts 官方运行链路

1. 在“我的资产 > Skill”导入 `agentarts-skills/exports/jzx-travel-planner.zip`。
2. 创建 Managed Agent 并挂载 `jzx-travel-planner`。
3. 在 `.env` 填写 `AGENTARTS_CHAT_URL`、`AGENTARTS_API_KEY` 和 `AGENTARTS_SKILLS`。
4. 重启服务后确认 `/api/health` 返回 `agent=agentarts-managed`。
5. 保存 AgentArts 控制台中的调用、Skill 和工具执行记录。

详细步骤见 [AGENTARTS.md](AGENTARTS.md)。

## 比赛前必须完成

1. 真实配置 RDS、DCS 并保存健康检查证据；OBS 已完成。
2. 把 `AUTH_SESSION_SECRET` 设置为稳定的随机长密钥，并关闭演示验证码或接入短信服务。
3. 完成 30–50 名用户的试用和量化数据。
4. 初始化 Git 仓库并上传 GitHub；许可证和依赖锁文件已完成。
5. 生成云端公网地址、架构图、演示视频和 15 分钟答辩稿。

## 官方 Skill 边界

- `.codeartsdoer/skills` 中的两个 Skill 符合 CodeArts Agent 的项目级加载格式。
- CodeArts Agent 可用它们检查 AI 链路和华为云比赛就绪度。
- 应用运行时仍由 `backend/skills.js` 执行六项确定性业务技能。
- 若赛项要求应用运行时由 CodeArts Agent 动态选择官方 Skill，还需要把运行请求接到 CodeArts Agent 的工具调用接口；本机当前模型接口不提供项目 Skill 动态发现。

## 审计命令

```powershell
node tools/competition-audit.js
node tools/competition-audit.js --live-ai
```
