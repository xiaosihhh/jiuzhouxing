# 九州行 · 中国旅行规划平台

面向华为比赛“基于华为云产品打造 AI 创新应用”场景的中国旅行规划作品。项目包含目的地搜索、中国城市库、路线规划、酒店探索、行程单，以及可接入华为云智能体、RDS for MySQL 和 DCS for Redis 的同源后端。

## 已实现功能

- 首页可浏览全部 90 座中国城市，默认突出 9 个精选目的地。
- 中国城市库覆盖 8 大区域、33 个省区市、343 个经典景点。
- 路线规划支持起终点、途经城市、交通方式、地图路线与高德导航外链。
- 酒店探索页覆盖全部城市，包含 20 个具名示范房源和其余城市的住宿区域/类型建议。
- 90 张城市 WebP 封面随项目分发，首页、城市库、AI 卡片和酒店页不依赖外部图片服务。
- 9 个精选城市已使用 Pixabay 授权实景照片，其余城市暂时使用本地旅行海报；来源记录在 `assets/cities/photo-sources.json`。
- 四步行程定制、行程单、收藏与文本复制。
- AI 旅行助手支持同源 `/api/ai/plan` 调用；未配置智能体时自动使用本地推荐。
- AI 请求先经过 6 项可追踪的 Skills：意图解析、目的地检索、社区趋势、预算校验、行程草稿和预订衔接；智能体只负责在技能结果范围内生成说明与推荐。
- 九州行账号使用服务端 scrypt 密码哈希和 HttpOnly 签名会话；社区发布、点赞、收藏、评价与删除均从服务端会话识别用户。
- 社区图片和视频已支持上传华为云 OBS，私有桶通过后端生成短时签名地址，删除分享会同步删除 OBS 对象。
- 行程可保存到 MySQL/RDS；未配置数据库时使用本地 `data/` 目录。
- Redis/DCS 用于缓存智能体结果；未配置时使用进程内缓存。

酒店和价格均为作品演示数据，不代表实时房态或可订价格。

## 快速启动

### 仅前端演示

双击 `启动九州行.bat`，或运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\start-server.ps1
```

访问 <http://localhost:8000/>。此方式不启动 API，AI 助手自动使用本地推荐。

### 完整本地服务

运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\start-full.ps1
```

脚本优先使用系统 Node.js 22+；如果未安装 Node.js，会尝试使用 CodeArts Agent 内置运行时。完整服务提供：

- `GET /api/health`
- `GET /api/auth/me`
- `POST /api/auth/code`
- `POST /api/auth/login/code`
- `POST /api/auth/login/password`
- `POST /api/ai/plan`
- `POST /api/trips`
- `GET /api/trips?thread_id=...`

### Docker 本地闭环

```powershell
docker compose up --build
```

该方式会同时启动应用、MySQL 和 Redis，用于在上华为云前验证 RDS/Redis 改造效果。

## 接入华为云智能体

复制 `.env.example` 为 `.env`，填写服务端配置：

```text
AGENT_API_URL=https://你的智能体接口/chat/completions
AGENT_API_KEY=你的服务端密钥
AGENT_MODEL=你的模型或智能体名称
DATABASE_URL=mysql://user:password@rds-host:3306/jiuzhou?charset=utf8mb4
REDIS_URL=redis://user:password@dcs-host:6379/0
```

密钥只放在服务端环境变量中，不要写入 `app-config.js` 或提交到仓库。智能体接口需返回 OpenAI Chat Completions 风格文本，或返回包含 `text`、`content`、`output_text` 的文本字段；系统会要求模型输出结构化 JSON。

配置完成后访问 `/api/health`。三项服务都正常时返回类似：

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

未配置或调用失败时，页面会显示降级状态并继续提供本地推荐，避免 Demo 中断。

## 云端部署

详细步骤见 [docs/CLOUD_DEPLOY.md](docs/CLOUD_DEPLOY.md)。仓库已提供 `Dockerfile`、`docker-compose.yml` 和健康检查接口，可接入 CodeArts Build、SWR、CCE/ECS、RDS for MySQL 与 DCS for Redis。

## 目录

```text
index.html           首页与 AI 助手
cities.html          中国城市库
route.html           独立路线规划
hotel.html           酒店探索
js/                  前端交互与数据
assets/cities/       90 张本地城市 WebP 封面与清单
backend/             Node.js API、智能体、RDS/Redis 适配
docs/                华为云部署说明
css/style.css        全局样式与响应式布局
Dockerfile           云端镜像
docker-compose.yml   本地应用 + MySQL + Redis
```

## 自检

完整服务启动后，另开终端运行：

```powershell
Invoke-RestMethod http://localhost:8000/api/health
Invoke-WebRequest http://localhost:8000/hotel.html -UseBasicParsing
```

如果系统有 Node.js：

```text
node tools/check-project.js
node tools/validate-data.js
```

## 比赛材料

- [参赛行动清单](docs/COMPETITION_ACTION_PLAN.md)
- [系统架构](docs/ARCHITECTURE.md)
- [演示脚本](docs/DEMO_SCRIPT.md)
- [页面排版检查](docs/LAYOUT_AUDIT.md)
- [可编辑答辩 PPT](deliverables/jiuzhouxing-competition-deck-v1.2.0.pptx)
- [答辩 PDF](deliverables/jiuzhouxing-competition-deck-v1.2.0.pdf)

## 开源提交

项目采用 MIT License。公开仓库不包含 `.env`、云服务密钥、用户账号、对话记录、行程数据或日志。赛题要求和最后期限以华为赛事后台为准。
