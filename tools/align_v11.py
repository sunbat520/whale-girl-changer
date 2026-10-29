#!/usr/bin/env python3
"""对齐 v11（定稿）：统一间隙 48px + 逐视图纵向归一 + 横向比例统一。

相比 v10 的变化：
  1. 画布加宽到 1559x1065，三视图之间留 48px 间隙（原来是 4~8px 几乎贴身）
     间隙按"最宽情况"（h 的侧面 420px）预留，所以 cup 再大也挤不到邻居。
  2. 侧面视图以头部中心为锚，宽度向右背方向固定、向左（胸膛）自由扩展。
     这样 cup 变大时只有胸口朝前长，身体位置不动。

横向比例：只用正面/背面宽度定（g/h 原图宽度是 a/c/d 的 0.870 倍，
但身高只有 0.855 倍，若统一按身高放大，正面会宽 2% → d->g "晃一下"）。
纵向：每个视图单独归一，保证头顶和脚底在 5 张图里完全一致。
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import os, statistics

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
ALIGNED = os.path.join(ROOT, "assets", "aligned")
FILES = ["a.jpeg", "c.jpeg", "d.jpeg", "g.jpeg", "h.jpeg"]
REF_FILES = ["a.jpeg", "c.jpeg", "d.jpeg"]
os.makedirs(ALIGNED, exist_ok=True)

TOL = 22
INSET = 4
K = 3
PAD = 20
GAP = 48


def fg_mask(arr):
    sub = arr[INSET:-INSET, INSET:-INSET].astype(np.int16)
    near_white = (np.abs(sub - 255).sum(axis=2) <= TOL)
    lab, _ = ndimage.label(near_white, structure=np.ones((3, 3)))
    ids = set(lab[0, :].tolist()) | set(lab[-1, :].tolist()) \
        | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    ids.discard(0)
    bg = np.isin(lab, list(ids)) if ids else np.zeros_like(near_white)
    fg = np.zeros(arr.shape[:2], bool)
    fg[INSET:-INSET, INSET:-INSET] = ~bg
    return fg


def kmeans1d(vals, weights, centers, iters=60):
    vals = np.asarray(vals, float); weights = np.asarray(weights, float)
    centers = np.asarray(centers, float)
    for _ in range(iters):
        lab = np.abs(vals[:, None] - centers[None, :]).argmin(axis=1)
        new = centers.copy()
        for k in range(len(centers)):
            sel = lab == k
            if sel.sum():
                new[k] = (vals[sel] * weights[sel]).sum() / weights[sel].sum()
        if np.allclose(new, centers, atol=0.3):
            centers = new; break
        centers = new
    return centers, lab


def split_chars(fg, k=K):
    lab, n = ndimage.label(fg, structure=np.ones((3, 3)))
    areas = ndimage.sum(fg, lab, range(1, n + 1))
    total = fg.sum()
    ids = [i + 1 for i in range(n) if areas[i] > total * 0.004]
    cxs, ws = [], []
    for lid in ids:
        ys, xs = np.where(lab == lid)
        cxs.append(xs.mean()); ws.append(len(xs))
    centers, assign = kmeans1d(cxs, ws, [fg.shape[1] * (2 * i + 1) / (2 * k) for i in range(k)])
    order = np.argsort(centers)
    out = []
    for kk in order:
        m = np.zeros_like(fg)
        for lid, asg in zip(ids, assign):
            if asg == kk:
                m |= (lab == lid)
        out.append(m)
    return out


def analyze_char(m):
    ys, xs = np.where(m)
    if len(ys) == 0:
        return None
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    band_end = y0 + int((y1 - y0) * 0.18)
    hys, hxs = np.where(m[y0:band_end + 1, :])
    head_cx = float(hxs.mean()) if len(hxs) else (x0 + x1) / 2
    return dict(x0=x0, x1=x1, y0=y0, y1=y1, w=x1 - x0 + 1, h=y1 - y0 + 1, head_cx=head_cx)


# ---------- 1. 测量 ----------
print("=" * 104)
data = {}
for f in FILES:
    arr = np.asarray(Image.open(os.path.join(ASSETS, f)).convert("RGB")).astype(np.uint8)
    fg = fg_mask(arr)
    chars = split_chars(fg)
    info = sorted([c for c in (analyze_char(m) for m in chars) if c], key=lambda c: c["head_cx"])
    data[f] = dict(arr=arr, chars=chars, info=info)
    print(f"{f}:")
    for i, c in enumerate(info):
        print(f"   V{i+1}: x={c['x0']}..{c['x1']}(w={c['w']}) y={c['y0']}..{c['y1']}"
              f"(h={c['h']}) 头中心={c['head_cx']:.1f}")

# ---------- 2. 缩放比例 ----------
# 横向：a/c/d 保持原样；g/h 用统一比例，由正面/背面宽度定
TGT_W = [int(round(statistics.median(data[f]["info"][i]["w"] for f in REF_FILES))) for i in range(K)]
SX = {}
for f in FILES:
    SX[f] = 1.0 if f in REF_FILES else statistics.median(
        TGT_W[i] / data[f]["info"][i]["w"] for i in (0, 2))

# 纵向：每个视图单独归一 -> 头顶/脚底完全对齐
TGT_Y = []
for i in range(K):
    TGT_Y.append((
        int(round(statistics.median(data[f]["info"][i]["y0"] for f in REF_FILES))),
        int(round(statistics.median(data[f]["info"][i]["y1"] for f in REF_FILES))),
    ))

# 侧面视图最宽情况（h 的 cup 最大），用来预留间隙
V2_W_MAX = max(int(round(data[f]["info"][1]["w"] * SX[f])) for f in FILES)

# ---------- 3. 布局 ----------
# V1 左缘 = PAD；V2 以头中心为锚；V3 左缘 = V2 最大右缘 + GAP
W1 = TGT_W[0]
x1 = PAD
head1 = x1 + data["a.jpeg"]["info"][0]["head_cx"] - data["a.jpeg"]["info"][0]["x0"]

# V2 头中心 = V1 右缘 + GAP + 最宽V2的左缘偏移 + 头到左缘距离
v2_head_off_max = max((data[f]["info"][1]["head_cx"] - data[f]["info"][1]["x0"]) * SX[f] for f in FILES)
head2 = x1 + W1 + GAP + v2_head_off_max
v2_right_max = max(head2 + (data[f]["info"][1]["x1"] - data[f]["info"][1]["head_cx"]) * SX[f] for f in FILES)

x3 = int(round(v2_right_max)) + GAP
W3 = TGT_W[2]
head3 = x3 + (data["a.jpeg"]["info"][2]["head_cx"] - data["a.jpeg"]["info"][2]["x0"])
CW = int(round(x3 + W3 + PAD))
CH = max(y1 for _, y1 in TGT_Y) + PAD

print(f"\n布局: 画布={CW}x{CH}  间隙={GAP}px")
print(f"  V1 左缘={x1} 宽={W1} 头中心={head1:.1f}")
print(f"  V2 头中心={head2:.1f} 最大宽={V2_W_MAX} 最大右缘={v2_right_max:.1f}")
print(f"  V3 左缘={x3} 宽={W3} 头中心={head3:.1f}")
print(f"  纵向目标: {TGT_Y}")

TGT_HEAD = [head1, head2, head3]

# ---------- 4. 渲染 ----------
print("\n输出:")
for f in FILES:
    d = data[f]; arr = d["arr"]; sx = SX[f]
    canvas = Image.new("RGB", (CW, CH), (255, 255, 255))
    for i, m in enumerate(d["chars"]):
        c = d["info"][i]
        top_i, feet_i = TGT_Y[i]
        h_i = feet_i - top_i + 1
        sy = h_i / c["h"]
        crop_rgb = arr[c["y0"]:c["y1"] + 1, c["x0"]:c["x1"] + 1]
        crop_a = (m[c["y0"]:c["y1"] + 1, c["x0"]:c["x1"] + 1] * 255).astype(np.uint8)
        rgba = np.dstack([crop_rgb, crop_a])
        img = Image.fromarray(rgba, "RGBA").resize(
            (int(round(c["w"] * sx)), int(round(c["h"] * sy))), Image.LANCZOS)
        dx = int(round(TGT_HEAD[i] - (c["head_cx"] - c["x0"]) * sx))
        dy = feet_i - img.height
        canvas.paste(img, (dx, dy), img)
    canvas.save(os.path.join(ALIGNED, f), quality=95)
    print(f"  {f}: sx={sx:.4f}")

# ---------- 5. 校验 ----------
print("\n校验（输出重测）:")
res = {}
for f in FILES:
    arr = np.asarray(Image.open(os.path.join(ALIGNED, f)).convert("RGB")).astype(np.uint8)
    fg = fg_mask(arr)
    info = sorted([c for c in (analyze_char(m) for m in split_chars(fg)) if c],
                  key=lambda c: c["head_cx"])
    res[f] = info
    print(f"  {f}: " + " | ".join(
        f"x{c['x0']}..{c['x1']}(w={c['w']}) y{c['y0']}..{c['y1']} 头{c['head_cx']:.0f}"
        for c in info))

print("\n=== 稳定性汇总 ===")
for i, label in enumerate(["V1 正面", "V2 侧面", "V3 背面"]):
    vals = [res[f][i] if i < len(res[f]) else None for f in FILES]
    if any(v is None for v in vals):
        print(f"  {label}: 分割粘连（bbox 重叠），跳过"); continue
    for key, nm in [("y0", "头顶"), ("y1", "脚底"), ("head_cx", "头中心")]:
        sp = max(v[key] for v in vals) - min(v[key] for v in vals)
        print(f"  {label} {nm}极差={sp:.0f}px {'OK' if sp <= 2 else '!!'}")
    ws = [v["w"] for v in vals]
    gap = [vals[k]["x0"] - vals[0]["x1"] - 1 for k in range(len(vals))]
    print(f"  {label} 宽度={ws} 极差={max(ws)-min(ws)}px")
    if i == 1:
        print(f"  V2 与 V1 的间隙={gap}  (h 最窄，其余 >100)")
