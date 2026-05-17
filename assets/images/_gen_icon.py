"""One-shot icon generator for MarginPlant.

    py assets/images/_gen_icon.py

Generates icon.png + adaptive-icon.png + splash.png matching the MarginPlant
web brand (emerald #10b981 + white two-leaf sprout mark).
"""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

EMERALD = (16, 185, 129)       # #10b981 — primary brand
EMERALD_DARK = (5, 150, 105)   # #059669 — gradient bottom
BG_DARK = (13, 13, 13)         # #0d0d0d — splash bg
WHITE = (255, 255, 255, 255)


def diag_gradient(size: int, top: tuple, bot: tuple) -> Image.Image:
    img = Image.new("RGB", (size, size), top)
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            r = int(top[0] * (1 - t) + bot[0] * t)
            g = int(top[1] * (1 - t) + bot[1] * t)
            b = int(top[2] * (1 - t) + bot[2] * t)
            px[x, y] = (r, g, b)
    return img


def rounded_mask(size: int, radius_pct: float) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    r = int(size * radius_pct)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=255)
    return mask


def draw_leaf_polygon(area: int, tilt_deg: float, mirror: bool) -> Image.Image:
    """Build one stylized leaf as a transparent RGBA tile.

    `area` is the square canvas the leaf is drawn into. The leaf points up
    and is rotated by `tilt_deg`. If `mirror` is True the leaf is mirrored
    horizontally first so the curved spine reads as a right-side leaf.
    """
    leaf_w = int(area * 0.46)
    leaf_h = int(area * 0.95)
    tile = Image.new("RGBA", (area, area), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)

    # Build a teardrop / leaf silhouette as a polygon. Top is a sharp point,
    # bottom rounds off. Centered horizontally inside the tile.
    cx = area // 2
    top_y = (area - leaf_h) // 2
    bot_y = top_y + leaf_h
    half = leaf_w // 2

    # Sample bezier-ish silhouette using a simple parametric curve.
    points = []
    steps = 60
    for i in range(steps + 1):
        t = i / steps
        # Width profile: narrow at top (point), bulges around 60% down, narrows again.
        # f(t) = sin(pi * t) ^ 0.7 gives a leaf-like fullness.
        import math
        width_factor = math.sin(math.pi * t) ** 0.7
        x_off = half * width_factor
        y = top_y + int(leaf_h * t)
        points.append((cx + x_off, y))
    # mirror back along the other side
    for i in range(steps, -1, -1):
        t = i / steps
        import math
        width_factor = math.sin(math.pi * t) ** 0.7
        x_off = half * width_factor
        y = top_y + int(leaf_h * t)
        points.append((cx - x_off, y))

    d.polygon(points, fill=WHITE)

    # Central spine vein for detail (thin emerald line down the middle).
    spine_w = max(2, area // 110)
    d.line([(cx, top_y + int(leaf_h * 0.08)), (cx, bot_y - int(leaf_h * 0.12))],
           fill=EMERALD + (255,), width=spine_w)

    if mirror:
        tile = tile.transpose(Image.FLIP_LEFT_RIGHT)
    if tilt_deg != 0:
        tile = tile.rotate(tilt_deg, resample=Image.BICUBIC, expand=False)
    return tile


def draw_sprout(canvas: Image.Image, area_size: int, center: tuple[int, int]) -> None:
    """Paint a two-leaf sprout into `canvas`, centered at `center`,
    fitting inside an area of `area_size` square.
    """
    cx, cy = center

    # Each leaf tile is half the area wide; we tilt them ~30° outward.
    leaf_area = int(area_size * 0.62)

    left_leaf = draw_leaf_polygon(leaf_area, tilt_deg=32, mirror=False)
    right_leaf = draw_leaf_polygon(leaf_area, tilt_deg=-32, mirror=True)

    # Position leaves so their bases meet near the bottom-center, tips
    # splayed outward and upward.
    half = leaf_area // 2
    # vertical offset — push leaves up so the stem has room below
    leaf_top = cy - half - int(area_size * 0.05)
    left_x = cx - leaf_area + int(area_size * 0.12)
    right_x = cx - int(area_size * 0.12)

    canvas.alpha_composite(left_leaf, (left_x, leaf_top))
    canvas.alpha_composite(right_leaf, (right_x, leaf_top))

    # Stem: a thick rounded vertical line below the leaves
    stem_top = cy + int(area_size * 0.12)
    stem_bot = cy + int(area_size * 0.42)
    stem_w = max(6, int(area_size * 0.045))
    d = ImageDraw.Draw(canvas)
    d.line([(cx, stem_top), (cx, stem_bot)], fill=WHITE, width=stem_w)
    # rounded cap dots so the stem doesn't look chopped
    cap_r = stem_w // 2
    d.ellipse((cx - cap_r, stem_top - cap_r, cx + cap_r, stem_top + cap_r), fill=WHITE)
    d.ellipse((cx - cap_r, stem_bot - cap_r, cx + cap_r, stem_bot + cap_r), fill=WHITE)


def make_icon(size: int = 1024) -> Image.Image:
    """Full-bleed iOS / Play Store icon: emerald gradient square with sprout."""
    bg = diag_gradient(size, EMERALD, EMERALD_DARK).convert("RGBA")
    draw_sprout(bg, area_size=size, center=(size // 2, size // 2))
    return bg


def make_adaptive_foreground(size: int = 1024) -> Image.Image:
    """Android adaptive foreground — transparent canvas with sprout sized
    into the safe zone (~66% of canvas). Background colour set in app.json.
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    safe = int(size * 0.66)
    draw_sprout(img, area_size=safe, center=(size // 2, size // 2))
    return img


def make_splash(width: int = 1242, height: int = 2436) -> Image.Image:
    """Dark splash with the emerald sprout badge centered ~38% from top."""
    img = Image.new("RGBA", (width, height), BG_DARK + (255,))
    badge_size = int(min(width, height) * 0.38)
    badge = diag_gradient(badge_size, EMERALD, EMERALD_DARK).convert("RGBA")
    mask = rounded_mask(badge_size, radius_pct=0.24)
    badge.putalpha(mask)
    bx = (width - badge_size) // 2
    by = int(height * 0.38) - badge_size // 2
    img.alpha_composite(badge, (bx, by))
    draw_sprout(img, area_size=badge_size, center=(bx + badge_size // 2, by + badge_size // 2))
    return img


def main() -> None:
    icon = make_icon(1024)
    icon.save(os.path.join(OUT_DIR, "icon.png"), "PNG")
    print("wrote icon.png", icon.size)

    adaptive = make_adaptive_foreground(1024)
    adaptive.save(os.path.join(OUT_DIR, "adaptive-icon.png"), "PNG")
    print("wrote adaptive-icon.png", adaptive.size)

    splash = make_splash(1242, 2436)
    splash.save(os.path.join(OUT_DIR, "splash.png"), "PNG")
    print("wrote splash.png", splash.size)


if __name__ == "__main__":
    main()
