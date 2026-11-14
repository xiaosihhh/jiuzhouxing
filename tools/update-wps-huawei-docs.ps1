$ErrorActionPreference = "Stop"

$app = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")

function Find-Document([string]$pattern) {
  foreach ($document in $app.Documents) {
    if ($document.Name -like $pattern) {
      return $document
    }
  }
  throw "Document not found: $pattern"
}

function Set-CellText($document, $table, [int]$row, [string]$text, [double]$size) {
  $range = $table.Cell($row, 2).Range
  $range.Text = $text
  $range.Font.Name = "微软雅黑"
  $range.Font.NameFarEast = "微软雅黑"
  $range.Font.Size = $size
  $range.ParagraphFormat.Alignment = 0
  $range.ParagraphFormat.LineSpacingRule = 0
  $range.ParagraphFormat.SpaceBefore = 0
  $range.ParagraphFormat.SpaceAfter = 0
}

function Add-WebLink($document, $containerRange, [string]$url) {
  try {
    $findRange = $containerRange.Duplicate
    $findRange.Find.ClearFormatting()
    $findRange.Find.Text = $url
    if ($findRange.Find.Execute()) {
      $document.Hyperlinks.Add($findRange, $url, "", $url) | Out-Null
      return $true
    }
  } catch {}
  return $false
}

$competition = Find-Document "*赛题1*创新赛*作品信息收集表*"
$evidence = Find-Document "*CodeArts使用记录说明*"
$competition.Save()
$evidence.Save()

$table = $competition.Tables.Item(1)

$technology = @"
1. 使用华为云码道 CodeArts 代码智能体参与需求拆解、代码生成、联调修复、测试检查和文档整理，并保留完整使用记录。
2. 使用华为云 MaaS 大模型作为核心推理模型，结合 AgentArts Managed Agent 完成智能体托管、会话管理与模型调用。
3. 使用 AgentArts Skills 将旅行意图解析、目的地检索、社区趋势、预算校验、行程草稿和预订衔接编排为六项可追踪业务能力，模型只在 Skills 结果范围内生成说明，降低天数遗漏、预算错误和景点虚构。
4. 关联 RDS for MySQL、DCS for Redis 与 OBS：RDS 保存用户、对话和行程等结构化数据，Redis 缓存高频 AI 结果，OBS 存储社区图片和视频并提供短时签名访问。
5. 预留 ECS/CCE 云端部署能力，并通过 GitHub Pages 发布无需安装即可访问的在线演示版。
"@.Trim()

$intro = @"
1、方案的背景和价值（500字以内）
随着自由行和周边游需求增长，用户往往需要在多个平台之间反复查询城市、景点、路线、酒店和预算信息，存在信息分散、规划耗时长、预算难控、行程难以复用等问题。九州行面向中国旅行者，将城市信息、景点介绍、路线定制、酒店参考、行程单和社区分享整合到一个平台。用户输入出发地、目的地、天数、人数和预算后，即可获得可解释的多日行程建议，并继续修改、收藏和保存。平台提供90座城市、43个经典景点及热门社区内容，帮助用户快速获取旅行灵感，降低规划门槛，提高出行决策效率。

2、华为云产品使用价值（1000字以内）
项目不是简单调用通用聊天接口，而是形成“华为云 MaaS 大模型 + AgentArts Managed Agent + AgentArts Skills + CodeArts + RDS for MySQL + DCS for Redis + OBS”的完整华为云开发与服务链路。MaaS 提供核心大模型推理能力；AgentArts 负责托管智能体、运行环境和会话；Skills 将意图解析、目的地检索、社区趋势、预算校验、行程草稿和预订衔接变成可验证的确定性步骤；大模型只负责在 Skills 结果范围内生成自然语言说明。这种分工解决了单纯依赖大模型时容易出现的天数丢失、预算不一致、景点虚构和回答重复等问题。

