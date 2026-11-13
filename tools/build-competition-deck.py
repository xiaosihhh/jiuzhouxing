from pathlib import Path
from PIL import Image, ImageOps
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "deliverables"
CACHE = OUT / ".deck-assets"
OUT.mkdir(exist_ok=True)
CACHE.mkdir(exist_ok=True)

SLIDE_W = 13.333
SLIDE_H = 7.5
NAVY = RGBColor(8, 25, 49)
TEAL = RGBColor(15, 118, 110)
MINT = RGBColor(38, 194, 178)
ORANGE = RGBColor(240, 142, 72)
CREAM = RGBColor(248, 245, 237)
WHITE = RGBColor(255, 255, 255)
MUTED = RGBColor(100, 116, 139)
BLUE = RGBColor(0, 82, 255)


def crop_image(source_name, target_name, ratio, focus=0.5):
    source = ROOT / "docs" / "screenshots" / source_name
    if not source.exists():
        source = ROOT / source_name
    image = Image.open(source).convert("RGB")
    width, height = image.size
    target_h = int(width / ratio)
    if target_h <= height:
        top = int((height - target_h) * focus)
        image = image.crop((0, top, width, top + target_h))
    else:
        image = ImageOps.fit(image, (width, int(width / ratio)), method=Image.Resampling.LANCZOS)
    target = CACHE / target_name
    image.save(target, quality=92)
    return target


def set_bg(slide, color=WHITE):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_text(slide, text, x, y, w, h, size=18, color=NAVY, bold=False,
             font="Microsoft YaHei", align=PP_ALIGN.LEFT, margin=0):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = box.text_frame
    frame.clear()
    frame.word_wrap = True
    frame.margin_left = Inches(margin)
    frame.margin_right = Inches(margin)
    frame.margin_top = 0
    frame.margin_bottom = 0
    p = frame.paragraphs[0]
    p.text = text
    p.alignment = align
    p.space_after = Pt(0)
    for run in p.runs:
        run.font.name = font
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color
    return box


def add_rich(slide, parts, x, y, w, h, size=18, color=NAVY, align=PP_ALIGN.LEFT):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = box.text_frame
    frame.clear()
    frame.word_wrap = True
    p = frame.paragraphs[0]
    p.alignment = align
    for text, part_color, bold in parts:
        run = p.add_run()
        run.text = text
        run.font.name = "Microsoft YaHei"
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = part_color or color
    return box


def add_shape(slide, kind, x, y, w, h, fill, line=None, radius=True):
    shape = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = line or fill
    if kind == MSO_SHAPE.ROUNDED_RECTANGLE:
        shape.adjustments[0] = 0.12
    return shape


def add_label(slide, text, x=0.82, y=0.25, color=TEAL):
    add_text(slide, text.upper(), x, y, 3.5, 0.3, 10, color, True, "Aptos")
    add_shape(slide, MSO_SHAPE.RECTANGLE, x, y + 0.35, 0.6, 0.04, color, color)


def add_title(slide, title, subtitle=None, dark=False):
    color = WHITE if dark else NAVY
    add_text(slide, title, 0.75, 0.77, 11.8, 0.7, 30, color, True)
    if subtitle:
        add_text(slide, subtitle, 0.78, 1.43, 11.4, 0.55, 13, RGBColor(180, 205, 218) if dark else MUTED)


def add_bullet_list(slide, items, x, y, w, h, size=15, color=NAVY, bullet_color=TEAL):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = box.text_frame
    frame.clear()
    frame.word_wrap = True
    for idx, item in enumerate(items):
        p = frame.paragraphs[0] if idx == 0 else frame.add_paragraph()
        p.text = "●  " + item
        p.space_after = Pt(10)
        p.line_spacing = 1.12
        for run in p.runs:
            run.font.name = "Microsoft YaHei"
            run.font.size = Pt(size)
            run.font.color.rgb = color
        if p.runs:
            p.runs[0].font.color.rgb = bullet_color
            p.runs[0].font.size = Pt(8)
    return box


def add_picture_cover(slide, path, x, y, w, h, border_color=RGBColor(220, 229, 238)):
    pic = slide.shapes.add_picture(str(path), Inches(x), Inches(y), width=Inches(w))
    if pic.height > Inches(h):
        crop = (pic.height - Inches(h)) / pic.height
        pic.crop_top = crop / 2
        pic.crop_bottom = crop / 2
        pic.height = Inches(h)
    frame = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h)
    )
    frame.fill.background()
    frame.line.color.rgb = border_color
    frame.line.width = Pt(1)
    return pic


