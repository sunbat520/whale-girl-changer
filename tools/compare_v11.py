#!/usr/bin/env python3
"""对比检查：5 图并排 + 相邻档位叠加差分（看重影/位移）。"""
from PIL import Image, ImageChops, ImageDraw
import numpy as np
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALIGNED = os.path.join(ROOT, "assets", "aligned")
OUT = os.path.join(ROOT, "tools")
FILES = ["a.jpeg", "c.jpeg", "d.jpeg", "g.jpeg", "h.jpeg"]
LV = ["Lv1", "Lv2", "Lv3", "Lv4", "Lv5"]
SCALE = 0.26

imgs = [Image.open(os.path.join(ALIGNED, f)).convert("RGB") for f in FILES]
W, H = imgs[0].size
tw, th = int(W * SCALE), int(H * SCALE)

# ---- 1. 并排 ----
gap = 8
sheet = Image.new("RGB", (tw * 5 + gap * 6, th + 30), (240, 240, 240))
d = ImageDraw.Draw(sheet)
for i, im in enumerate(imgs):
    ox = gap + i * (tw + gap)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (ox, 26))
    d.text((ox + 4, 8), LV[i], fill=(0, 0, 0))
    for gx, col in [(538, (255, 0, 0)), (806, (0, 120, 255)), (1054, (0, 150, 0))]:
        x = ox + int(gx * SCALE)
        d.line([(x, 26), (x, th + 26)], fill=col, width=1)
sheet.save(os.path.join(OUT, "check_row.png"))
print("check_row.png", sheet.size)

# ---- 2. 相邻叠加差分 ----
pairs = [(2, 3, "Lv3-d vs Lv4-g"), (3, 4, "Lv4-g vs Lv5-h"), (0, 2, "Lv1-a vs Lv3-d")]
tiles = []
for i, j, label in pairs:
    a = np.asarray(imgs[i], np.int16)
    b = np.asarray(imgs[j], np.int16)
    diff = np.abs(a - b).sum(axis=2)
    vis = np.zeros((H, W, 3), np.uint8)
    vis[:, :, 0] = np.clip(255 - diff, 0, 255) * 0 + 255
    # 只在差异处着色：a 偏红，b 偏青
    m = diff > 60
    vis[:, :, 0] = np.where(m, 255, 255)
    vis[:, :, 1] = np.where(m, 60, 255)
    vis[:, :, 2] = np.where(m, 60, 255)
    # 叠加半透明
    blend = (a * 0.5 + b * 0.5).astype(np.uint8)
    vis2 = np.where(m[:, :, None], blend, vis)
    tile = Image.fromarray(vis2.astype(np.uint8))
    tiles.append((label, tile, float(m.mean() * 100)))

sheet2 = Image.new("RGB", (tw * 3 + gap * 4, th + 30), (240, 240, 240))
d2 = ImageDraw.Draw(sheet2)
for k, (label, tile, pct) in enumerate(tiles):
    ox = gap + k * (tw + gap)
    sheet2.paste(tile.resize((tw, th), Image.LANCZOS), (ox, 26))
    d2.text((ox + 4, 8), f"{label}  差异={pct:.1f}%", fill=(0, 0, 0))
sheet2.save(os.path.join(OUT, "check_diff.png"))
print("check_diff.png", sheet2.size)
for label, _, pct in tiles:
    print(f"  {label}: 差异像素 {pct:.1f}%")