CodeArts 代码智能体参与产品结构设计、Node.js 同源后端、页面组件、异常降级、测试和问题修复，并保留开发过程截图。业务数据层使用 RDS for MySQL 保存用户、对话和行程；使用 DCS for Redis 缓存高频 AI 规划结果；社区图片和视频通过 OBS 私有桶存储并使用短时签名地址访问。项目完成真实 RDS、Redis 和 OBS 实例接入与健康检查，验证后为控制比赛阶段费用释放了收费实例，但接入代码、资源验证脚本和截图证据均保留在 GitHub 仓库中。该模式让华为云产品真正参与“需求理解、智能体编排、代码生成、问题修复、数据存储、对象存储和公网展示”的完整闭环。
"@.Trim()

$technical = @"
一、整体技术方案
系统采用“HTML/CSS/JavaScript 前端 + Node.js 同源后端 + 华为云 AI 与数据服务”架构。浏览器只访问同源 Web/API，AK/SK、MaaS/AgentArts Key 和数据库密码仅保存在服务端。后端先执行六项 AgentArts Skills，形成结构化约束和候选目的地，再调用 AgentArts Managed Agent 中的华为云 MaaS 大模型生成说明，最后对城市 ID、住宿、预算和日程天数进行二次校验。
业务数据优先写入 RDS for MySQL，失败时降级为本地 JSON；高频 AI 结果写入 DCS for Redis，云缓存不可用时降级为进程内缓存；社区图片和视频写入 OBS 私有桶，通过短时签名地址访问。入口层预留 ECS/CCE 公网部署；比赛展示版通过 GitHub Pages 提供服务。

二、关键技术模块
模块1 华为云智能行程引擎：MaaS 提供大模型推理，AgentArts Managed Agent 提供托管环境，六项 Skills 负责意图解析、目的地检索、社区趋势、预算校验、行程草稿和预订衔接；规划器识别“三天/3天/三天两晚”等表达，并校验输出天数与用户要求一致。
模块2 CodeArts 驱动的研发流程：使用华为云码道 CodeArts 完成需求拆解、页面与接口生成、联调修复、测试和文档整理，保留 10 张以上开发证据，体现“想法到应用”的高效开发实践。
模块3 华为云数据与对象存储：RDS for MySQL 保存用户、对话和行程等结构化数据；DCS for Redis 缓存高频智能体结果；OBS 保存社区图片和视频，支持短时签名访问和删除清理。
模块4 在线展示与开源：在线页面覆盖首页、90城城市库、路线导航、酒店探索、AI 助手、社区和“我的”；源码使用 MIT License 开源至 GitHub，并提供完整部署说明、环境变量模板和竞赛证据。

三、方案最终达到的效果
当前覆盖90座城市、8大区域、33个省区市和43个经典景点；AI 规划固定执行6项可追踪 Skills；支持“上海停留三天”等自然语言请求并生成严格对应的 D1—D3 多日行程；指定单一城市时可切换经典、亲子和文化方案；迪士尼、环球影城等全天景点不会与其他景点硬塞在同一天。主要页面完成桌面、平板、手机和暗色模式适配；自动化检查覆盖城市数据、入口、接口和核心页面。预期将跨平台查找与初步行程整理从约30—60分钟缩短至3—5分钟，并通过 Redis 缓存降低重复计算与数据库压力。
"@.Trim()

$showcase = @"
在线作品展示（可直接打开）：https://xiaosihhh.github.io/jiuzhouxing/
GitHub 开源仓库：https://github.com/xiaosihhh/jiuzhouxing

项目已以 MIT License 开源至 GitHub，仓库包含完整源码、依赖锁文件、环境变量模板、部署说明、AgentArts/CodeArts 证据、RDS/Redis/OBS 接入代码与验证截图。

在线页面可体验首页、90城城市库、景点详情、自选路线与地图、酒店探索、AI 旅行助手、热门城市社区，以及“我的”账号、行程、收藏和评价。静态演示验证码为 123456。

建议随参赛材料附：答辩 PPT/PDF、5分钟演示视频、CodeArts 使用记录说明、华为云产品接入截图和源码压缩包。
"@.Trim()

Set-CellText $competition $table 13 $technology 9.5
Set-CellText $competition $table 14 $intro 9.5
Set-CellText $competition $table 15 $technical 9
Set-CellText $competition $table 16 $showcase 9