def add_metric(slide, value, label, x, y, w=2.5, color=TEAL):
    add_text(slide, value, x, y, w, 0.62, 30, color, True, "Aptos Display", PP_ALIGN.CENTER)
    add_text(slide, label, x, y + 0.66, w, 0.4, 11, MUTED, False, "Microsoft YaHei", PP_ALIGN.CENTER)


def add_footer(slide, page):
    add_text(slide, "九州行 · 第十一届华为 ICT 大赛创新赛", 0.78, 7.15, 7, 0.2, 8, MUTED)
    add_text(slide, str(page).zfill(2), 12.05, 7.12, 0.45, 0.2, 9, MUTED, True, "Aptos", PP_ALIGN.RIGHT)


prs = Presentation()
prs.slide_width = Inches(SLIDE_W)
prs.slide_height = Inches(SLIDE_H)
blank = prs.slide_layouts[6]

# 1. Cover
slide = prs.slides.add_slide(blank)
set_bg(slide, NAVY)
add_shape(slide, MSO_SHAPE.OVAL, 9.2, -1.2, 5.6, 5.6, RGBColor(17, 74, 107))
add_shape(slide, MSO_SHAPE.OVAL, 10.25, 0.15, 3.6, 3.6, RGBColor(19, 94, 117))
add_text(slide, "HUAWEI ICT COMPETITION · 2026—2027", 0.82, 0.75, 7.5, 0.3, 11, MINT, True, "Aptos")
add_text(slide, "九州行", 0.8, 1.55, 5.5, 0.9, 48, WHITE, True)
add_text(slide, "AI 驱动的中国旅行规划与预订入口", 0.84, 2.55, 7.3, 0.65, 24, RGBColor(214, 239, 242), True)
add_text(slide, "一个入口完成目的地发现、预算规划、路线生成、社区灵感与预订衔接。", 0.86, 3.42, 7.2, 0.9, 15, RGBColor(174, 204, 218))
add_shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 0.82, 4.76, 2.4, 0.58, MINT, MINT)
add_text(slide, "华为云 AgentArts · OBS · AI Skills", 1.05, 4.92, 2.0, 0.25, 10, NAVY, True)
add_text(slide, "参赛团队信息请在正式提交前补充", 0.84, 6.65, 5.5, 0.3, 10, RGBColor(143, 170, 190))
add_text(slide, "01", 12.05, 7.05, 0.45, 0.2, 9, MUTED, True, "Aptos", PP_ALIGN.RIGHT)

# 2. Problem
slide = prs.slides.add_slide(blank)
add_label(slide, "THE PROBLEM")
add_title(slide, "旅行规划不是缺少信息，而是决策链太长", "用户需要在攻略、地图、酒店、铁路和社区内容之间反复切换。")
problems = [
    ("信息分散", "城市、景点、预算、路线和预订信息来自不同平台。"),
    ("决策困难", "预算、天数、同行人和兴趣之间缺少统一约束。"),
    ("结果不可执行", "推荐往往停留在文字，无法继续生成行程与预订入口。"),
]
for idx, (title, body) in enumerate(problems):
    x = 0.8 + idx * 4.1
    add_shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, x, 2.35, 3.65, 2.65, CREAM, RGBColor(229, 225, 214))
    add_text(slide, f"0{idx + 1}", x + 0.25, 2.62, 0.7, 0.3, 11, ORANGE, True, "Aptos")
    add_text(slide, title, x + 0.25, 3.05, 2.8, 0.45, 20, NAVY, True)
    add_text(slide, body, x + 0.25, 3.65, 3.0, 0.9, 13, MUTED)
add_text(slide, "目标：把“我想去哪”变成可预算、可执行、可预订的完整方案。", 0.82, 5.7, 11.5, 0.55, 20, TEAL, True)
add_footer(slide, 2)

# 3. Solution
slide = prs.slides.add_slide(blank)
add_label(slide, "THE SOLUTION")
add_title(slide, "九州行：从旅行灵感到预订闭环", "90 座中国城市 · 343 个景点入口 · 6 项业务 Skills · 多端自适应")
metrics = [("90", "城市目的地"), ("343", "景点入口"), ("20", "酒店方案"), ("6", "旅行 Skills")]
for idx, (value, label) in enumerate(metrics):
    add_metric(slide, value, label, 0.65 + idx * 2.65, 2.2, 2.2, [TEAL, BLUE, ORANGE, RGBColor(139, 92, 246)][idx])
