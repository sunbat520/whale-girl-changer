/* ============================================================
   鲸鱼娘变化器 — Service Worker

   策略分两类：
   - 页面代码（HTML / CSS / JS / JSON）走「网络优先」：只要线上有新版本，
     刷新一次就能拿到，不再被旧缓存钉住；断网时回退到缓存。
   - 图片等重资源走「缓存优先」：首屏快、离线可用。

   任何一次部署都不该让手机端卡在旧版本上，所以这里刻意不再对
   导航请求用 cacheFirst（那是之前「手机刷新不动」的根因）。
   ============================================================ */

'use strict';

const CACHE_NAME = 'whale-changer-v17';

const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './assets/burst/sets.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  // 主题一：经典 5 档（默认）
  './assets/aligned/a.jpeg',
  './assets/aligned/c.jpeg',
  './assets/aligned/d.jpeg',
  './assets/aligned/g.jpeg',
  './assets/aligned/h.jpeg',
  // 主题二：v2 六档
  './assets/b.jpeg',
  './assets/c.jpeg',
  './assets/d.jpeg',
  './assets/e.jpeg',
  './assets/f.jpeg',
  './assets/g.jpeg',
  // 主题三：五档身材滑轨直接用这 5 张立绘（首屏全要）
  // 主题四：神临立绘同样用它们；动作图集按需缓存（cacheFirst）
  './assets/burst/body-a.webp',
  './assets/burst/body-b.webp',
  './assets/burst/body-c.webp',
  './assets/burst/body-d.webp',
  './assets/burst/body-e.webp',
  // 冲撞模式的主体立绘（模式入口当前隐藏，但启动时会预载）
  './assets/impact/new-burst/still.png',
  // 主题四动作图集（assets/burst/*.webp，25 张约 13MB）不预缓存：
  // 神临态用不到它们，首次点选某个动作时由 cacheFirst 落盘，
  // 否则手机首屏要多下十几 MB 才出画面。
];

// 这些后缀属于「页面代码」，必须吃到线上最新版
const CODE_PATTERN = /\.(?:html|css|js|json|webmanifest|map)$/i;
// 导航请求等网络的耐心值：超时先给缓存把页面打开，网络回来后照样写入缓存
const NAV_TIMEOUT = 6000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // cache: 'reload' 绕过 HTTP 缓存，避免预缓存进一份 CDN 上的旧 HTML / 旧 JS
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

async function putInCache(request, response) {
  if (!response || !response.ok || response.type !== 'basic') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (err) {
    /* 配额满等情况：不影响本次返回 */
  }
}

async function cacheFallback(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  if (request.mode === 'navigate') {
    const home = await caches.match('./index.html');
    if (home) return home;
  }
  return Response.error();
}

/* 网络优先：线上更新立刻生效，断网 / 超时才回退缓存 */
async function networkFirst(request, timeout) {
  const network = fetch(request, { cache: 'no-store' }).then((response) => {
    // 不 await：写缓存失败不该拖慢这次响应
    putInCache(request, response);
    return response;
  });

  if (timeout) {
    let timer;
    const timeoutHit = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), timeout);
    });
    try {
      const first = await Promise.race([network.catch(() => null), timeoutHit]);
      if (first) return first;
      // 网络太慢：先用缓存开页面，网络请求继续在后台把新版本写进缓存
      network.catch(() => undefined);
      const cached = await cacheFallback(request);
      return cached;
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    return await network;
  } catch (err) {
    return cacheFallback(request);
  }
}

/* 缓存优先：图片这类不变的重资源 */
async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    putInCache(request, response);
    return response;
  } catch (err) {
    return cacheFallback(request);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.url.startsWith('chrome-extension://')) return;

  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }
  const sameOrigin = url.origin === self.location.origin;
  const isDocument = request.mode === 'navigate' || request.destination === 'document';
  const isCode = sameOrigin && (isDocument || CODE_PATTERN.test(url.pathname));

  event.respondWith(
    isCode ? networkFirst(request, isDocument ? NAV_TIMEOUT : 0) : cacheFirst(request)
  );
});

// 页面里调 registration.waiting.postMessage({ type: 'SKIP_WAITING' }) 可以立刻换新
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
