"""Prepare premium phone product shots for the pitch deck."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

DOCS = Path(__file__).resolve().parent
OUT = DOCS / "screenshots"
ASSETS = Path(r"C:\Users\10437\.cursor\projects\d-Claude-proj-ai-travel-assistant\assets")
APP_ASSETS = Path(__file__).resolve().parents[1] / "apps" / "mobile" / "assets"

CREAM = (255, 248, 240)
TEAL_DARK = (11, 45, 48)
WARM = (255, 236, 220)


def shadow_canvas(fg: Image.Image, pad=48, blur=28, offset=(10, 18), opacity=90) -> Image.Image:
    """Place phone art on transparent canvas with soft drop shadow."""
    fw, fh = fg.size
    cw, ch = fw + pad * 2 + abs(offset[0]), fh + pad * 2 + abs(offset[1])
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))

    # shadow mask from alpha
    alpha = fg.split()[-1] if fg.mode == "RGBA" else Image.new("L", fg.size, 255)
    shadow = Image.new("RGBA", fg.size, (20, 40, 38, opacity))
    shadow.putalpha(alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    canvas.paste(shadow, (pad + offset[0], pad + offset[1]), shadow)
    canvas.paste(fg, (pad, pad), fg if fg.mode == "RGBA" else None)
    return canvas


def on_stage(phone: Image.Image, bg_rgb=CREAM, size=(900, 1600)) -> Image.Image:
    """Centered product shot on brand stage background."""
    stage = Image.new("RGB", size, bg_rgb)
    draw = ImageDraw.Draw(stage)
    # soft radial-like vignette bands
    for i, color in enumerate([(255, 242, 230), (232, 248, 245), (255, 248, 240)]):
        y0 = int(size[1] * (0.15 + i * 0.22))
        draw.ellipse([-200, y0, size[0] + 200, y0 + 700], fill=color)

    ph = shadow_canvas(phone.convert("RGBA"), pad=36, blur=22, offset=(8, 16), opacity=70)
    # fit
    max_h = int(size[1] * 0.92)
    max_w = int(size[0] * 0.72)
    ratio = min(max_w / ph.width, max_h / ph.height)
    ph = ph.resize((int(ph.width * ratio), int(ph.height * ratio)), Image.Resampling.LANCZOS)
    x = (size[0] - ph.width) // 2
    y = (size[1] - ph.height) // 2
    stage = stage.convert("RGBA")
    stage.paste(ph, (x, y), ph)
    return stage.convert("RGB")


def load_rgb(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGBA")
    # trim near-white margins if present (keeps phone)
    return img


def collage_three(paths: list[Path], out: Path, bg=TEAL_DARK):
    phones = [load_rgb(p) for p in paths]
    # normalize heights
    target_h = 1400
    resized = []
    for p in phones:
        r = target_h / p.height
        resized.append(p.resize((int(p.width * r), target_h), Image.Resampling.LANCZOS))

    gap = 40
    side_scale = 0.88
    sides = [
        resized[0].resize(
            (int(resized[0].width * side_scale), int(resized[0].height * side_scale)),
            Image.Resampling.LANCZOS,
        ),
        resized[2].resize(
            (int(resized[2].width * side_scale), int(resized[2].height * side_scale)),
            Image.Resampling.LANCZOS,
        ),
    ]
    center = resized[1]

    tw = sides[0].width + center.width + sides[1].width + gap * 2 + 160
    th = target_h + 180
    canvas = Image.new("RGB", (tw, th), bg)
    # subtle glow
    draw = ImageDraw.Draw(canvas)
    draw.ellipse([tw // 2 - 420, th // 2 - 200, tw // 2 + 420, th // 2 + 520], fill=(18, 70, 72))

    def paste_phone(img, x, y):
        sh = shadow_canvas(img, pad=30, blur=24, offset=(6, 14), opacity=100)
        canvas.paste(sh, (x - 30, y - 30), sh)

    y_side = (th - sides[0].height) // 2 + 40
    paste_phone(sides[0], 80, y_side)
    paste_phone(center, 80 + sides[0].width + gap, (th - center.height) // 2)
    paste_phone(sides[1], 80 + sides[0].width + gap + center.width + gap, y_side)
    canvas = ImageEnhance.Contrast(canvas).enhance(1.05)
    canvas.save(out, quality=95)
    print("collage", out)


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    mapping = {
        "hq-guide.png": ASSETS / "tuling-first-guide-mockup.png",
        "hq-trips.png": ASSETS / "tuling-trips-mockup.png",
        "hq-chat.png": ASSETS / "tuling-chat-mockup.png",
        "hq-community.png": ASSETS / "tuling-community-masonry-mockup.png",
        "hq-plus.png": ASSETS / "tuling-center-plus-tabbar.png",
    }
    staged = {}
    for name, src in mapping.items():
        if not src.exists():
            print("missing", src)
            continue
        img = load_rgb(src)
        # save transparent-ish product cutout with shadow
        cut = shadow_canvas(img, pad=40, blur=26, offset=(10, 18), opacity=85)
        cut_path = OUT / name
        cut.convert("RGBA").save(cut_path)
        # stage version for slides that need solid bg
        stage = on_stage(img, CREAM if "community" not in name else WARM)
        stage_path = OUT / name.replace("hq-", "stage-")
        stage.save(stage_path, quality=95)
        staged[name] = cut_path
        print("ok", name, "->", cut_path.name, stage_path.name)

    # splash
    splash = APP_ASSETS / "splash.png"
    if splash.exists():
        sp = load_rgb(splash)
        # phone-less splash as full poster
        poster = Image.new("RGB", (1200, 1800), CREAM)
        # cover
        sw, sh = sp.size
        scale = max(1200 / sw, 1800 / sh)
        sp2 = sp.resize((int(sw * scale), int(sh * scale)), Image.Resampling.LANCZOS)
        left = (sp2.width - 1200) // 2
        top = (sp2.height - 1800) // 2
        sp2 = sp2.crop((left, top, left + 1200, top + 1800))
        sp2.save(OUT / "poster-splash.png", quality=95)

    # splash phone from earlier generator if exists
    phone_splash = OUT / "00-splash-phone.png"
    if phone_splash.exists():
        img = load_rgb(phone_splash)
        shadow_canvas(img).save(OUT / "hq-splash.png")
        on_stage(img, CREAM).save(OUT / "stage-splash.png", quality=95)

    # cover collage: guide / trips / community
    trio = [OUT / "hq-guide.png", OUT / "hq-trips.png", OUT / "hq-community.png"]
    # use originals for sharper collage
    srcs = [
        ASSETS / "tuling-first-guide-mockup.png",
        ASSETS / "tuling-trips-mockup.png",
        ASSETS / "tuling-community-masonry-mockup.png",
    ]
    if all(p.exists() for p in srcs):
        collage_three(srcs, OUT / "hero-collage.png", bg=(12, 40, 42))

    # icon
    icon = APP_ASSETS / "icon.png"
    if icon.exists():
        Image.open(icon).convert("RGBA").resize((512, 512), Image.Resampling.LANCZOS).save(OUT / "icon.png")

    print("done ->", OUT)


if __name__ == "__main__":
    # inline splash frame helper to avoid import cycle
    from PIL import Image as Im, ImageDraw as Id

    splash = APP_ASSETS / "splash.png"
    if splash.exists():
        W, H, R, pad = 390, 844, 36, 18
        s = Im.open(splash).convert("RGBA")
        sw, sh = s.size
        scale = max(W / sw, H / sh)
        s = s.resize((int(sw * scale), int(sh * scale)), Im.Resampling.LANCZOS)
        left, top = (s.width - W) // 2, (s.height - H) // 2
        s = s.crop((left, top, left + W, top + H))
        img = Im.new("RGBA", (W + pad * 2, H + pad * 2), (0, 0, 0, 0))
        shadow = Im.new("RGBA", img.size, (0, 0, 0, 0))
        sd = Id.Draw(shadow)
        sd.rounded_rectangle(
            [pad + 6, pad + 10, pad + W + 6, pad + H + 10],
            radius=R + 4,
            fill=(42, 90, 84, 50),
        )
        img = Im.alpha_composite(img, shadow)
        frame = Im.new("RGBA", img.size, (0, 0, 0, 0))
        fd = Id.Draw(frame)
        fd.rounded_rectangle(
            [pad - 3, pad - 3, pad + W + 3, pad + H + 3],
            radius=R + 3,
            fill="#1A2A36",
        )
        img = Im.alpha_composite(img, frame)
        mask = Im.new("L", (W, H), 0)
        Id.Draw(mask).rounded_rectangle([0, 0, W, H], radius=R, fill=255)
        img.paste(s, (pad, pad), mask)
        Id.Draw(img).rounded_rectangle(
            [pad + W // 2 - 48, pad + 10, pad + W // 2 + 48, pad + 26],
            radius=10,
            fill="#1A2A36",
        )
        OUT.mkdir(parents=True, exist_ok=True)
        img.save(OUT / "00-splash-phone.png")

    main()