steps = ["目的地发现", "AI 行程规划", "预算与路线", "酒店/交通入口", "社区灵感回流"]
for idx, step in enumerate(steps):
    x = 0.62 + idx * 2.5
    add_shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, x, 4.1, 2.16, 0.82, NAVY if idx == 1 else RGBColor(232, 244, 246), NAVY)
    add_text(slide, step, x + 0.1, 4.34, 1.96, 0.28, 11.5, WHITE if idx == 1 else NAVY, True, align=PP_ALIGN.CENTER)
    if idx < len(steps) - 1:
        connector = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x + 2.2), Inches(4.5), Inches(x + 2.46), Inches(4.5))
        connector.line.color.rgb = TEAL
        connector.line.width = Pt(1.5)
add_text(slide, "一个同源系统承载内容、规划、账户、社区与云端 AI，不依赖多平台来回跳转。", 1.1, 5.75, 11.1, 0.45, 16, MUTED, False, align=PP_ALIGN.CENTER)
add_footer(slide, 3)

# 4. Product
slide = prs.slides.add_slide(blank)
add_label(slide, "PRODUCT EXPERIENCE")
add_title(slide, "首页与路线：规划结果直接落到行动", "选择偏好、生成建议、组合路线、跳转高德/12306/携程。")
home_img = crop_image("layout-final-home.jpg", "home-top.jpg", 16 / 9, 0.06)
route_img = crop_image("layout-final-route.jpg", "route.jpg", 16 / 9, 0.12)
add_picture_cover(slide, home_img, 0.65, 2.25, 6.05, 3.8)
add_picture_cover(slide, route_img, 6.85, 2.25, 5.85, 3.8)
add_text(slide, "统一目的地与 AI 入口", 0.78, 6.2, 4.8, 0.32, 13, TEAL, True)
add_text(slide, "自选起终点、途经城市与交通方式", 6.98, 6.2, 5.35, 0.32, 13, TEAL, True)
add_footer(slide, 4)

# 5. Architecture
slide = prs.slides.add_slide(blank)
add_label(slide, "HUAWEI CLOUD ARCHITECTURE")
add_title(slide, "智能体与确定性 Skills 结合，结果可控", "模型负责理解与表达，服务端负责城市、预算、行程和权限校验。")
nodes = [
    ("浏览器 / 手机", 0.8, 2.3, RGBColor(226, 241, 247), NAVY),
    ("Node.js API", 3.25, 2.3, RGBColor(226, 247, 244), TEAL),
    ("AgentArts\nManaged Agent", 5.78, 1.55, NAVY, WHITE),
    ("MaaS\nGLM 模型", 8.42, 1.55, RGBColor(25, 66, 112), WHITE),
    ("AgentArts\nSkill", 8.42, 3.15, RGBColor(13, 97, 125), WHITE),
    ("OBS", 3.25, 4.6, RGBColor(255, 235, 214), ORANGE),
    ("RDS for MySQL", 5.48, 4.6, RGBColor(232, 238, 250), BLUE),
    ("DCS for Redis", 7.72, 4.6, RGBColor(239, 234, 252), RGBColor(109, 40, 217)),
]
for label, x, y, fill, text_color in nodes:
    add_shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, 2.05, 1.05, fill, NAVY if fill in (WHITE, CREAM) else fill)
    add_text(slide, label, x + 0.08, y + 0.22, 1.89, 0.62, 12.5, text_color, True, align=PP_ALIGN.CENTER)
arrows = [(2.85, 2.82, 3.25, 2.82), (5.3, 2.82, 5.78, 2.82), (6.82, 2.3, 8.42, 2.08), (6.82, 2.82, 8.42, 3.58), (4.25, 3.35, 4.25, 4.6), (5.3, 3.35, 5.9, 4.6), (5.3, 3.35, 8.1, 4.6)]
for x1, y1, x2, y2 in arrows:
    connector = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    connector.line.color.rgb = RGBColor(126, 154, 177)
    connector.line.width = Pt(1.5)
add_text(slide, "已接入：AgentArts、MaaS、OBS　|　部署阶段目标：RDS、DCS、ECS/CCE", 1.0, 6.28, 11.3, 0.45, 15, NAVY, True, align=PP_ALIGN.CENTER)
add_footer(slide, 5)

