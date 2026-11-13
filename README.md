# 鲸鱼娘变化器

把网络梗「滑动变阻器」做成物理实验器材的网页小玩具，内置两套展示主题：

- **主题一 · 经典滑轨**（默认）：拖动滑片，鲸鱼娘在图片包的档位之间平滑变化。默认是经典 5 档三视图立绘（小鲸鱼 → 鲸祖），设置里可切到鲸鱼娘 v2 六档（B–G）。
- **主题二 · 暴击展示**：收起滑轨，固定展示贴玻璃立绘；点击立绘或「暴击展示」按钮，播放一次撞玻璃 GIF，约 1.6 秒后自动回到固定立绘。连点会立即从头重播，不排队、不锁按钮，节奏跟着点击走。

纯静态、零依赖、零构建，双击 `index.html` 就能玩。

> v2 六档不是 AI 重绘，而是对同一张源图的确定性挤压变形，所以极端档位（尤其 B）会有轻微拉伸与衣服褶皱变形，这是「挤压图」的预期风格。

## 玩法

- **主题切换**：右下角「设置 → 主题」可在两套展示之间切换，选择存在 localStorage
- **拖动滑片**（主题一）：鼠标、触屏都可以；经典 5 档与 v2 六档都在「设置 → 图片包」里切换，两包各自保存档位文案
- **键盘**：方向键 ±2%，`Shift` + 方向键 ±10%，`PageUp/PageDown` ±10%，`Home/End` 到两端
- **滚轮**：在滑轨上滚动微调（主题一）
- **音效**：滑动时有实时合成的摩擦声，跨档时有咔哒声（首次交互后才会启用，这是浏览器的限制）
- **设置**：右下角「设置」可改主题、图片包、标题、副标题、各档名称与文案、主题色；配置存在浏览器 localStorage

## 主题一：图片包

| 图片包 | 档位 | 文件 |
| --- | --- | --- |
| 经典 5 档（默认） | Lv.1–Lv.5：小鲸鱼 / 鲸鱼娘 / 鲸灵 / 鲸圣 / 鲸祖 | `assets/aligned/a,c,d,g,h.jpeg` |
| 鲸鱼娘 v2 六档 | Lv.1–Lv.6：B 微澜 … G 鲸祖 | `assets/b,c,d,e,f,g.jpeg` |

经典 5 档是三视图横图（1559×1075），展示区按 6:5 完整显示；v2 六档是竖图（1280×1714），同样按 6:5 完整放进展示区，不裁切。切换图片包时帧数、档位文案、刻度、滑块权重会自动适配，位置回到 50%。

## 主题二：撞玻璃素材

素材来自 `蓝发鲸鱼女仆 · 图片与 GIF 完整合集`，每个系列同步两张：

- `still.png`：贴玻璃立绘原图（主题二的固定立绘）
- `anim.gif`：撞玻璃九帧 GIF（点击立绘/按钮时播放一次）

主题二固定使用默认系列 `new-burst` 的立绘与 GIF，其余九组留作素材储备：

| id | 名称 | 来源系列 |
| --- | --- | --- |
| `new-burst` | 新版 · 撞玻璃九连拍（默认） | 03_新版角色_撞击与裂纹 |
| `new-crack` | 新版 · 撞玻璃九宫格 | 03_新版角色_撞击与裂纹 |
| `new-grid` | 新版 · 撞玻璃九格 | 03_新版角色_撞击与裂纹 |
| `new-fall` | 新版 · 撞窗后仰 | 04_新版角色_后仰反弹 |
| `old-knock` | 初版 · 玻璃碰撞 | 01_初版角色_撞击与挤压 |
| `old-kiss` | 初版 · 玻璃轻吻 | 01_初版角色_撞击与挤压 |
| `old-bash` | 初版 · 撞击玻璃 | 01_初版角色_撞击与挤压 |
| `old-combo` | 初版 · 撞玻璃九连击 | 01_初版角色_撞击与挤压 |
| `old-face` | 初版 · 玻璃贴脸 | 01_初版角色_撞击与挤压 |
| `old-rebound` | 初版 · 撞玻璃反弹 | 02_初版角色_反弹摔倒 |

### 重新同步撞击素材

