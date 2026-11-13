#!/usr/bin/env python3
"""生成主题三的全部素材：5 种身材 × 5 组动作 + 5 张神临立绘 + 1 组破壁，并输出 assets/burst/sets.js。

素材来源（只读）：

  身材 A–E   （神临立绘）  蓝发鲸鱼女仆/dafeiyu 同级目录 Gemini_A..E.jpeg/png
                           1536×2706 或 944×1665，白底无 alpha，四角泛滥填充抠底后缩到 720 宽
  动作 A–E   蓝发鲸鱼女仆/dafeiyu/人物<X>/<动作>_16帧连贯动作图.png
                           4×4 拼图，每格 315×311 左右，自带 alpha，直接当 sprite 图集
                           实测与同目录 GIF 的 16 帧逐帧一致（差异 0），所以不必再拆 GIF
  破壁共用   蓝发鲸鱼女仆 ·破壁/ 下三支 9 帧动画（难度 1/2/3）
                           整帧动画，脚本各自按 3×3 重新打包成图集

产物：
  assets/burst/body-<id>.webp        5 张神临立绘
  assets/burst/<id>-<action>.webp   25 张动作图集（4×4）
  assets/burst/break-<1..3>.webp    破壁图集（3×3），三支代表三种难度
  assets/burst/sets.js              window.BURST_BODIES / BURST_SETS / BURST_BREAKS

展示层按「高度铺满展示区」摆放（styles.css 的 .burst-frame / .burst-card-figure），
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

SRC = Path("/Users/yaobinsun/Downloads/jyl-pet")
ACTION_DIR = SRC / "dafeiyu"
BREAK_DIR = SRC / "蓝发鲸鱼女仆 ·破壁"

# 破壁（突破次元）三支 9 帧动画，难度递增：数字 = 难度，前端按等概率随机挑一支。
# 注意这三份「九宫格原图」实际是 9 帧整帧动画（GIF 头，扩展名写成了 .png），
# 不是 3×3 拼图；帧尺寸不一致，脚本按各自 3×3 重新打包。
BREAKS = [
    ("1", 1, "后仰反弹",
     BREAK_DIR / "04_新版角色_后仰反弹" / "九宫格原图" / "蓝发女仆撞窗九格动画.png"),
    ("2", 2, "反弹摔倒",
     BREAK_DIR / "02_初版角色_反弹摔倒" / "九宫格原图" / "蓝发鲸娘女仆撞玻璃反弹记.png"),
    ("3", 3, "撞击挤压",
     BREAK_DIR / "01_初版角色_撞击与挤压" / "GIF动画" / "玻璃碰撞九宫格动画.gif"),
]

QUALITY = 90
CARD_WIDTH = 720
COLS = 4  # 16 帧 → 4×4

# (id, 按钮文案, 神临立绘文件名)
BODIES = [
    ("a", "A", "Gemini_A.jpeg"),
    ("b", "B", "Gemini_B.jpeg"),
    ("c", "C", "Gemini_C.jpeg"),
    ("d", "D", "Gemini_D.png"),
    ("e", "E", "Gemini_E.png"),
]

# (action, 中文, 素材前缀)：顺序即按钮顺序，也是连招串联顺序
ACTIONS = [
    ("walk", "走路", "开心走路"),
    ("wave", "挥手", "微笑挥手"),
    ("jump", "蹦跳", "眨眼蹦跳"),
    ("fall", "摔倒", "委屈摔倒"),
    ("sit", "坐下", "坐下呼吸"),
]
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


def clean_alpha(img: Image.Image) -> Image.Image:
    """收紧 alpha 通道：看不见的 1–12 归 0，252–255 归实。

    素材导出时整张图带一层 1% 半透明（D/E 两套动作图尤其明显），
    这些肉眼看不见的像素会把 alpha 平面撑成渐变，webp 体积翻倍，
    逐帧切换也要多解一次码。超过 248 的一律算不透明，边缘抗锯齿保留。
    """
    im = img.convert("RGBA")
    lut = [0 if v <= 12 else (255 if v >= 248 else v) for v in range(256)]
    im.putalpha(im.split()[3].point(lut))
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


def frame_sheet(frames, cols: int) -> tuple[Image.Image, int, int]:
    total = len(frames)
    rows = (total + cols - 1) // cols
    if total != cols * rows:
        raise SystemExit(f"{total} 帧铺不满 {cols}×{rows} 网格")
    cw, ch = frames[0].size
    sheet = Image.new("RGBA", (cw * cols, ch * rows), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        row, col = divmod(i, cols)
        sheet.paste(frame, (col * cw, row * ch))
    return sheet, cw, ch


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)

    # 1. 神临立绘（5 张）
    bodies = []
    for body_id, label, name in BODIES:
        path = SRC / name
        if not path.exists():
            print(f"素材不存在：{path}", flush=True)
            return 1
        img = clean_alpha(cutout(Image.open(path)))
        if img.width > CARD_WIDTH:
            img = img.resize(
                (CARD_WIDTH, round(img.height * CARD_WIDTH / img.width)), Image.LANCZOS
            )
        out = DST / f"body-{body_id}.webp"
        size = to_webp(img, out)
        bodies.append({
            "id": body_id,
            "label": label,
            "card": f"assets/burst/body-{body_id}.webp",
            "ar": round(img.width / img.height, 4),
        })
        print(f"body-{body_id:1s} {label} {img.width}×{img.height}（{size / 1024:.0f}KB）")

    # 2. 每种身材的动作图集（25 张）
    entries = []
    totals = {}
    for body_id, label, _ in BODIES:
        for action, cn, prefix in ACTIONS:
            strip = ACTION_DIR / f"人物{label}" / f"{prefix}_16帧连贯动作图.png"
            if not strip.exists():
                print(f"素材不存在：{strip}", flush=True)
                return 1
            img = clean_alpha(Image.open(strip))
            cw, ch = img.width // COLS, img.height // COLS
            if img.width % COLS or img.height % COLS:
                print(f"{strip} 尺寸 {img.size} 不能均分 4×4", flush=True)
                return 1
            frames = [
                img.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
                for r in range(4) for c in range(4)
            ]
            sheet, cw, ch = frame_sheet(frames, COLS)
            out = DST / f"{body_id}-{action}.webp"
            size = to_webp(sheet, out)
            totals[(body_id, action)] = len(frames)
            entries.append({
                "id": f"{body_id}-{action}",
                "body": body_id,
                "action": action,
                "kind": "sheet",
                "sheet": f"assets/burst/{body_id}-{action}.webp",
                "cols": COLS,
                "rows": 4,
                "total": len(frames),
                "ar": round(cw / ch, 4),
            })
            print(f"{body_id}-{action:5s} {len(frames):2d} 帧 {cw}×{ch} → 4×4 "
                  f"（{size / 1024:.0f}KB）")

    # 3. 连招：每种身材五套动作串成 80 帧
    for body_id, label, _ in BODIES:
        total = sum(totals.get((body_id, a), 0) for a in COMBO_ORDER)
        entries.append({
            "id": f"{body_id}-combo",
            "body": body_id,
            "action": "combo",
            "kind": "combo",
            "total": total,
        })
        print(f"{body_id}-combo {total:2d} 帧（{' → '.join(COMBO_ORDER)}）")

    # 4. 破壁（共用）：3 支 9 帧动画，代表三种突破次元的难度
    breaks = []
    for bid, difficulty, label, src in BREAKS:
        if not src.exists():
            print(f"素材不存在：{src}", flush=True)
            return 1
        anim = Image.open(src)
        frames = []
        for i in range(getattr(anim, "n_frames", 1)):
            anim.seek(i)
            frames.append(clean_alpha(anim.convert("RGBA")).copy())
        sheet, cw, ch = frame_sheet(frames, 3)
        out = DST / f"break-{bid}.webp"
        size = to_webp(sheet, out)
        breaks.append({
            "id": f"break-{bid}",
            "kind": "break",
            "difficulty": difficulty,
            "label": label,
            "sheet": f"assets/burst/break-{bid}.webp",
            "cols": 3,
            "rows": 3,
            "total": len(frames),
            "ar": round(cw / ch, 4),
        })
        print(f"break-{bid} 难度{difficulty} {label} {len(frames)} 帧 {cw}×{ch} → 3×3"
              f"（{size / 1024:.0f}KB）")

    # 5. 前端消费的数据
    sets_js = DST / "sets.js"
    sets_js.write_text(
        "// 由 tools/sync_actions.py 生成，不要手改。\n"
        "// 5 种身材 × 5 组动作 + 神临立绘 + 3 支共用的破壁图集，app.js 只消费这份数据。\n"
        "window.BURST_BODIES = "
        + json.dumps(bodies, ensure_ascii=False, indent=2)
        + ";\n\n"
        "window.BURST_SETS = "
        + json.dumps(entries, ensure_ascii=False, indent=2)
        + ";\n\n"
        "// 破壁：三种突破次元的难度，点一次等概率随机挑一支（不连出同一支）\n"
        "window.BURST_BREAKS = "
        + json.dumps(breaks, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"输出 {sets_js}（{len(bodies)} 种身材 / {len(entries)} 组动作 / {len(breaks)} 支破壁）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