# 6. Skills
slide = prs.slides.add_slide(blank)
add_label(slide, "TRACEABLE AI")
add_title(slide, "六项旅行 Skills，让 AI 输出可解释、可校验", "每次请求都能看到意图、目的地、社区、预算、行程和预订交接结果。")
skills = [
    ("01", "旅行意图解析", "预算 / 天数 / 区域 / 偏好"),
    ("02", "目的地检索", "90 城排序与候选约束"),
    ("03", "社区趋势洞察", "真实分享与互动数据"),
    ("04", "预算校验", "交通 / 住宿 / 餐饮 / 门票"),
    ("05", "行程草稿", "按天生成可执行骨架"),
    ("06", "预订衔接", "高德 / 12306 / 携程"),
]
for idx, (num, title, body) in enumerate(skills):
    row, col = divmod(idx, 2)
    x = 0.82 + col * 6.0
    y = 2.15 + row * 1.35
    add_text(slide, num, x, y, 0.55, 0.32, 11, ORANGE, True, "Aptos")
    add_text(slide, title, x + 0.58, y - 0.02, 4.7, 0.38, 17, NAVY, True)
    add_text(slide, body, x + 0.58, y + 0.43, 4.8, 0.35, 12, MUTED)
    add_shape(slide, MSO_SHAPE.RECTANGLE, x, y + 1.0, 5.4, 0.02, RGBColor(224, 231, 238))
add_footer(slide, 6)

# 7. Community + OBS
slide = prs.slides.add_slide(blank)
add_label(slide, "CONTENT & OBJECT STORAGE")
add_title(slide, "真实社区内容反哺推荐，OBS 承载云端媒体", "照片、视频、点赞、收藏、评论和用户记录形成可追溯的旅行灵感。")
community_img = crop_image("layout-final-community.jpg", "community.jpg", 4 / 3, 0.10)
add_picture_cover(slide, community_img, 0.75, 2.0, 6.3, 4.25)
add_bullet_list(slide, [
    "图片与视频上传华为云 OBS",
    "私有对象通过短时签名 URL 访问",
    "删除分享同步清理 OBS 对象",
    "社区趋势参与 AI 候选城市评分",
    "点赞、收藏和评价绑定登录账号",
], 7.45, 2.05, 4.9, 3.5, 14)
add_shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 7.48, 5.25, 4.5, 0.78, NAVY, NAVY)
add_text(slide, "当前已存储 1 条真实 OBS 社区视频", 7.75, 5.48, 3.95, 0.3, 13, WHITE, True, align=PP_ALIGN.CENTER)
add_footer(slide, 7)

# 8. Security
slide = prs.slides.add_slide(blank)
add_label(slide, "SECURITY & ENGINEERING")
add_title(slide, "云端密钥不上前端，AI 失败仍可连续演示", "账号、缓存、存储和智能体链路都具备本地降级与错误隔离。")
cards = [
    ("账号安全", "scrypt 密码哈希\nHttpOnly 签名会话\n权限绑定服务端用户"),
    ("云端安全", "AK/SK 仅存服务端\n私有 OBS 签名访问\n公开仓库密钥扫描"),
    ("稳定演示", "JSON / 内存缓存降级\n智能体失败回退本地\n超时与占位结果过滤"),
    ("工程复现", "Node.js 22+ / Docker\n依赖锁文件\nMIT License"),
]
for idx, (title, body) in enumerate(cards):
    x = 0.75 + (idx % 2) * 6.05
    y = 2.05 + (idx // 2) * 2.15
    add_shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, 5.55, 1.72, CREAM, RGBColor(229, 225, 214))
    add_text(slide, title, x + 0.25, y + 0.23, 2.1, 0.35, 16, TEAL, True)
    add_text(slide, body, x + 0.25, y + 0.7, 4.85, 0.75, 12, MUTED)
add_footer(slide, 8)

# 9. Screens
slide = prs.slides.add_slide(blank)
add_label(slide, "MULTI-PAGE EXPERIENCE")
add_title(slide, "城市、酒店与路线保持统一视觉和数据口径", "桌面、平板与手机均通过排版、交互和横向溢出检查。")
city_img = crop_image("layout-final-cities.jpg", "cities.jpg", 4 / 3, 0.04)
hotel_img = crop_image("layout-final-hotel.jpg", "hotel.jpg", 4 / 3, 0.03)
add_picture_cover(slide, city_img, 0.7, 2.0, 5.9, 4.1)
add_picture_cover(slide, hotel_img, 6.85, 2.0, 5.75, 4.1)
add_text(slide, "33 省区市 · 八大区域分层浏览", 0.92, 6.32, 4.8, 0.35, 12.5, TEAL, True)
add_text(slide, "等高卡片 · 预约入口 · 全城市覆盖", 7.05, 6.32, 4.9, 0.35, 12.5, TEAL, True)
add_footer(slide, 9)

