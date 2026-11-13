#!/usr/bin/env python3
"""whale-girl-changer-v2 — 从单张 G cup 源图生成 B–G 六档「挤压图」。

原理：只在胸部窗口内做逆映射位移（横向向中缝挤压 + 纵向轻压扁），
窗口边界位移归零，窗口外像素原样保留。因此脸、发型、身高、背景与
源图完全一致，仅胸部随档位收窄 / 压平。

依赖：PIL + numpy + scipy（项目内 .venv-img）。
用法：.venv-img/bin/python tools/squeeze_cups.py
"""
import os

import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "source", "g-jiya.jpeg")
ASSETS = os.path.join(ROOT, "assets")
PREVIEW = os.path.join(ROOT, "tools", "preview")

# ---- 胸部窗口（按 1792x2400 源图坐标） ----
CX = 895.0
R = 600.0
Y0, Y1 = 1055.0, 1435.0
YC = (Y0 + Y1) / 2.0

# ---- 输出 ----
OUT_WIDTH = 1280
JPEG_QUALITY = 88

# ---- 六档：a_h 越大，压得越小；G 为源图不压 ----
CUPS = [
    ("b", 0.85),
    ("c", 0.68),
    ("d", 0.51),
    ("e", 0.34),
    ("f", 0.17),
    ("g", 0.00),
]
AV_RATIO = 0.65


def bell(u):
    """raised-cosine 钟形窗：|u|<1 时为 (1+cos(pi u))/2，其余为 0。"""
    a = np.abs(u)
    out = np.zeros_like(u, dtype=np.float64)
    m = a < 1.0
    out[m] = 0.5 * (1.0 + np.cos(np.pi * u[m]))
    return out


def warp(arr, a_h, a_v):
    H, W = arr.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)

    wy = bell((yy - YC) / ((Y1 - Y0) / 2.0))
    bx = (xx - CX) / R
    wx = bell(bx)
    w = wy * wx

    # 横向向中缝挤压：中心与窗口边界都不动
    xs = xx - a_h * w * (xx - CX) * wx
    # 纵向向窗口中心轻压扁
    ys = yy - a_v * w * (yy - YC) * wy

    # 单调性校验：每一行的横向映射必须严格递增，避免采样折叠
    dx = np.diff(xs, axis=1)
    if dx.min() <= 0:
        raise RuntimeError(f"横向映射出现折叠 (a_h={a_h})，请降低挤压强度")

    xs = np.clip(xs, 0, W - 1.001)
    ys = np.clip(ys, 0, H - 1.001)
    coords = np.array([ys.ravel(), xs.ravel()])

    out = np.empty_like(arr)
    for c in range(3):
        out[..., c] = map_coordinates(
            arr[..., c], coords, order=1, mode="nearest"
        ).reshape(H, W)
    return out


def main():
    os.makedirs(ASSETS, exist_ok=True)
    os.makedirs(PREVIEW, exist_ok=True)

    src = Image.open(SRC).convert("RGB")
    W, H = src.size
    out_h = round(OUT_WIDTH * H / W)
    arr = np.asarray(src, dtype=np.float64)

    frames = {}
    for name, a_h in CUPS:
        a_v = a_h * AV_RATIO
        warped = warp(arr, a_h, a_v) if a_h > 0 else arr
        img = Image.fromarray(np.clip(warped, 0, 255).astype(np.uint8))
        img = img.resize((OUT_WIDTH, out_h), Image.LANCZOS)
        out_path = os.path.join(ASSETS, f"{name}.jpeg")
        img.save(out_path, "JPEG", quality=JPEG_QUALITY, subsampling=1)
        frames[name] = img
        print(f"saved {name}.jpeg  a_h={a_h:.2f}  {img.size}")

    # 窗口外像素必须与 G 完全一致
    g_full = np.asarray(src, dtype=np.int16)
    for name, a_h in CUPS[:-1]:
        warped = warp(arr, a_h, a_h * AV_RATIO).astype(np.int16)
        yy, xx = np.mgrid[0:H, 0:W]
        wy = bell((yy - YC) / ((Y1 - Y0) / 2.0))
        wx = bell((xx - CX) / R)
        outside = (wy * wx) < 1e-9
        diff = np.abs(warped[outside] - g_full[outside]).max()
        print(f"outside-diff {name}: {diff}")

    # 预览：六档胸部竖排 + B/G 全身对照
    y0, y1 = 940, 1600
    tiles = [
        frames[n].crop((int(150 * OUT_WIDTH / W), int(y0 * out_h / H),
                        int(1650 * OUT_WIDTH / W), int(y1 * out_h / H)))
        for n, _ in CUPS
    ]
    tw, th = tiles[0].size
    sheet = Image.new("RGB", (tw, th * len(tiles)), "white")
    for i, t in enumerate(tiles):
        sheet.paste(t, (0, i * th))
    sheet.save(os.path.join(PREVIEW, "cups_vertical.jpg"), quality=86)

    b = frames["b"]
    g = frames["g"]
    cmp_img = Image.new("RGB", (b.width * 2 + 16, b.height), "white")
    cmp_img.paste(b, (0, 0))
    cmp_img.paste(g, (b.width + 16, 0))
    cmp_img.resize((cmp_img.width // 2, cmp_img.height // 2), Image.LANCZOS).save(
        os.path.join(PREVIEW, "compare_bg.jpg"), quality=86
    )

    print("preview:", PREVIEW)


if __name__ == "__main__":
    main()