素材目录默认是 `/Users/yaobinsun/Downloads/jyl-pet/蓝发鲸鱼女仆 · 图片与 GIF 完整合集`，改路径后重跑即可（原图直拷、不重采样）：

```bash
cd whale-girl-changer
python3 tools/sync_impact.py
```

脚本会按 `tools/sync_impact.py` 里的 `SERIES` 表，把每组 `still.png` 与 `anim.gif` 写进 `assets/impact/<id>/`，与 `app.js` 的 `IMPACT_SERIES` 一一对应。

## 重新生成六档图（v2 图片包）

源图在 `assets/source/g-jiya.jpeg`。挤压脚本在 `tools/squeeze_cups.py`，用项目内 Python 环境运行：

```bash
cd whale-girl-changer
../whale-girl-changer/.venv-img/bin/python tools/squeeze_cups.py
```

脚本会在 `assets/` 下重写 `b.jpeg … g.jpeg`（宽 1280、JPEG q88），并把预览图输出到 `tools/preview/`（六档竖排 + B/G 对照）。

可调参数在脚本顶部：

- `CX / R / Y0, Y1`：胸部窗口（横向中心、半宽、纵向范围，按 1792×2400 源图坐标）
- `CUPS`：六档挤压强度 `a_h`，越大压得越小；G 固定为 0（原图）
- `OUT_WIDTH`：输出宽度

脚本内置横向映射单调性断言，参数过大导致采样折叠时会直接报错。

## 本地运行

直接双击 `index.html` 即可。如果浏览器限制了本地文件读取，起一个静态服务器：

```bash
cd whale-girl-changer
python3 -m http.server 8080
# 打开 http://localhost:8080
```

## 文件结构

```
whale-girl-changer/
├── index.html          # 页面结构（滑轨 + 暴击按钮 + 撞玻璃 GIF 层）
├── styles.css          # 视觉与响应式（两套主题的布局差异也在这里）
├── app.js              # 图片包、帧混合、暴击 GIF、音效、设置、SW 注册
├── manifest.json       # PWA 清单
├── sw.js               # Service Worker（离线缓存，两包图 + 默认暴击 GIF 已预缓存）
├── icons/              # 应用图标 512 / 192 / 180
├── assets/
│   ├── aligned/        # 经典 5 档三视图（a/c/d/g/h）
│   ├── source/         # 原始 G cup 源图
│   ├── b–g.jpeg        # v2 六档挤压帧
│   └── impact/         # 10 组贴玻璃立绘 still.png + 撞玻璃 anim.gif（sync_impact.py 生成）
├── tools/
│   ├── squeeze_cups.py # v2 六档生成脚本
│   ├── align_v11.py    # 经典 5 档三视图对齐脚本
│   ├── sync_impact.py  # 撞玻璃素材同步脚本
│   └── preview/        # 生成预览（可删）
└── README.md
```

## 安装到 iPhone / Mac（PWA）

是 PWA，安装后独立窗口、离线可用。前提是部署到 HTTPS 地址（GitHub Pages / Cloudflare Pages / Vercel / Netlify 均可），然后：

- **iPhone / iPad（Safari）**：分享 → 添加到主屏幕
- **Mac（Safari）**：文件 → 添加到 Dock
- **Mac（Chrome）**：地址栏安装图标 → 安装

改了资源后，把 `sw.js` 里的 `CACHE_NAME` 改一下（如 `whale-changer-v6`），浏览器会自动清掉旧缓存。

## 实现要点

- **连续变化**：当前图片包的帧叠放，按滑片位置计算三角权重做 opacity 交叉淡入淡出，不是简单跳帧
- **平滑跟手**：目标值 + 每帧插值，点击轨道也会平滑滑过去
- **图片包**：`PACKS` 里每包自带帧顺序与档位文案，切包时重建帧与刻度，两包文案分别保存在 `gradesByPack`
- **暴击 GIF**：每次点击先清 `src`、强制回流再重新赋值，保证同一张 GIF 从头播放；计时随点击重置
- **音效**：Web Audio API 实时合成——摩擦声（带通白噪声）、咔哒声（三角波），不加载任何音频文件
- **无后端**：所有配置存 localStorage
- **同源同画布**：同一包内的帧尺寸与构图一致，切换不跳位
