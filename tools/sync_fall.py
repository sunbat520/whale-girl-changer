#!/usr/bin/env python3
"""把「跌倒」16 帧动作序列做成 4×4 sprite 图集，供主题三的「真实动作帧」使用。

素材来源（只读）：
  /Users/yaobinsun/Downloads/jyl-pet/蓝发鲸鱼女仆_全部素材分类合集/02_可播放GIF动画/跌倒/蓝发鲸尾女仆跌倒动画.gif

GIF 背景是不透明的淡粉纯色，逐帧从四角泛滥填充去掉，输出带 alpha 的 4×4 图集 WebP。
app.js 里 BURST_ACTION_COLS / BURST_ACTION_TOTAL 必须与这里的 4 / 16 一致。

改素材后重跑本脚本即可。
"""

from pathlib import Path
import subprocess
import tempfile

from PIL import Image, ImageDraw

SRC = Path(
    "/Users/yaobinsun/Downloads/jyl-pet/蓝发鲸鱼女仆_全部素材分类合集"
    "/02_可播放GIF动画/跌倒/蓝发鲸尾女仆跌倒动画.gif"
)
DST = Path(__file__).resolve().parent.parent / "assets" / "impact" / "fall-16"
COLS = 4
ROWS = 4
QUALITY = 90


def cutout(img: Image.Image) -> Image.Image:
    """从四角泛滥填充掉纯色背景，返回带 alpha 的图。"""
    im = img.convert("RGBA")
    w, h = im.size
    for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if im.getpixel(seed)[3] > 0:
            ImageDraw.floodfill(im, seed, (0, 0, 0, 0), thresh=26)
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if 0 < a < 40:
                px[x, y] = (r, g, b, 0)
    return im


def main() -> int:
    if not SRC.exists():
        print(f"素材不存在：{SRC}", flush=True)
        return 1

    gif = Image.open(SRC)
    frames = []
    for i in range(getattr(gif, "n_frames", 1)):
        gif.seek(i)
        frames.append(cutout(gif))

    if len(frames) != COLS * ROWS:
        print(f"帧数与网格不符：{len(frames)} 帧，网格 {COLS}×{ROWS}", flush=True)
        return 1

    cw, ch = frames[0].size
    sheet = Image.new("RGBA", (cw * COLS, ch * ROWS), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        row, col = divmod(i, COLS)
        sheet.paste(frame, (col * cw, row * ch))

    DST.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "sheet.png"
        sheet.save(png, optimize=True)
        out = DST / "sheet.webp"
        subprocess.run(
            ["cwebp", "-quiet", "-q", str(QUALITY), "-alpha_q", "100", "-m", "6",
             str(png), "-o", str(out)],
            check=True,
        )

    print(f"帧数 {len(frames)}，格子 {cw}×{ch}，图集 {sheet.width}×{sheet.height}")
    print(f"输出 {DST / 'sheet.webp'}（{out.stat().st_size / 1024:.0f}KB）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
