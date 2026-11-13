# 华为云部署说明

本项目已经从纯静态 Demo 拆出同源 API 层，可接入华为云智能体、RDS for MySQL、DCS for Redis，并通过容器部署到 CCE 或 ECS。以下步骤用于实际参赛环境，资源需要参赛账号自行开通。

## 1. 开通数据服务

1. 在 RDS 控制台创建 MySQL 实例，记录内网地址、端口、数据库名和账号。
2. 在 DCS 控制台创建 Redis 实例，记录内网地址、端口和认证信息。
3. 只允许应用所在 VPC/安全组访问数据库和缓存端口。
4. 将连接信息写入部署环境变量，禁止写入前端代码。

```text
DATABASE_URL=mysql://user:password@rds-host:3306/jiuzhou?charset=utf8mb4
REDIS_URL=redis://user:password@dcs-host:6379/0
```

应用首次连接 MySQL 时会自动创建 `conversation_messages` 和 `trip_plans` 两张表。

## 2. 配置智能体

将 CodeArts 智能体或华为云模型服务暴露为服务端 API，配置：

```text
AGENT_API_URL=https://agent-endpoint.example/v1/chat/completions
AGENT_API_KEY=服务端密钥
AGENT_MODEL=智能体或模型名称
```

如果接口使用自定义鉴权头，可额外配置：

```text
AGENT_API_KEY_HEADER=X-Auth-Token
AGENT_API_KEY_PREFIX=
```

接口应在限定时间内返回文本。后端会把目的地目录、用户需求和最近对话发送给智能体，并要求返回结构化 JSON。

## 3. 构建镜像

本地可先运行：

```powershell
docker compose up --build
```

验证后再执行：

```powershell
docker build -t jiuzhouxing:1.1.0 .
```

可使用 CodeArts Build 构建 Docker 镜像，并推送到华为云 SWR 镜像仓库。

## 4. 部署到 CCE 或 ECS

应用监听 `0.0.0.0:8000`，健康检查地址为 `GET /api/health`。

部署时注入以下环境变量：

```text
PORT=8000
AGENT_API_URL=...
AGENT_API_KEY=...
AGENT_MODEL=...
DATABASE_URL=...
REDIS_URL=...
```

对外暴露 8000 端口时建议配置 HTTPS 域名。不要直接公开数据库、Redis 或智能体密钥。

## 5. 上线验收

健康检查应显示：

```json
{
  "ok": true,
  "services": {
    "agent": "configured",
    "database": "mysql-rds",
    "cache": "redis"
  }
}
```

然后依次验收：

1. 首页打开 AI 助手，确认状态显示“云端智能体已连接”。
2. 输入亲子、预算、天数等组合需求，确认返回推荐卡片和结构化行程。
3. 将目的地加入行程单，刷新页面后可通过 `/api/trips` 查询保存记录。
4. 重复相同问题，确认响应显示 Redis 缓存标记。
5. 保存 Demo 页面截图、部署截图和云端访问地址。

## 6. 开源提交

入围决赛后，按赛题要求将源码提交到 Gitee 或 GitHub，并至少包含项目源码、依赖说明、环境变量模板、部署指导、使用文档、Demo 截图或视频，以及最终确认的开源许可证。
