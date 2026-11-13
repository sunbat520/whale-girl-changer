#!/usr/bin/env python3
"""把三套动作素材统一生成 sprite 图集，并输出前端消费的 assets/burst/sets.js。

素材来源（只读）：

  A. 蓝发鲸鱼女仆_全部图片与GIF_分类合集/03_五组动作/<组>/<组>_动画.gif
     8 帧，443×443，自带 alpha                       → family v443「精细版」
  B. 蓝发鲸鱼女仆_全部素材分类合集/02_可播放GIF动画/<组>/<文件>.gif
     16 帧，约 315×311，不透明纯色底                  → family v315「简版」（需抠底）
  C. 蓝发鲸鱼女仆 · 图片与 GIF 完整合集/02_初版角色_反弹摔倒/GIF动画/蓝发鲸娘女仆撞玻璃反弹记.gif
     9 帧，138×138，自带 alpha                       → family impact「九宫格」
     注：九宫格是同一张立绘的 3×3 切块，按序播放是镜头往下扫，不是真动作。

产物：
  assets/burst/<id>.webp   每组一张图集（4×2 / 4×4 / 3×3）
  assets/burst/sets.js     window.BURST_SETS = [...]，app.js 直接消费

展示层按「高度铺满展示区」摆放（styles.css 的 .burst-frame），所以不再按身高做缩放：
两套画风的角色身高差约 4%，而任何 >1 的缩放都会把头发/脚裁掉。

app.js 不再硬编码帧数 / 网格 / 尺寸；改素材后重跑本脚本即可。
"""

from pathlib import Path
import json
import subprocess
import tempfile

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
DST = ROOT / "assets" / "burst"

SRC_A = Path("/Users/yaobinsun/Downloads/jyl-pet/蓝发鲸鱼女仆_全部图片与GIF_分类合集/03_五组动作")
SRC_B = Path("/Users/yaobinsun/Downloads/jyl-pet/蓝发鲸鱼女仆_全部素材分类合集/02_可播放GIF动画")
SRC_C = Path(
    "/Users/yaobinsun/Downloads/jyl-pet/蓝发鲸鱼女仆 · 图片与 GIF 完整合集"
    "/02_初版角色_反弹摔倒/GIF动画/蓝发鲸娘女仆撞玻璃反弹记.gif"
)

QUALITY = 90
COLS = 4  # 五组动作用 4 列；16 帧因此是 4×4，9 帧九宫格用 3×3

# (id, family, action, variant, gif 路径)
SOURCES = [
    ("walk-443", "v443", "walk", "精细版", SRC_A / "走路/走路_动画.gif"),
    ("wave-443", "v443", "wave", "精细版", SRC_A / "挥手/挥手_动画.gif"),
    ("jump-443", "v443", "jump", "精细版", SRC_A / "蹦跳/蹦跳_动画.gif"),
    ("sit-443", "v443", "sit", "精细版", SRC_A / "坐下/坐下_动画.gif"),
    ("fall-443", "v443", "fall", "精细版", SRC_A / "摔倒/摔倒_动画.gif"),
    ("walk-315", "v315", "walk", "简版", SRC_B / "走路/蓝发鲸尾女仆行走动画.gif"),
    ("wave-315", "v315", "wave", "简版", SRC_B / "挥手/蓝发鲸尾女仆挥手动画.gif"),
    ("jump-315", "v315", "jump", "简版", SRC_B / "跳跃/蓝发鲸尾女仆跳跃动画.gif"),
    ("sit-315", "v315", "sit", "简版", SRC_B / "坐下/蓝发鲸尾女仆优雅落座动画.gif"),
    ("fall-315", "v315", "fall", "简版", SRC_B / "跌倒/蓝发鲸尾女仆跌倒动画.gif"),
    ("impact-grid", "impact", "impact", "九宫格", SRC_C),
]

# 需要抠底的 family（GIF 底色不透明）
CUTOUT_FAMILIES = {"v315"}


def cutout(img: Image.Image) -> Image.Image:
    """从四角泛滥填充去掉纯色背景，返回带 alpha 的图。"""
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


def load_frames(path: Path, cut: bool) -> list[Image.Image]:
    gif = Image.open(path)
    frames = []
    for i in range(getattr(gif, "n_frames", 1)):
        gif.seek(i)
        frames.append(cutout(gif) if cut else gif.convert("RGBA").copy())
    return frames


def main() -> int:
    if not all(p.exists() for _, _, _, _, p in SOURCES):
        for _, _, _, _, p in SOURCES:
            if not p.exists():
                print(f"素材不存在：{p}", flush=True)
        return 1

    DST.mkdir(parents=True, exist_ok=True)

    loaded = []
    for set_id, family, action, variant, path in SOURCES:
        frames = load_frames(path, cut=family in CUTOUT_FAMILIES)
        loaded.append((set_id, family, action, variant, frames))

    entries = [{"id": "impact-pose", "family": "impact", "action": "impact",
                "variant": "姿态帧", "kind": "pose", "total": 10}]

    for set_id, family, action, variant, frames in loaded:
        total = len(frames)
        cols = 3 if set_id == "impact-grid" else COLS
        rows = (total + cols - 1) // cols
        if total != cols * rows:
            print(f"{set_id}：{total} 帧铺不满 {cols}×{rows} 网格", flush=True)
            return 1

        cw, ch = frames[0].size
        sheet = Image.new("RGBA", (cw * cols, ch * rows), (0, 0, 0, 0))
        for i, frame in enumerate(frames):
            row, col = divmod(i, cols)
            sheet.paste(frame, (col * cw, row * ch))

        out = DST / f"{set_id}.webp"
        with tempfile.TemporaryDirectory() as tmp:
            png = Path(tmp) / "sheet.png"
            sheet.save(png, optimize=True)
            subprocess.run(
                ["cwebp", "-quiet", "-q", str(QUALITY), "-alpha_q", "100", "-m", "6",
                 str(png), "-o", str(out)],
                check=True,
            )

        entries.append({
            "id": set_id,
            "family": family,
            "action": action,
            "variant": variant,
            "kind": "sheet",
            "sheet": f"assets/burst/{set_id}.webp",
            "cols": cols,
            "rows": rows,
            "total": total,
            "ar": round(cw / ch, 4),
        })

        print(f"{set_id:12s} {total:2d} 帧 {cw}×{ch} → {cols}×{rows} 图集 "
              f"{sheet.width}×{sheet.height}（{out.stat().st_size / 1024:.0f}KB）")

    # 连招：同一 family 的五套动作按顺序串起来，不跨 family 混（否则画风中途跳变）
    order = ["walk", "wave", "jump", "sit", "fall"]
    for family, variant in (("v443", "精细版"), ("v315", "简版")):
        total = sum(e["total"] for e in entries
                    if e["family"] == family and e["action"] in order)
        entries.append({"id": f"combo-{family}", "family": family, "action": "combo",
                        "variant": variant, "kind": "combo", "total": total})
        print(f"combo-{family:5s} {total:2d} 帧（{' → '.join(order)}）")

    sets_js = DST / "sets.js"
    sets_js.write_text(
        "// 由 tools/sync_actions.py 生成，不要手改。\n"
        "// 每组动作的帧数 / 网格 / 尺寸都从图集实测得出，app.js 只消费这份数据。\n"
        "window.BURST_SETS = "
        + json.dumps(entries, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"输出 {sets_js}（{len(entries)} 组）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
