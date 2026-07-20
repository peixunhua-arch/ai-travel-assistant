"""Generate high-fidelity 途灵 phone UI mockups for the pitch deck."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent / "screenshots"
ASSETS = Path(__file__).resolve().parents[1] / "apps" / "mobile" / "assets"

# App theme tokens
PRIMARY = "#3DB8A9"
PRIMARY_DARK = "#2E9A8E"
PRIMARY_BG = "#E8F8F5"
ACCENT = "#F5A06A"
ACCENT_BG = "#FFF0E6"
BG = "#FFF8F4"
SURFACE = "#FFFFFF"
BORDER = "#E5D2C5"
BORDER_LIGHT = "#F2E8DF"
TEXT_STRONG = "#4F3428"
TEXT = "#4A3A32"
MUTED = "#967866"
PLACEHOLDER = "#B5A090"

W, H = 390, 844
R = 36  # phone corner


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def rounded_rect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def phone_canvas(bg=BG) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    # outer shadow canvas
    pad = 18
    img = Image.new("RGBA", (W + pad * 2, H + pad * 2), (0, 0, 0, 0))
    # soft shadow
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        [pad + 6, pad + 10, pad + W + 6, pad + H + 10],
        radius=R + 4,
        fill=(42, 90, 84, 45),
    )
    img = Image.alpha_composite(img, shadow)

    screen = Image.new("RGBA", (W, H), hex_to_rgb(bg) + (255,))
    d = ImageDraw.Draw(screen)
    # status bar
    d.rectangle([0, 0, W, 44], fill=hex_to_rgb(bg))
    d.text((24, 14), "9:41", font=font(13, True), fill=hex_to_rgb(TEXT_STRONG))
    d.text((W - 90, 14), "▮▮▮  WiFi  ●", font=font(11), fill=hex_to_rgb(MUTED))

    # compose onto frame
    frame = Image.new("RGBA", img.size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle([pad - 3, pad - 3, pad + W + 3, pad + H + 3], radius=R + 3, fill="#1A2A36")
    img = Image.alpha_composite(img, frame)
    img.paste(screen, (pad, pad), screen)

    # notch
    nd = ImageDraw.Draw(img)
    nd.rounded_rectangle([pad + W // 2 - 48, pad + 10, pad + W // 2 + 48, pad + 26], radius=10, fill="#1A2A36")
    return img, ImageDraw.Draw(img)


def content_xy(x: int, y: int) -> tuple[int, int]:
    pad = 18
    return pad + x, pad + y


def draw_tab_bar(draw, img: Image.Image, active: int):
    """active: 0 plan, 1 trips, 2 plus, 3 community, 4 profile"""
    pad = 18
    y0 = pad + H - 72
    draw.rectangle([pad, y0, pad + W, pad + H], fill=hex_to_rgb(SURFACE))
    draw.line([pad, y0, pad + W, y0], fill=hex_to_rgb(BORDER_LIGHT), width=1)
    labels = ["规划", "行程", "", "社区", "我的"]
    icons = ["▣", "▦", "+", "◎", "☺"]
    for i, (lab, ic) in enumerate(zip(labels, icons)):
        x = pad + 18 + i * 74
        if i == 2:
            # center plus
            bx, by = pad + W // 2 - 22, y0 + 10
            draw.rounded_rectangle([bx, by, bx + 44, by + 34], radius=8, outline=hex_to_rgb(PRIMARY), width=2, fill=hex_to_rgb(SURFACE))
            draw.text((bx + 13, by + 2), "+", font=font(22, True), fill=hex_to_rgb(PRIMARY_DARK))
            continue
        color = PRIMARY if i == active else MUTED
        draw.text((x + 18, y0 + 12), ic, font=font(14), fill=hex_to_rgb(color))
        draw.text((x + 10, y0 + 36), lab, font=font(11, True), fill=hex_to_rgb(color))


def chip(draw, x, y, text, selected=False, fill=None):
    fnt = font(12, selected)
    bbox = fnt.getbbox(text)
    tw = bbox[2] - bbox[0]
    w, h = tw + 22, 30
    bg = fill or (PRIMARY if selected else SURFACE)
    fg = "#FFFFFF" if selected else TEXT
    outline = None if selected else BORDER
    rounded_rect(draw, [x, y, x + w, y + h], 14, hex_to_rgb(bg), hex_to_rgb(outline) if outline else None)
    draw.text((x + 11, y + 7), text, font=fnt, fill=hex_to_rgb(fg))
    return w + 8


def screen_plan():
    img, draw = phone_canvas()
    pad = 18
    # header
    draw.text(content_xy(20, 56), "途灵", font=font(22, True), fill=hex_to_rgb(TEXT_STRONG))
    draw.text(content_xy(80, 62), "规划行程", font=font(13), fill=hex_to_rgb(MUTED))
    # chat entry
    rounded_rect(draw, [*content_xy(280, 54), *content_xy(366, 86)], 14, hex_to_rgb(PRIMARY_BG))
    draw.text(content_xy(298, 62), "AI 聊聊", font=font(12, True), fill=hex_to_rgb(PRIMARY_DARK))

    y = 104
    draw.text(content_xy(20, y), "想去哪里？", font=font(15, True), fill=hex_to_rgb(TEXT_STRONG))
    y += 30
    rounded_rect(draw, [*content_xy(20, y), *content_xy(370, y + 42)], 14, hex_to_rgb(SURFACE), hex_to_rgb(PRIMARY), 2)
    draw.text(content_xy(34, y + 12), "成都", font=font(15, True), fill=hex_to_rgb(TEXT))

    y += 58
    for city, sel in [("成都", True), ("重庆", False), ("厦门", False), ("大理", False)]:
        pass
    x = content_xy(20, 0)[0]
    for city, sel in [("成都", True), ("重庆", False), ("厦门", False), ("大理", False)]:
        x += chip(draw, x, content_xy(0, y)[1], city, sel)

    y += 48
    draw.text(content_xy(20, y), "游玩天数", font=font(15, True), fill=hex_to_rgb(TEXT_STRONG))
    y += 28
    x = content_xy(20, 0)[0]
    for t, sel in [("1–2天短途", False), ("3–5天常规", True), ("6天+长线", False)]:
        x += chip(draw, x, content_xy(0, y)[1], t, sel)

    y += 48
    draw.text(content_xy(20, y), "预算与偏好", font=font(15, True), fill=hex_to_rgb(TEXT_STRONG))
    y += 28
    x = content_xy(20, 0)[0]
    for t, sel in [("经济", False), ("舒适", True), ("不限", False)]:
        x += chip(draw, x, content_xy(0, y)[1], t, sel)
    y += 42
    x = content_xy(20, 0)[0]
    for t, sel in [("美食", True), ("轻松", True), ("人文古迹", False), ("夜景", True)]:
        x += chip(draw, x, content_xy(0, y)[1], t, sel, fill=PRIMARY if sel else None)

    y += 50
    draw.text(content_xy(20, y), "节奏 / 同行", font=font(15, True), fill=hex_to_rgb(TEXT_STRONG))
    y += 28
    x = content_xy(20, 0)[0]
    for t, sel in [("均衡打卡", True), ("情侣", True), ("下月", False)]:
        x += chip(draw, x, content_xy(0, y)[1], t, sel)

    # summary card
    y += 48
    rounded_rect(draw, [*content_xy(20, y), *content_xy(370, y + 72)], 14, hex_to_rgb(ACCENT_BG))
    draw.text(content_xy(34, y + 14), "已选：成都 · 4天 · 舒适 · 美食/轻松/夜景", font=font(12, True), fill=hex_to_rgb(TEXT))
    draw.text(content_xy(34, y + 38), "AI 将结合高德 POI 与天气生成可落地行程", font=font(11), fill=hex_to_rgb(MUTED))

    # CTA
    y = 700
    rounded_rect(draw, [*content_xy(20, y), *content_xy(370, y + 48)], 18, hex_to_rgb(PRIMARY))
    draw.text(content_xy(130, y + 14), "生成我的行程", font=font(16, True), fill="#FFFFFF")

    draw_tab_bar(draw, img, 0)
    path = OUT / "01-plan.png"
    img.convert("RGB").save(path, quality=95)
    return path


def screen_preview():
    img, draw = phone_canvas()
    # back header
    draw.text(content_xy(16, 54), "‹", font=font(24, True), fill=hex_to_rgb(PRIMARY_DARK))
    draw.text(content_xy(40, 58), "行程预览", font=font(17, True), fill=hex_to_rgb(TEXT_STRONG))
    draw.text(content_xy(300, 60), "分享", font=font(13, True), fill=hex_to_rgb(PRIMARY))

    # destination summary
    y = 100
    rounded_rect(draw, [*content_xy(16, y), *content_xy(374, y + 88)], 16, hex_to_rgb(SURFACE), hex_to_rgb(BORDER_LIGHT))
    draw.text(content_xy(30, y + 14), "成都 · 4 天行程", font=font(18, True), fill=hex_to_rgb(TEXT_STRONG))
    draw.text(content_xy(30, y + 46), "预估 ¥6800 · 均衡打卡 · 已根据偏好调整", font=font(12), fill=hex_to_rgb(MUTED))

    # weather strip
    y = 202
    rounded_rect(draw, [*content_xy(16, y), *content_xy(374, y + 56)], 14, hex_to_rgb(PRIMARY_BG))
    draw.text(content_xy(30, y + 10), "天气", font=font(12, True), fill=hex_to_rgb(PRIMARY_DARK))
    draw.text(content_xy(30, y + 30), "今天 28° 晴   明天 26° 多云   后天 24° 小雨", font=font(11), fill=hex_to_rgb(TEXT))

    # day tabs
    y = 274
    x = content_xy(16, 0)[0]
    for t, sel in [("第1天", True), ("第2天", False), ("第3天", False), ("第4天", False)]:
        x += chip(draw, x, content_xy(0, y)[1], t, sel)

    # map placeholder
    y = 320
    rounded_rect(draw, [*content_xy(16, y), *content_xy(374, y + 120)], 14, "#D7EFEA")
    draw.text(content_xy(140, y + 40), "高德路线地图", font=font(14, True), fill=hex_to_rgb(PRIMARY_DARK))
    draw.text(content_xy(120, y + 66), "宽窄巷子 → 春熙路 → 锦里", font=font(11), fill=hex_to_rgb(MUTED))
    # fake route dots
    for i, px in enumerate([50, 120, 200, 280]):
        cx, cy = content_xy(px, y + 20 + (i % 2) * 40)
        draw.ellipse([cx, cy, cx + 10, cy + 10], fill=hex_to_rgb(PRIMARY if i else ACCENT))

    # day items
    y = 456
    draw.text(content_xy(20, y), "第 1 天 · 老城区人文", font=font(14, True), fill=hex_to_rgb(TEXT_STRONG))
    items = [
        ("09:30", "宽窄巷子", "景点 · 清代老街巷"),
        ("12:00", "陈麻婆豆腐", "美食 · 川菜经典"),
        ("15:00", "杜甫草堂", "景点 · 园林清幽"),
    ]
    y += 28
    for time, name, desc in items:
        rounded_rect(draw, [*content_xy(16, y), *content_xy(374, y + 58)], 12, hex_to_rgb(SURFACE), hex_to_rgb(BORDER_LIGHT))
        draw.text(content_xy(28, y + 10), time, font=font(12, True), fill=hex_to_rgb(PRIMARY))
        draw.text(content_xy(88, y + 10), name, font=font(14, True), fill=hex_to_rgb(TEXT_STRONG))
        draw.text(content_xy(88, y + 32), desc, font=font(11), fill=hex_to_rgb(MUTED))
        draw.text(content_xy(320, y + 18), "导航 ›", font=font(11, True), fill=hex_to_rgb(ACCENT))
        y += 66

    # bottom bar
    y = 730
    rounded_rect(draw, [18, 18 + y, 18 + W, 18 + H - 8], 0, hex_to_rgb(SURFACE))
    rounded_rect(draw, [*content_xy(16, y), *content_xy(180, y + 44)], 14, hex_to_rgb(SURFACE), hex_to_rgb(BORDER), 1)
    draw.text(content_xy(58, y + 13), "重新生成", font=font(13, True), fill=hex_to_rgb(TEXT))
    rounded_rect(draw, [*content_xy(196, y), *content_xy(374, y + 44)], 14, hex_to_rgb(PRIMARY))
    draw.text(content_xy(246, y + 13), "保存行程", font=font(13, True), fill="#FFFFFF")

    path = OUT / "02-preview.png"
    img.convert("RGB").save(path, quality=95)
    return path


def screen_trips():
    img, draw = phone_canvas()
    draw.text(content_xy(20, 56), "我的行程", font=font(22, True), fill=hex_to_rgb(TEXT_STRONG))
    draw.text(content_xy(300, 62), "已同步", font=font(12), fill=hex_to_rgb(PRIMARY))

    # search
    y = 100
    rounded_rect(draw, [*content_xy(16, y), *content_xy(374, y + 40)], 14, hex_to_rgb("#FFF4ED"), hex_to_rgb(BORDER))
    draw.text(content_xy(34, y + 12), "搜索目的地…", font=font(13), fill=hex_to_rgb(PLACEHOLDER))

    y = 156
    x = content_xy(16, 0)[0]
    for t, sel in [("全部", True), ("3–5天", False), ("舒适", False)]:
        x += chip(draw, x, content_xy(0, y)[1], t, sel)

    cards = [
        ("成都", "4 天 · 舒适 · 下月", "美食 / 轻松 / 夜景", PRIMARY_BG),
        ("成都（示例）", "2 天 · 示例行程", "宽窄巷子 · 熊猫基地", ACCENT_BG),
        ("杭州", "3 天 · 经济", "西湖 · 灵隐 · 河坊街", PRIMARY_BG),
    ]
    y = 210
    for title, meta, tags, bg in cards:
        rounded_rect(draw, [*content_xy(16, y), *content_xy(374, y + 100)], 16, hex_to_rgb(SURFACE), hex_to_rgb(BORDER_LIGHT))
        rounded_rect(draw, [*content_xy(16, y), *content_xy(28, y + 100)], 16, hex_to_rgb(PRIMARY if "示例" not in title else ACCENT))
        draw.text(content_xy(44, y + 16), title, font=font(16, True), fill=hex_to_rgb(TEXT_STRONG))
        draw.text(content_xy(44, y + 44), meta, font=font(12), fill=hex_to_rgb(MUTED))
        rounded_rect(draw, [*content_xy(44, y + 68), *content_xy(280, y + 90)], 10, hex_to_rgb(bg))
        draw.text(content_xy(54, y + 72), tags, font=font(11), fill=hex_to_rgb(TEXT))
        y += 114

    draw_tab_bar(draw, img, 1)
    path = OUT / "03-trips.png"
    img.convert("RGB").save(path, quality=95)
    return path


def screen_community():
    img, draw = phone_canvas()
    draw.text(content_xy(20, 56), "社区", font=font(22, True), fill=hex_to_rgb(TEXT_STRONG))
    rounded_rect(draw, [*content_xy(300, 54), *content_xy(366, 86)], 14, hex_to_rgb(PRIMARY))
    draw.text(content_xy(318, 62), "发布", font=font(12, True), fill="#FFFFFF")

    y = 100
    x = content_xy(16, 0)[0]
    for t, sel in [("发现", True), ("收藏", False), ("行程", False), ("图文", False)]:
        x += chip(draw, x, content_xy(0, y)[1], t, sel)

    posts = [
        (16, 150, 170, 210, "成都 4 日吃喝地图", "小途", "128", ACCENT),
        (200, 150, 170, 160, "西湖骑行半日线", "阿灵", "86", PRIMARY),
        (16, 380, 170, 170, "带父母去苏州", "陈陈", "64", PRIMARY_DARK),
        (200, 330, 170, 220, "重庆山城夜景", "旅行菌", "203", ACCENT),
    ]
    for x, y, w, h, title, author, likes, color in posts:
        rounded_rect(draw, [*content_xy(x, y), *content_xy(x + w, y + h)], 14, hex_to_rgb(SURFACE), hex_to_rgb(BORDER_LIGHT))
        rounded_rect(draw, [*content_xy(x, y), *content_xy(x + w, y + h - 70)], 14, hex_to_rgb(color))
        draw.text(content_xy(x + 12, y + h - 58), title, font=font(12, True), fill=hex_to_rgb(TEXT_STRONG))
        draw.text(content_xy(x + 12, y + h - 32), f"{author}  ·  ♥ {likes}", font=font(11), fill=hex_to_rgb(MUTED))

    draw_tab_bar(draw, img, 3)
    path = OUT / "04-community.png"
    img.convert("RGB").save(path, quality=95)
    return path


def screen_profile():
    img, draw = phone_canvas()
    draw.text(content_xy(20, 56), "我的", font=font(22, True), fill=hex_to_rgb(TEXT_STRONG))

    # avatar card
    y = 100
    rounded_rect(draw, [*content_xy(16, y), *content_xy(374, y + 100)], 18, hex_to_rgb(SURFACE), hex_to_rgb(BORDER_LIGHT))
    draw.ellipse([*content_xy(32, y + 22), *content_xy(96, y + 86)], fill=hex_to_rgb(PRIMARY))
    draw.text(content_xy(50, y + 40), "途", font=font(22, True), fill="#FFFFFF")
    draw.text(content_xy(112, y + 28), "途灵旅行者", font=font(16, True), fill=hex_to_rgb(TEXT_STRONG))
    draw.text(content_xy(112, y + 56), "去过 3 座城 · 累计 9 天", font=font(12), fill=hex_to_rgb(MUTED))

    # portrait
    y = 220
    rounded_rect(draw, [*content_xy(16, y), *content_xy(374, y + 120)], 16, hex_to_rgb(PRIMARY_BG))
    draw.text(content_xy(30, y + 16), "旅行画像", font=font(14, True), fill=hex_to_rgb(PRIMARY_DARK))
    draw.text(content_xy(30, y + 44), "偏好：美食 · 轻松 · 夜景", font=font(13), fill=hex_to_rgb(TEXT))
    draw.text(content_xy(30, y + 70), "常踩：人太多 · 过度购物", font=font(12), fill=hex_to_rgb(MUTED))
    draw.text(content_xy(30, y + 92), "下次生成将自动注入这些偏好", font=font(11), fill=hex_to_rgb(PRIMARY_DARK))

    # settings rows
    y = 360
    rows = [
        ("长辈模式", "大字号 / TTS / 简化表单", True),
        ("主动助手", "出行提醒与评价催促", True),
        ("深浅色", "跟随系统", False),
        ("行李清单", "出发前检查", False),
        ("隐私与合规", "数据与能力边界", False),
    ]
    for title, desc, on in rows:
        rounded_rect(draw, [*content_xy(16, y), *content_xy(374, y + 58)], 12, hex_to_rgb(SURFACE), hex_to_rgb(BORDER_LIGHT))
        draw.text(content_xy(30, y + 10), title, font=font(14, True), fill=hex_to_rgb(TEXT_STRONG))
        draw.text(content_xy(30, y + 32), desc, font=font(11), fill=hex_to_rgb(MUTED))
        # switch
        sx = content_xy(310, y + 18)[0]
        sy = content_xy(0, y + 18)[1]
        if on:
            rounded_rect(draw, [sx, sy, sx + 46, sy + 26], 13, hex_to_rgb(PRIMARY))
            draw.ellipse([sx + 22, sy + 3, sx + 44, sy + 23], fill="#FFFFFF")
        else:
            rounded_rect(draw, [sx, sy, sx + 46, sy + 26], 13, hex_to_rgb(BORDER))
            draw.ellipse([sx + 2, sy + 3, sx + 24, sy + 23], fill="#FFFFFF")
        y += 66

    draw_tab_bar(draw, img, 4)
    path = OUT / "05-profile.png"
    img.convert("RGB").save(path, quality=95)
    return path


def screen_chat():
    img, draw = phone_canvas()
    draw.text(content_xy(16, 54), "‹", font=font(24, True), fill=hex_to_rgb(PRIMARY_DARK))
    draw.text(content_xy(40, 58), "AI 聊聊", font=font(17, True), fill=hex_to_rgb(TEXT_STRONG))

    bubbles = [
        ("user", "成都带父母玩 3 天，节奏别太赶，有什么建议？"),
        ("ai", "可以按「午前轻逛 + 午后茶馆」安排：宽窄巷子、人民公园鹤鸣茶社、武侯祠锦里，少挪窝、多休息。需要的话我可以直接生成结构化行程。"),
        ("user", "第二天下雨怎么办？"),
        ("ai", "雨天优先室内：宽窄巷子廊道、博物馆/美术馆、春熙路商场；必要时我可按天气重排第 2 天。"),
    ]
    y = 110
    for role, text in bubbles:
        if role == "user":
            rounded_rect(draw, [*content_xy(90, y), *content_xy(374, y + 70)], 16, hex_to_rgb(ACCENT))
            # wrap roughly
            draw.text(content_xy(104, y + 14), text[:18], font=font(13), fill="#FFFFFF")
            if len(text) > 18:
                draw.text(content_xy(104, y + 36), text[18:36], font=font(13), fill="#FFFFFF")
            y += 86
        else:
            rounded_rect(draw, [*content_xy(16, y), *content_xy(340, y + 120)], 16, hex_to_rgb(SURFACE), hex_to_rgb(BORDER_LIGHT))
            # naive wrap
            line_h = 20
            for i in range(0, min(len(text), 72), 18):
                draw.text(content_xy(30, y + 14 + (i // 18) * line_h), text[i : i + 18], font=font(13), fill=hex_to_rgb(TEXT))
            y += 136

    # input
    y = 730
    rounded_rect(draw, [*content_xy(16, y), *content_xy(300, y + 44)], 18, hex_to_rgb("#FFF4ED"), hex_to_rgb(BORDER))
    draw.text(content_xy(30, y + 13), "问签证、美食、攻略…", font=font(12), fill=hex_to_rgb(PLACEHOLDER))
    rounded_rect(draw, [*content_xy(316, y), *content_xy(374, y + 44)], 18, hex_to_rgb(PRIMARY))
    draw.text(content_xy(330, y + 13), "发送", font=font(12, True), fill="#FFFFFF")

    path = OUT / "06-chat.png"
    img.convert("RGB").save(path, quality=95)
    return path


def build_montage(paths: list[Path]) -> Path:
    """3 phones side by side for a hero collage."""
    phones = [Image.open(p).convert("RGBA") for p in paths[:3]]
    # scale
    scale = 0.72
    phones = [p.resize((int(p.width * scale), int(p.height * scale)), Image.Resampling.LANCZOS) for p in phones]
    gap = 24
    tw = sum(p.width for p in phones) + gap * (len(phones) - 1) + 60
    th = max(p.height for p in phones) + 60
    canvas = Image.new("RGB", (tw, th), hex_to_rgb("#0B1F33"))
    x = 30
    for p in phones:
        y = (th - p.height) // 2
        canvas.paste(p, (x, y), p)
        x += p.width + gap
    out = OUT / "00-montage.png"
    canvas.save(out, quality=95)
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    paths = [
        screen_plan(),
        screen_preview(),
        screen_trips(),
        screen_community(),
        screen_profile(),
        screen_chat(),
    ]
    montage = build_montage([paths[0], paths[1], paths[2]])
    # also copy icon for cover
    icon_src = ASSETS / "icon.png"
    if icon_src.exists():
        icon = Image.open(icon_src).convert("RGBA").resize((256, 256), Image.Resampling.LANCZOS)
        icon.save(OUT / "icon.png")
    print("Generated:")
    for p in paths + [montage]:
        print(" ", p)
    return paths


if __name__ == "__main__":
    main()