# 10. Innovation
slide = prs.slides.add_slide(blank)
add_label(slide, "INNOVATION & VALUE")
add_title(slide, "创新不只是聊天，而是把推荐变成可执行方案", "以中国城市深度目录为约束，让大模型建议不脱离真实产品数据。")
add_bullet_list(slide, [
    "场景创新：旅行灵感、AI 规划、路线、住宿、社区和预订形成同源闭环。",
    "技术创新：AgentArts + MaaS + 6 项确定性 Skills，模型输出经过服务端校验。",
    "体验创新：自然语言输入、结构化卡片、路线图、手机扫码和社区视频联动。",
    "工程创新：云端能力与本地降级并存，保证比赛现场稳定演示。",
    "社会价值：降低学生和家庭用户的旅行决策成本，促进真实文旅内容共享。",
], 0.9, 2.15, 11.45, 3.8, 16)
add_shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 0.9, 5.82, 11.2, 0.66, RGBColor(226, 247, 244), RGBColor(157, 218, 210))
add_text(slide, "差异化：不是通用聊天机器人，而是绑定中国目的地、预算、路线和预订动作的旅行执行助手。", 1.15, 6.01, 10.7, 0.28, 14, TEAL, True, align=PP_ALIGN.CENTER)
add_footer(slide, 10)

# 11. Readiness
slide = prs.slides.add_slide(blank)
add_label(slide, "COMPETITION READINESS")
add_title(slide, "当前完成度与决赛前重点", "报名截止 2026-11-30；初赛材料于 2026 年 12 月线上提交。")
statuses = [
    ("已完成", "产品功能、AgentArts、Skills、OBS、账号安全、依赖与许可证", TEAL),
    ("部署阶段", "RDS for MySQL、DCS for Redis、ECS/CCE 公网 HTTPS 部署", BLUE),
    ("团队侧", "3 名学生 + 1 名指导教师报名、同一高校、后台材料", ORANGE),
    ("材料侧", "30–50 名用户试用、演示视频、云资源截图、现场答辩稿", RGBColor(139, 92, 246)),
]
for idx, (label, body, color) in enumerate(statuses):
    y = 2.0 + idx * 1.05
    add_shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 0.82, y, 1.35, 0.62, color, color)
    add_text(slide, label, 0.92, y + 0.18, 1.15, 0.24, 10, WHITE, True, align=PP_ALIGN.CENTER)
    add_text(slide, body, 2.38, y + 0.13, 9.8, 0.38, 14, NAVY, False)
add_text(slide, "不虚构未完成的云部署、用户量或个人数据；所有演示数据均标注为参考值。", 0.88, 6.48, 11.4, 0.32, 12, MUTED)
add_footer(slide, 11)

# 12. Close
slide = prs.slides.add_slide(blank)
set_bg(slide, NAVY)
add_label(slide, "THANK YOU", color=MINT)
add_text(slide, "让每一次出发，\n都有清晰的下一步。", 0.85, 1.75, 7.8, 1.55, 34, WHITE, True)
add_text(slide, "九州行 · 中国旅行规划平台", 0.9, 4.25, 6.8, 0.45, 20, RGBColor(194, 228, 230), True)
add_text(slide, "华为云 AgentArts · MaaS · OBS · RDS · DCS", 0.92, 4.92, 8.6, 0.35, 13, MINT)
add_shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 9.25, 2.0, 3.35, 3.35, RGBColor(16, 64, 96), RGBColor(52, 104, 135))
add_text(slide, "90", 9.85, 2.55, 2.15, 0.8, 48, WHITE, True, "Aptos Display", PP_ALIGN.CENTER)
add_text(slide, "座中国城市\n一个 AI 旅行入口", 9.52, 3.52, 2.78, 0.9, 17, RGBColor(190, 223, 231), True, align=PP_ALIGN.CENTER)

output = OUT / "jiuzhouxing-competition-deck-v1.2.0.pptx"
prs.save(output)
print(output)
