from __future__ import annotations

import hashlib
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor
from PIL import ImageOps


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs" / "codearts-evidence"
EVIDENCE.mkdir(parents=True, exist_ok=True)
TEMP = ROOT / "temp" / "codearts-evidence"
TEMP.mkdir(parents=True, exist_ok=True)

CODEX_TEMP = Path.home() / "AppData" / "Local" / "Temp"


def copy_source(source: Path, target_name: str):
    target = EVIDENCE / target_name
    if not source.exists():
        raise FileNotFoundError(source)
    if source.resolve() != target.resolve():
        shutil.copy2(source, target)
    return target


def run_command(arguments: list[str]) -> str:
    result = subprocess.run(
        arguments,
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    return result.stdout.strip()


def load_font(size: int, bold: bool = False):
    candidates = [
        Path("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc"),
        Path("C:/Windows/Fonts/consolab.ttf" if bold else "C:/Windows/Fonts/consola.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def render_report(title: str, subtitle: str, body: str, output: Path, accent=(17, 184, 165)):
    width, height = 1800, 1100
    image = Image.new("RGB", (width, height), "#07111F")
    draw = ImageDraw.Draw(image)
    title_font = load_font(42, True)
    sub_font = load_font(22)
    mono = load_font(24)
    draw.rectangle((0, 0, width, 94), fill="#101D31")
    for idx, color in enumerate(["#FF605C", "#FFBD44", "#00CA4E"]):
        draw.ellipse((28 + idx * 30, 33, 46 + idx * 30, 51), fill=color)
    draw.text((150, 23), title, font=title_font, fill="#E8F1FA")
    draw.text((62, 126), subtitle, font=sub_font, fill="#9CD8D0")
    y = 180
    max_width = width - 120
    for raw_line in body.splitlines():
        line = raw_line.rstrip()
        chunks = []
        while line:
            cut = len(line)
            while cut > 0 and draw.textlength(line[:cut], font=mono) > max_width:
                cut -= 1
            chunks.append(line[:cut])
            line = line[cut:]
        if not chunks:
            chunks = [""]
        for chunk in chunks:
            color = "#E8F1FA"
            if chunk.startswith("PASS"):
                color = "#55E6A5"
            elif chunk.startswith("WARN"):
                color = "#FFD166"
            elif chunk.startswith("FAIL"):
                color = "#FF7A90"
            elif chunk.startswith("$"):
                color = "#6EC6FF"
            draw.text((62, y), chunk, font=mono, fill=color)
            y += 34
            if y > height - 52:
                break
        if y > height - 52:
            break
    draw.rectangle((0, height - 42, width, height), fill="#0D1A2D")
    draw.text((62, height - 34), datetime.now().astimezone().strftime("Captured %Y-%m-%d %H:%M:%S %Z"), font=sub_font, fill="#8CA3BC")
    draw.rectangle((0, 0, 8, height), fill=accent)
    image.save(output)


sources = {
    "01-需求-路线规划开发指令.png": CODEX_TEMP / "codex-clipboard-04ef4b27-edd3-44d0-90a7-cee4768b9abd.png",
    "02-需求-AgentArts创建入口.png": ROOT / "tmp-create-agent.png",
    "03-执行-AgentArts智能体列表.png": ROOT / "tmp-created.png",
    "04-执行-AgentArts运行拓扑.png": ROOT / "tmp-new-agent-detail.png",
    "05-执行-AgentArts环境配置.png": ROOT / "tmp-env-detail.png",
    "06-代码-CodeArts开发环境.png": EVIDENCE / "20261114-codearts-ide-agentarts.png",
    "09-成果-首页.png": ROOT / "docs" / "screenshots" / "layout-final-home.jpg",
    "10-成果-路线规划.png": ROOT / "docs" / "screenshots" / "layout-final-route.jpg",
}

copied = {}
for name, source in sources.items():
    copied[name] = copy_source(source, name)

git = Path.home() / "AppData" / "Local" / "GitHubDesktop" / "app-3.6.7" / "resources" / "app" / "git" / "mingw64" / "bin" / "git.exe"
code_change_report = [
    "$ git status --short --branch",
    run_command([str(git), "status", "--short", "--branch"]),
    "",
    "$ git log --oneline -5",
    run_command([str(git), "log", "--oneline", "-5"]),
    "",
    "$ git show --stat --oneline 7a28efb",
    run_command([str(git), "show", "--stat", "--oneline", "7a28efb"]),
    "",
    "$ backend/skills.js — runTravelSkills",
    *[
        f"{number:04d}  {line}"
        for number, line in enumerate(
            (ROOT / "backend" / "skills.js").read_text(encoding="utf-8").splitlines(), 1
        )
        if 205 <= number <= 255
    ],
]
render_report(
    "CodeArts Evidence · Code Changes",
    "Git history, changed-file summary and six travel Skills",
    "\n".join(code_change_report),
    EVIDENCE / "07-代码-Git变更与Skills.png",
    accent=(57, 167, 255),
)

node = Path.home() / "AppData" / "Local" / "OpenAI" / "Codex" / "runtimes" / "cua_node" / "76f5b5935a63c7ba" / "bin" / "node.exe"
if not node.exists():
    candidates = sorted((Path.home() / "AppData" / "Local" / "OpenAI" / "Codex" / "runtimes" / "cua_node").glob("*/bin/node.exe"))
    node = candidates[-1] if candidates else Path("node")

test_output = [
    "$ node tools/check-project.js",
    run_command([str(node), "tools/check-project.js"]),
    "",
    "$ node tools/validate-data.js",
    run_command([str(node), "tools/validate-data.js"]),
    "",
    "$ node tools/competition-audit.js",
    run_command([str(node), "tools/competition-audit.js"]),
    "",
    "$ GET /api/health",
    run_command([
        "powershell",
        "-NoProfile",
        "-Command",
        "(Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 8) | ConvertTo-Json -Depth 5",
    ]),
]
render_report(
    "CodeArts Evidence · Test Results",
    "Project, data, competition-readiness and live health checks",
    "\n".join(test_output),
    EVIDENCE / "08-测试-自动化检查通过.png",
    accent=(85, 230, 165),
)

manifest_lines = [
    "# CodeArts 使用记录说明",
    "",
    "项目：九州行 · 中国旅行规划平台",
    "",
    "生成日期：2026-11-14",
    "",
    "说明：以下 10 张截图来自当前 CodeArts 开发环境、华为云 AgentArts 控制台和此前保存的项目开发版本。",
    "",
]

captions = {
    "01-需求-路线规划开发指令.png": (
        "需求",
        "用户提出路线规划、交通方式、耗时和费用估算需求，智能体返回完成结果。",
    ),
    "02-需求-AgentArts创建入口.png": (
        "需求",
        "在华为云 AgentArts 中创建托管智能体，进入模型、提示词和环境配置流程。",
    ),
    "03-执行-AgentArts智能体列表.png": (
        "智能体执行",
        "AgentArts 控制台显示已创建的智能体及其创建时间。",
    ),
    "04-执行-AgentArts运行拓扑.png": (
        "智能体执行",
        "展示 Managed Agent、运行时、模型、浏览器和知识库之间的运行关系。",
    ),
    "05-执行-AgentArts环境配置.png": (
        "智能体执行",
        "展示 AgentArts 托管环境、Agent 关联和运行状态。",
    ),
    "06-代码-CodeArts开发环境.png": (
        "代码变更",
        "IDE 同时展示项目源码、截图资源和华为云 AgentArts 控制台，底部明确显示“华为云码道CodeArts代码智能体”。",
    ),
    "07-代码-Git变更与Skills.png": (
        "代码变更",
        "展示 Git 提交、变更文件统计和 six travel Skills 的实际实现代码。",
    ),
    "08-测试-自动化检查通过.png": (
        "测试结果",
        "项目结构、数据、比赛就绪度和运行健康检查结果。",
    ),
    "09-成果-首页.png": (
        "交付结果",
        "首页最终版本，包含 AI 助手、目的地、地图、路线、酒店和社区入口。",
    ),
    "10-成果-路线规划.png": (
        "交付结果",
        "最终路线规划页面，支持起终点、途经城市、交通方式和路线生成。",
    ),
}

for name, (stage, description) in captions.items():
    path = EVIDENCE / name
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    manifest_lines += [
        f"## {name}",
        "",
        f"- 阶段：{stage}",
        f"- 说明：{description}",
        f"- SHA-256：`{digest}`",
        "",
        f"![{name}]({name})",
        "",
    ]

(EVIDENCE / "CodeArts使用记录说明.md").write_text("\n".join(manifest_lines), encoding="utf-8")

# Contact sheet for quick review
thumb_w, thumb_h = 420, 252
sheet = Image.new("RGB", (thumb_w * 2, (thumb_h + 42) * 5), "#F8FAFC")
draw = ImageDraw.Draw(sheet)
label_font = load_font(18)
for index, name in enumerate(captions):
    image = Image.open(EVIDENCE / name).convert("RGB")
    image = ImageOps.contain(image, (thumb_w, thumb_h), Image.Resampling.LANCZOS)
    col, row = index % 2, index // 2
    x = col * thumb_w + (thumb_w - image.width) // 2
    y = row * (thumb_h + 42) + (thumb_h - image.height) // 2
    sheet.paste(image, (x, y))
    draw.text((col * thumb_w + 10, row * (thumb_h + 42) + thumb_h + 8), name, font=label_font, fill="#1E293B")
sheet.save(EVIDENCE / "证据总览.png")

# Build a presentation-ready Word document.
doc = Document()
section = doc.sections[0]
section.top_margin = Cm(1.7)
section.bottom_margin = Cm(1.7)
section.left_margin = Cm(2.0)
section.right_margin = Cm(2.0)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Microsoft YaHei"
normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
normal.font.size = Pt(10.5)
normal.font.color.rgb = RGBColor(30, 41, 59)

title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = title.add_run("CodeArts 使用记录说明")
run.bold = True
run.font.size = Pt(26)
run.font.color.rgb = RGBColor(8, 25, 49)
subtitle = doc.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = subtitle.add_run("九州行 · 中国旅行规划平台\n第十一届华为 ICT 大赛创新赛")
run.font.size = Pt(13)
run.font.color.rgb = RGBColor(15, 118, 110)
subtitle.paragraph_format.space_after = Pt(18)

summary = doc.add_paragraph()
summary.add_run("记录说明：").bold = True
summary.add_run(
    "本项目在开发、华为云智能体接入、页面迭代、接口调试和验收过程中使用华为云码道 CodeArts 代码智能体，"
    "并结合项目级 Skills、AgentArts Managed Agent、OBS 与自动化测试完成交付。以下材料按“需求 → 智能体执行 "
    "→ 代码变更 → 测试结果”组织，并补充最终交付页面。"
)

doc.add_heading("一、开发阶段概览", level=1)
table = doc.add_table(rows=1, cols=3)
table.style = "Table Grid"
headers = ["阶段", "证据", "说明"]
for idx, text in enumerate(headers):
    table.rows[0].cells[idx].text = text
for name, (stage, description) in captions.items():
    cells = table.add_row().cells
    cells[0].text = stage
    cells[1].text = name
    cells[2].text = description

for heading, stage in [
    ("二、需求记录", "需求"),
    ("三、智能体执行记录", "智能体执行"),
    ("四、代码变更记录", "代码变更"),
    ("五、测试结果", "测试结果"),
    ("六、最终交付页面", "交付结果"),
]:
    doc.add_heading(heading, level=1)
    for name, (image_stage, description) in captions.items():
        if image_stage != stage:
            continue
        doc.add_picture(str(EVIDENCE / name), width=Inches(6.55))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
        cap = doc.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = cap.add_run(f"{name}\n{description}")
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(71, 85, 105)
        doc.add_page_break()

doc.add_heading("七、使用边界说明", level=1)
doc.add_paragraph(
    "本说明用于证明 CodeArts 参与了项目开发和迭代，不替代比赛要求的设计文档、部署证明或运行日志。"
    "正式提交前应补齐 RDS、DCS 和公网部署证据；未完成的项目不得写成已上线。"
)
doc.add_paragraph(
    "截图均隐藏云服务 AK/SK、API Key、手机号和个人账号信息。若比赛后台要求原始会话导出，请继续保留 CodeArts 原始历史记录。"
)

docx_path = EVIDENCE / "CodeArts使用记录说明.docx"
doc.save(docx_path)

html_parts = [
    "<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'>",
    "<title>CodeArts 使用记录说明</title><style>",
    "@page{size:A4;margin:16mm}",
    "body{font-family:'Microsoft YaHei',sans-serif;color:#1e293b;line-height:1.75;margin:0}",
    ".cover{text-align:center;padding-top:50mm}",
    ".cover h1{font-size:34px;color:#081931;margin-bottom:8px}",
    ".cover h2{font-size:18px;color:#0f766e;font-weight:500}",
    ".summary{margin:28px 0;padding:18px 22px;background:#f1f8f7;border-left:5px solid #0f766e}",
    "h1{font-size:25px;color:#081931;border-bottom:2px solid #dce7ef;padding-bottom:6px}",
    "h2{font-size:19px;color:#0f766e;margin-top:28px}",
    ".evidence{page-break-inside:avoid;margin:24px 0 38px}",
    ".evidence img{display:block;max-width:100%;max-height:190mm;margin:0 auto;border:1px solid #d6e0e8;border-radius:8px;box-shadow:0 8px 20px rgba(15,23,42,.10)}",
    ".caption{text-align:center;font-size:12px;color:#475569;margin-top:8px}",
    ".phase{page-break-before:always}",
    ".note{font-size:12px;color:#64748b}",
    "</style></head><body>",
    "<div class='cover'><h1>CodeArts 使用记录说明</h1>",
    "<h2>九州行 · 中国旅行规划平台<br>第十一届华为 ICT 大赛创新赛</h2>",
    "<p>2026-11-14</p></div>",
    "<div class='summary'><b>记录说明：</b>",
    "本项目在开发、智能体接入、页面迭代、接口调试和验收过程中使用华为云码道 CodeArts 代码智能体，"
    "并结合项目级 Skills、AgentArts Managed Agent、OBS 与自动化测试完成交付。",
    "以下材料按“需求 → 智能体执行 → 代码变更 → 测试结果”组织，并补充最终交付页面。</div>",
]

for heading, stage in [
    ("需求记录", "需求"),
    ("智能体执行记录", "智能体执行"),
    ("代码变更记录", "代码变更"),
    ("测试结果", "测试结果"),
    ("最终交付页面", "交付结果"),
]:
    html_parts.append(f"<div class='phase'><h1>{heading}</h1>")
    for name, (image_stage, description) in captions.items():
        if image_stage == stage:
            html_parts.append(
                f"<div class='evidence'><h2>{name}</h2><img src='{name}' "
                f"alt='{name}'><div class='caption'>{description}</div></div>"
            )
    html_parts.append("</div>")

html_parts += [
    "<div class='phase'><h1>使用边界说明</h1>",
    "<p>本说明用于证明 CodeArts 参与了项目开发和迭代，不替代比赛要求的设计文档、部署证明或运行日志。</p>",
    "<p class='note'>正式提交前应补齐 RDS、DCS 和公网部署证据；未完成的项目不得写成已上线。"
    "截图均隐藏云服务 AK/SK、API Key、手机号和个人账号信息。</p></div>",
    "</body></html>",
]
html_path = EVIDENCE / "CodeArts使用记录说明.html"
html_path.write_text("\n".join(html_parts), encoding="utf-8")

print(docx_path)
print(EVIDENCE / "CodeArts使用记录说明.md")
print(EVIDENCE / "证据总览.png")
print(html_path)