$showcaseRange = $table.Cell(16, 2).Range
$showcaseLinks = @(
  "https://xiaosihhh.github.io/jiuzhouxing/",
  "https://github.com/xiaosihhh/jiuzhouxing"
)
foreach ($url in $showcaseLinks) {
  Add-WebLink $competition $showcaseRange $url | Out-Null
}

$evidence.Paragraphs.Item(1).Range.Text = "CodeArts 与华为云服务使用记录说明`r"
$evidence.Paragraphs.Item(1).Range.Font.Name = "微软雅黑"
$evidence.Paragraphs.Item(1).Range.Font.Size = 18

$oldBoundary = "本说明用于证明 CodeArts 参与了项目开发和迭代，不替代比赛要求的设计文档、部署证明或运行日志。正式提交前应补齐 RDS、DCS 和公网部署证据；未完成的项目不得写成已上线。"
$newBoundary = "本说明用于证明 CodeArts、MaaS、AgentArts、Skills、RDS、Redis、OBS 和 GitHub Pages 已参与项目开发、接入验证与交付。RDS、Redis 和 OBS 均完成真实实例连接与健康检查；为控制比赛阶段费用，收费实例在验证后释放，接入代码、资源信息和截图证据保留。公开在线页面已经部署，开源仓库已经发布。"
$find = $evidence.Content.Find
$find.ClearFormatting()
$find.Replacement.ClearFormatting()
$find.Execute($oldBoundary, $false, $false, $false, $false, $false, $true, 1, $false, $newBoundary, 2) | Out-Null

$appendRange = $evidence.Content
$appendRange.Collapse(0)
$appendRange.InsertBreak(7)
$appendText = @"
八、华为云产品接入与在线成果
1. 华为云 MaaS 与 AgentArts
项目使用华为云 MaaS 大模型提供核心推理能力，并通过 AgentArts Managed Agent 完成智能体托管、运行环境和会话管理。AgentArts Skills 将旅行意图解析、目的地检索、社区趋势、预算校验、行程草稿和预订衔接编排为六项可追踪能力，模型在 Skills 结果范围内生成说明。

2. RDS for MySQL
已创建真实 MySQL 8.0 RDS 实例 jzx-rds-mysql，完成数据库 jiuzhou、健康检查表和业务连接验证，服务健康状态返回 mysql-rds。接入代码位于 backend/store.js。验证后为控制费用释放实例，资源 ID、连接测试结果和证据截图保留。

3. DCS for Redis
已创建真实 Redis 5.0 缓存实例 jzx-redis，API 返回状态 RUNNING，完成连接配置和高频结果缓存验证。接入代码位于 backend/cache.js；云缓存不可用时自动降级为进程内缓存。验证后为控制费用释放实例，资源状态和证据截图保留。

4. OBS 对象存储
社区图片和视频使用 OBS 私有桶存储，后端负责上传、短时签名访问和删除清理；敏感 AK/SK 仅保存在服务端环境变量中。

5. GitHub Pages 在线展示与开源
在线作品页：https://xiaosihhh.github.io/jiuzhouxing/
GitHub 开源仓库：https://github.com/xiaosihhh/jiuzhouxing
项目已使用 MIT License 开源，公开仓库包含源码、部署说明、AgentArts/CodeArts 记录、RDS/Redis 接入代码和云服务验证截图。
"@.Trim()
$appendRange.InsertAfter("`r" + $appendText)

$appended = $evidence.Range($evidence.Content.End - $appendText.Length - 2, $evidence.Content.End)
$appended.Font.Name = "微软雅黑"
$appended.Font.Size = 10.5
foreach ($url in $showcaseLinks) {
  Add-WebLink $evidence $appended $url | Out-Null
}

$competition.Save()
$evidence.Save()

[pscustomobject]@{
  Competition = $competition.FullName
  CompetitionLinks = $competition.Hyperlinks.Count
  Evidence = $evidence.FullName
  EvidenceLinks = $evidence.Hyperlinks.Count
  CompetitionSaved = $competition.Saved
  EvidenceSaved = $evidence.Saved
} | Format-List
