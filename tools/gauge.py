#!/usr/bin/env python3
"""终检：用固定窗口测量 5 张对齐图的稳定性。

自动分割在 h 上会把 V1/V2 粘成一个组件（bbox 水平重叠），
所以这里改用固定的 x 窗口，并按人体高度分带取特征：
  - 腿（60%~92% 身高）：完全不受 cup 影响，5 张必须一致
  - 胸（40%~55% 身高）：cup 影响区，允许单调递增
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALIGNED = os.path.join(ROOT, "assets", "aligned")
FILES = ["a.jpeg", "c.jpeg", "d.jpeg", "g.jpeg", "h.jpeg"]
TOL, INSET = 22, 4
WIN = {"V1": (0, 546), "V2": (490, 935), "V3": (896, 1400)}


def fg_mask(arr):
    sub = arr[INSET:-INSET, INSET:-INSET].astype(np.int16)
    nw = (np.abs(sub - 255).sum(axis=2) <= TOL)
    lab, _ = ndimage.label(nw, structure=np.ones((3, 3)))
    ids = set(lab[0, :].tolist()) | set(lab[-1, :].tolist()) \
        | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    ids.discard(0)
    bg = np.isin(lab, list(ids)) if ids else np.zeros_like(nw)
    fg = np.zeros(arr.shape[:2], bool)
    fg[INSET:-INSET, INSET:-INSET] = ~bg
    return fg


def profile(fg, x0, x1, y0, y1):
    """窗口内某高度带的左右边缘。"""
    sub = fg[y0:y1 + 1, x0:x1 + 1]
    cols = sub.sum(axis=0)
    xs = np.where(cols > 0)[0]
    if not len(xs):
        return None
    return x0 + int(xs.min()), x0 + int(xs.max())


print(f"{'':6} {'V1(正面)':>18} {'V2 腿':>16} {'V2 胸':>16} {'V3(背面)':>18}")
rows = {}
for f in FILES:
    fg = fg_mask(np.asarray(Image.open(os.path.join(ALIGNED, f)).convert("RGB")).astype(np.uint8))
    rows_fg = fg.sum(axis=1)
    valid = rows_fg > fg.shape[1] * 0.005
    top = int(np.argmax(valid)); bot = int(len(valid) - 1 - np.argmax(valid[::-1]))
    H = bot - top + 1
    v1 = profile(fg, *WIN["V1"], top, bot)
    v2leg = profile(fg, *WIN["V2"], top + int(H * 0.62), top + int(H * 0.92))
    v2chest = profile(fg, *WIN["V2"], top + int(H * 0.40), top + int(H * 0.55))
    v3 = profile(fg, *WIN["V3"], top, bot)
    rows[f] = dict(top=top, bot=bot, H=H, v1=v1, v2leg=v2leg, v2chest=v2chest, v3=v3)
    fmt = lambda r: f"{r[0]}..{r[1]}(w={r[1]-r[0]+1})" if r else "-"
    print(f"{f:6} {fmt(v1):>22} {fmt(v2leg):>20} {fmt(v2chest):>20} {fmt(v3):>22}")

print("\n身高/脚底:")
for f in FILES:
    r = rows[f]
    print(f"  {f:6} 头顶={r['top']:4} 脚底={r['bot']:4} 身高={r['H']}")

print("\n稳定性判定:")
def spread(key, idx):
    vals = [rows[f][key][idx] for f in FILES]
    return max(vals) - min(vals)
print(f"  V1 左缘极差={spread('v1',0)}px 右缘极差={spread('v1',1)}px   -> 必须 0~2")
print(f"  V3 左缘极差={spread('v3',0)}px 右缘极差={spread('v3',1)}px   -> 必须 0~2")
print(f"  V2 腿左缘极差={spread('v2leg',0)}px 右缘极差={spread('v2leg',1)}px -> 必须 0~2")
print(f"  V2 胸左缘极差={spread('v2chest',0)}px              -> 允许递增(cup)")
print(f"  头顶极差={spread('top',0) if False else max(r['top'] for r in rows.values())-min(r['top'] for r in rows.values())}px "
      f"脚底极差={max(r['bot'] for r in rows.values())-min(r['bot'] for r in rows.values())}px -> 必须 0~2")

print("\nV2 胸部左缘（cup 递增序列）:")
for f in FILES:
    r = rows[f]["v2chest"]
    print(f"  {f:6} {r[0] if r else '-'}")
