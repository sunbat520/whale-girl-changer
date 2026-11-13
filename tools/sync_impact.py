#!/usr/bin/env python3
"""把撞玻璃素材合集里的贴玻璃立绘原图与 GIF 动画同步到 assets/impact/。

素材来源（只读）：
  /Users/yaobinsun/Downloads/jyl-pet/蓝发鲸鱼女仆 · 图片与 GIF 完整合集

每个系列取两份素材：
  - 九宫格原图/<stem>.png -> assets/impact/<id>/still.png（原图直拷，不重采样）
  - GIF动画/<stem>.gif   -> assets/impact/<id>/anim.gif（原 GIF 直拷）

改素材后重跑本脚本即可，app.js 里的 IMPACT_SERIES 与本表一一对应。
"""

from pathlib import Path
import shutil
import sys

SRC_ROOT = Path("/Users/yaobinsun/Downloads/jyl-pet/蓝发鲸鱼女仆 · 图片与 GIF 完整合集")
DST_ROOT = Path(__file__).resolve().parent.parent / "assets" / "impact"

# (id, 系列目录, 文件名主干（still/gif 同名）, 显示名)
SERIES = [
    ("old-knock", "01_初版角色_撞击与挤压", "玻璃碰撞九宫格动画", "初版 · 玻璃碰撞"),
    ("old-kiss", "01_初版角色_撞击与挤压", "玻璃轻吻_蓝发女仆动画九宫格", "初版 · 玻璃轻吻"),
    ("old-bash", "01_初版角色_撞击与挤压", "蓝发女仆撞击玻璃九宫格", "初版 · 撞击玻璃"),
    ("old-combo", "01_初版角色_撞击与挤压", "蓝发女仆撞玻璃九连击", "初版 · 撞玻璃九连击"),
    ("old-face", "01_初版角色_撞击与挤压", "蓝发女仆玻璃贴脸九连动画", "初版 · 玻璃贴脸"),
    ("old-rebound", "02_初版角色_反弹摔倒", "蓝发鲸娘女仆撞玻璃反弹记", "初版 · 撞玻璃反弹"),
    ("new-crack", "03_新版角色_撞击与裂纹", "蓝发鲸娘女仆撞玻璃九宫格", "新版 · 撞玻璃九宫格"),
    ("new-grid", "03_新版角色_撞击与裂纹", "蓝发鲸娘撞玻璃九格动画", "新版 · 撞玻璃九格"),
    ("new-burst", "03_新版角色_撞击与裂纹", "蓝发鲸鱼女仆撞玻璃九连拍", "新版 · 撞玻璃九连拍"),
    ("new-fall", "04_新版角色_后仰反弹", "蓝发女仆撞窗九格动画", "新版 · 撞窗后仰"),
]


def main():
    if not SRC_ROOT.is_dir():
        sys.exit(f"素材目录不存在：{SRC_ROOT}")

    total = 0
    for sid, rel, stem, label in SERIES:
        still_src = SRC_ROOT / rel / "九宫格原图" / (stem + ".png")
        gif_src = SRC_ROOT / rel / "GIF动画" / (stem + ".gif")
        if not still_src.is_file():
            sys.exit(f"{sid} 缺少原图：{still_src}")
        if not gif_src.is_file():
            sys.exit(f"{sid} 缺少 GIF：{gif_src}")

        dst = DST_ROOT / sid
        dst.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(still_src, dst / "still.png")
        shutil.copyfile(gif_src, dst / "anim.gif")
        # 清掉九宫格逐帧时代的旧拆分帧，避免缓存目录残留
        for old in dst.glob("0[1-9].png"):
            old.unlink()
        total += 1
        print(f"{sid:12s} {label:14s} still.png + anim.gif -> {dst.relative_to(DST_ROOT.parent.parent)}")

    print(f"\n共同步 {len(SERIES)} 组立绘与 GIF")


if __name__ == "__main__":
    main()
