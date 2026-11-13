/* ============================================================
   鲸鱼娘变化器 — Service Worker
   首次访问缓存全部资源，之后完全离线可用。
   ============================================================ */

'use strict';

const CACHE_NAME = 'whale-changer-v15';

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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
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

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // 网络失败：导航请求回退到首页，其它请求回退到缓存的首页
    const fallback = await caches.match('./index.html');
    if (fallback) return fallback;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.url.startsWith('chrome-extension://')) return;
  event.respondWith(cacheFirst(request));
});
