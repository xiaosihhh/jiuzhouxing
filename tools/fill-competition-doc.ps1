$ErrorActionPreference = "Stop"

$app = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $null
foreach ($candidate in $app.Documents) {
  if ($candidate.Name -like "*赛题1*创新赛*作品信息收集表*") {
    $doc = $candidate
    break
  }
}
if (-not $doc) {
  throw "Template document not found"
}

$doc.Save()
$backup = Get-ChildItem -LiteralPath (Split-Path $doc.FullName -Parent) `
  -Filter "*填写前备份*.docx" `
  -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $backup) {
  $backup = Join-Path (
    Split-Path $doc.FullName -Parent
  ) (
    "【赛题1-模板1】创新赛-作品信息收集表-填写前备份-" +
    (Get-Date -Format "yyyyMMdd-HHmmss") +
    ".docx"
  )
  Copy-Item -LiteralPath $doc.FullName -Destination $backup -Force
}

$table = $doc.Tables.Item(1)

$workName = "九州行——基于华为云智能体的中国旅行规划平台"
$field = "文旅生活服务、智能行程规划、休闲娱乐与旅行社区。"
$technology = @"
1. 使用华为云码道 CodeArts 代码智能体完成需求拆解、代码生成、联调修复、测试检查和文档整理，并保留完整开发过程记录。
2. 基于 AgentArts Managed Agent、MaaS 大模型与 Skills 构建旅行意图理解、城市检索、预算校验和行程生成能力。
3. 关联 RDS for MySQL、DCS for Redis 与 OBS：RDS 保存用户和行程等结构化数据，Redis 缓存高频规划结果，OBS 存储社区图片和视频并采用短时签名访问。
"@.Trim()

$intro = @"
1、方案的背景和价值（500字以内）
随着自由行和周边游需求增长，用户往往需要在多个平台之间反复查询城市、景点、路线、酒店和预算信息，存在信息分散、规划耗时长、预算难控、行程难以复用等问题。九州行面向中国旅行者，将城市信息、景点介绍、路线定制、酒店参考、行程单和社区分享整合到一个平台。用户输入出发地、目的地、天数、人数和预算后，即可获得可解释的行程建议，并继续修改、收藏和保存。平台提供90座城市、43个经典景点及热门社区内容，帮助用户快速获取旅行灵感，降低规划门槛，提高出行决策效率。

2、华为云产品使用价值（1000字以内）
项目采用“CodeArts + AgentArts + Skills + 华为云服务”的开发链路。需求阶段，通过 CodeArts 代码智能体梳理产品结构、接口和页面交互；开发阶段，使用智能体生成 Node.js 同源后端、页面组件、数据校验和异常降级代码；联调阶段，借助 CodeArts 定位并修复旅行助手重复回答、路线定制入口不明显和热搜结果异常等问题；构建阶段，通过自动化检查验证城市数据、接口和主要页面；云服务阶段，通过 Skills 规范环境变量、健康检查和资源配置。
AgentArts Managed Agent 与 MaaS 负责在业务 Skills 结果范围内生成自然语言说明。六项 Skills 依次完成意图解析、目的地检索、社区趋势、预算校验、行程草稿和预订衔接，避免模型脱离业务数据随意生成。OBS 用于社区图片、视频存储和短时签名访问；RDS for MySQL 保存用户、行程等结构化数据；DCS for Redis 缓存高频规划结果。该模式将需求理解、代码生成、问题修复和云服务接入串联起来，形成可复现的“想法到应用”开发实践；当云服务暂不可用时，系统自动切换到本地数据和内存缓存，保证演示连续性。
"@.Trim()

$tech = @"
一、整体技术方案
系统采用“HTML/CSS/JavaScript 前端 + Node.js 同源后端 + 华为云服务”架构。浏览器只访问同源 Web/API，AK/SK 与智能体密钥仅保存在服务端。后端先执行意图解析、目的地检索、社区趋势、预算校验、行程草稿和预订衔接六项 Skills，再调用 AgentArts Managed Agent/MaaS 生成说明，最后对城市 ID、预算和日程合法性进行二次校验。结构化数据优先写入 RDS for MySQL，失败时降级为本地 JSON；高频 AI 结果写入 DCS for Redis，云缓存不可用时降级为进程内缓存；社区图片和视频写入 OBS 私有桶，通过短时签名地址访问。项目提供 Dockerfile、健康检查、环境变量模板和部署说明，可对接 ECS/CCE。

二、关键技术模块
模块1 智能行程规划：分析用户目的地、天数、人数、预算和偏好，执行六项业务 Skills，生成结构化城市卡片、预算拆分和日程安排，并进行合法性与边界校验。
模块2 城市内容与路线可视化：覆盖8大区域、23个省区市、90座城市和43个经典景点，支持城市详情、地图展示、起终点与途经城市路线定制，并提供高德导航外链。
模块3 账号、社区与云存储：提供手机号、验证码/密码登录，使用 scrypt 密码哈希、HttpOnly 签名会话和服务端权限校验；支持社区图文、视频发布、点赞、收藏、评价，以及行程、机酒记录和个人内容管理；媒体文件由 OBS 存储，行程数据可写入 RDS，AI 结果可写入 Redis。

三、方案最终达到的效果
当前覆盖90座城市、8大区域、23个省区市和43个经典景点，内置20个示范房源；每次 AI 规划固定执行6项可追踪业务 Skills；主要页面完成桌面、平板、手机及暗色模式适配；自动化检查覆盖城市数据唯一性、景点引用、核心接口和主要页面。预期将跨平台查找与初步行程整理从约30—60分钟缩短至3—5分钟，并通过 Redis 缓存减少重复计算和数据库访问压力。
"@.Trim()

$show = @"
演示入口：本地启动后访问 http://localhost:8000/。
展示内容包括：首页与90城城市库、景点详情、自选路线与地图、酒店探索、行程单、AI 旅行助手、旅行社区，以及“我的”账号、行程、收藏和评价页面。
提交材料建议附：项目源码压缩包、答辩PPT/PDF、5分钟演示视频、CodeArts使用记录说明、华为云 AgentArts/OBS/RDS/Redis 接入截图和架构图。
"@.Trim()

$updates = @(
  @{ Row = 11; Text = $workName; Size = 12; Align = 0 },
  @{ Row = 12; Text = $field; Size = 11; Align = 0 },
  @{ Row = 13; Text = $technology; Size = 10; Align = 0 },
  @{ Row = 14; Text = $intro; Size = 10; Align = 0 },
  @{ Row = 15; Text = $tech; Size = 9; Align = 0 },
  @{ Row = 16; Text = $show; Size = 10; Align = 0 }
)

foreach ($update in $updates) {
  $range = $table.Cell($update.Row, 2).Range
  $range.Text = $update.Text
  $range.Font.Name = "微软雅黑"
  $range.Font.NameFarEast = "微软雅黑"
  $range.Font.Size = $update.Size
  $range.ParagraphFormat.Alignment = $update.Align
  $range.ParagraphFormat.LineSpacingRule = 0
  $range.ParagraphFormat.SpaceBefore = 0
  $range.ParagraphFormat.SpaceAfter = 0
}

$doc.Save()
[pscustomobject]@{
  Document = $doc.FullName
  Backup = $backup
  Saved = $doc.Saved
  WorkNameChars = $workName.Length
  IntroChars = $intro.Length
  TechChars = $tech.Length
  ShowChars = $show.Length
} | Format-List
