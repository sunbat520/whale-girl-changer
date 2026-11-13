#!/usr/bin/env python3
"""把动作素材生成 sprite 图集，把人物造型图做成人物卡，并输出前端消费的 assets/burst/sets.js。

素材来源（只读）：

  动作 A. 蓝发鲸鱼女仆_全部图片与GIF_分类合集/03_五组动作/<组>/<组>_动画.gif
          8 帧，443×443，自带 alpha
  人物卡 B. 蓝发鲸鱼女仆_全部图片与GIF_分类合集/01_人物原图与造型修改/*.png
          944×1665，白底无 alpha，逐张四角泛滥填充抠底后缩到 720 宽
          注：同目录的 640.png 是 492×867 低清版且带水印，不用。

产物：
  assets/burst/<id>.webp   每组动作一张图集（4×2）
  assets/burst/card-N.webp 三张人物卡
  assets/burst/sets.js     window.BURST_SETS / window.BURST_CARDS，app.js 直接消费

展示层按「高度铺满展示区」摆放（styles.css 的 .burst-frame / .rush-figure），
所以不按身高做缩放补偿：任何 >1 的缩放都会把头发或脚裁掉。

改素材后重跑本脚本即可，前端不用动。
"""

from pathlib import Path
import json
import subprocess
import tempfile

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
DST = ROOT / "assets" / "burst"

SRC_ACTIONS = Path(
    "/Users/yaobinsun/Downloads/jyl-pet/蓝发鲸鱼女仆_全部图片与GIF_分类合集/03_五组动作"
)
SRC_CARDS = Path(
    "/Users/yaobinsun/Downloads/jyl-pet/蓝发鲸鱼女仆_全部图片与GIF_分类合集/01_人物原图与造型修改"
)

QUALITY = 90
CARD_WIDTH = 720
COLS = 4  # 8 帧 → 4×2

# (输出 id, action, gif 相对路径)
ACTIONS = [
    ("walk", "walk", "走路/走路_动画.gif"),
    ("wave", "wave", "挥手/挥手_动画.gif"),
    ("jump", "jump", "蹦跳/蹦跳_动画.gif"),
    ("sit", "sit", "坐下/坐下_动画.gif"),
    ("fall", "fall", "摔倒/摔倒_动画.gif"),
]

# 人物卡：按造型由小到大排，label 只用于按钮文案
CARDS = [
    ("card-1", "微澜", "image(20261113-021206).png"),
    ("card-2", "丰满", "same_scene_and_pose_a_detailed_anime_style_illus.png"),
    ("card-3", "汹涌", "a_highly_detailed_anime_illustration_identical_cha.png"),
]

# 连招顺序 = 按钮顺序（走路 → 挥手 → 蹦跳 → 摔倒 → 坐下）
COMBO_ORDER = ["walk", "wave", "jump", "fall", "sit"]


def cutout(img: Image.Image) -> Image.Image:
    """从四角泛滥填充去掉纯色背景，返回带 alpha 的图。"""
    im = img.convert("RGBA")
    w, h = im.size
    for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if im.getpixel(seed)[3] > 0:
            ImageDraw.floodfill(im, seed, (0, 0, 0, 0), thresh=24)
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if 0 < a < 40:
                px[x, y] = (r, g, b, 0)
    return im


def to_webp(img: Image.Image, out: Path) -> int:
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "src.png"
        img.save(png, optimize=True)
        subprocess.run(
            ["cwebp", "-quiet", "-q", str(QUALITY), "-alpha_q", "100", "-m", "6",
             str(png), "-o", str(out)],
            check=True,
        )
    return out.stat().st_size


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)

    # 1. 动作图集
    entries = [{"id": "impact-pose", "action": "impact", "variant": "姿态帧",
                "kind": "pose", "total": 10}]
    sheet_totals = {}

    for set_id, action, rel in ACTIONS:
        path = SRC_ACTIONS / rel
        if not path.exists():
            print(f"素材不存在：{path}", flush=True)
            return 1

        gif = Image.open(path)
        frames = []
        for i in range(getattr(gif, "n_frames", 1)):
            gif.seek(i)
            frames.append(gif.convert("RGBA").copy())

        total = len(frames)
        rows = (total + COLS - 1) // COLS
        if total != COLS * rows:
            print(f"{set_id}：{total} 帧铺不满 {COLS}×{rows} 网格", flush=True)
            return 1

        cw, ch = frames[0].size
        sheet = Image.new("RGBA", (cw * COLS, ch * rows), (0, 0, 0, 0))
        for i, frame in enumerate(frames):
            row, col = divmod(i, COLS)
            sheet.paste(frame, (col * cw, row * ch))

        out = DST / f"{set_id}.webp"
        size = to_webp(sheet, out)
        sheet_totals[action] = total

        entries.append({
            "id": set_id,
            "action": action,
            "kind": "sheet",
            "sheet": f"assets/burst/{set_id}.webp",
            "cols": COLS,
            "rows": rows,
            "total": total,
            "ar": round(cw / ch, 4),
        })
        print(f"{set_id:6s} {total:2d} 帧 {cw}×{ch} → {COLS}×{rows} 图集 "
              f"{sheet.width}×{sheet.height}（{size / 1024:.0f}KB）")

    # 2. 连招：五套动作按按钮顺序串成一条长序列，不跨版本混
    combo_total = sum(sheet_totals.get(a, 0) for a in COMBO_ORDER)
    entries.append({"id": "combo", "action": "combo", "variant": "连招",
                    "kind": "combo", "total": combo_total})
    print(f"combo  {combo_total:2d} 帧（{' → '.join(COMBO_ORDER)}）")

    # 3. 人物卡
    cards = []
    for card_id, label, name in CARDS:
        path = SRC_CARDS / name
        if not path.exists():
            print(f"素材不存在：{path}", flush=True)
            return 1
        img = cutout(Image.open(path))
        if img.width > CARD_WIDTH:
            img = img.resize(
                (CARD_WIDTH, round(img.height * CARD_WIDTH / img.width)), Image.LANCZOS
            )
        out = DST / f"{card_id}.webp"
        size = to_webp(img, out)
        cards.append({
            "id": card_id,
            "label": label,
            "sheet": f"assets/burst/{card_id}.webp",
            "ar": round(img.width / img.height, 4),
        })
        print(f"{card_id:7s} {label} {img.width}×{img.height}（{size / 1024:.0f}KB）")

    # 4. 前端消费的数据
    sets_js = DST / "sets.js"
    sets_js.write_text(
        "// 由 tools/sync_actions.py 生成，不要手改。\n"
        "// 每组动作的帧数 / 网格 / 尺寸都从图集实测得出，app.js 只消费这份数据。\n"
        "window.BURST_SETS = "
        + json.dumps(entries, ensure_ascii=False, indent=2)
        + ";\n\n"
        "// 人物卡：撞墙姿态帧的底图，点一张换一套造型\n"
        "window.BURST_CARDS = "
        + json.dumps(cards, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"输出 {sets_js}（{len(entries)} 组动作 / {len(cards)} 张人物卡）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
