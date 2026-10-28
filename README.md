# 鲸鱼娘变化器

一个把网络梗「滑动变阻器」做成物理实验器材的网页小玩具：拖动滑片，鲸鱼娘会在 5 个档位之间平滑变化，从「小鲸鱼」一路滑到「鲸祖」。

纯静态、零依赖、零构建，双击 `index.html` 就能玩。

## 玩法

- **拖动滑片**：鼠标、触屏都可以
- **键盘**：方向键 ±2%，`Shift` + 方向键 ±10%，`PageUp/PageDown` ±10%，`Home/End` 到两端
- **滚轮**：在滑轨上滚动微调
- **音效**：滑动时有实时合成的摩擦声，跨档时有咔哒声（首次交互后才会启用，这是浏览器的限制）
- **设置**：右下角「设置」可改标题、副标题、5 个档位名称与文案、主题色；配置存在浏览器 localStorage

## 换图片

默认读取 `assets/` 下的 5 张图，按档位顺序：

| 档位 | 文件 |
| --- | --- |
| Lv.1 小鲸鱼 | `assets/a.jpeg` |
| Lv.2 鲸鱼娘 | `assets/c.jpeg` |
| Lv.3 鲸灵 | `assets/d.jpeg` |
| Lv.4 鲸圣 | `assets/g.jpeg` |
| Lv.5 鲸祖 | `assets/h.jpeg` |

想换图或改顺序，直接替换文件，或修改 `app.js` 顶部的 `FRAME_SOURCES` 数组。图片建议用同尺寸、同背景的立绘，交叉过渡会更自然。

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
├── index.html      # 页面结构
├── styles.css      # 视觉与响应式
├── app.js          # 拖拽、帧混合、音效、设置、SW 注册
├── manifest.json   # PWA 清单（名称、图标、独立窗口模式）
├── sw.js           # Service Worker（离线缓存）
├── icon.html       # 图标生成源页面（备选方案）
├── icons/          # 应用图标 512 / 192 / 180
├── tools/          # gen-icon.swift 图标生成脚本
├── assets/         # 5 张鲸鱼娘图片
└── README.md
```

## 安装到 iPhone / Mac（PWA）

这个项目是 PWA（渐进式 Web 应用），**不需要 Xcode、不需要 Apple 开发者账号、不花一分钱**，装完有独立图标、全屏运行、离线可用。

### 前提：必须有 HTTPS 地址

iOS Safari 只对 HTTPS 页面启用全屏独立模式。`localhost` 开发时可用，但 iPhone 访问不到你电脑的 localhost。所以要装到手机，先部署到一个 HTTPS 地址（见下）。

### iPhone / iPad（Safari）

1. 用 Safari 打开你的 HTTPS 地址
2. 点底部「分享」按钮
3. 选「添加到主屏幕」
4. 确认名称 → 完成，桌面上出现鲸鱼图标

### Mac

- **Safari**：菜单「文件」→「添加到 Dock」，图标进 Dock，点开是独立窗口
- **Chrome**：地址栏右侧出现安装图标（或菜单「保存并分享」→「安装页面为应用」）

### 部署到 HTTPS（任选一种）

| 方式 | 说明 |
| --- | --- |
| GitHub Pages | 把 `whale-girl-changer/` 推到仓库，Settings → Pages 启用，免费 `https://<user>.github.io/<repo>/` |
| Cloudflare Pages / Vercel / Netlify | 拖拽目录上传即得 HTTPS 地址，免费额度足够 |
| 自己的服务器 | 有域名 + HTTPS 即可 |

部署后首次打开会自动缓存全部资源（含 5 张图），之后**断网也能用**。

### 重新生成图标

图标由 Swift 脚本生成（深海渐变 + 鲸鱼）：

```bash
cd whale-girl-changer
swift tools/gen-icon.swift
sips -z 192 192 icons/icon-512.png --out icons/icon-192.png
sips -z 180 180 icons/icon-512.png --out icons/apple-touch-icon.png
```

改 `tools/gen-icon.swift` 里的 emoji 或配色即可换图标。

### 升级缓存

改了代码后，把 `sw.js` 里的 `CACHE_NAME` 改成 `whale-changer-v2`，浏览器会自动清掉旧缓存。

## 实现要点

- **连续变化**：5 张图叠放，按滑片位置计算三角权重做 opacity 交叉淡入淡出，不是简单跳帧
- **平滑跟手**：目标值 + 每帧插值，点击轨道也会平滑滑过去
- **音效**：Web Audio API 实时合成白噪声摩擦声与三角波咔哒声，不加载任何音频文件
- **无后端**：所有配置存 localStorage
