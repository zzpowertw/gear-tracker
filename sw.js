// ============================================================
// Service Worker：讓 App 在沒網路時也能打開
// - 自己的檔案：先抓網路上的最新版，抓不到才用快取（所以更新會自動生效）
// - 外部程式庫（固定版本號，不會變）：先用快取，加快開啟速度
// 每次發佈新版請把 CACHE_VERSION 改成跟 app.jsx 的 APP_VERSION 一樣
// ============================================================
const CACHE_VERSION = "3.6.1";
const CACHE = `gear-reckoner-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "index.html",
  "app.jsx",
  "gear-data.js",
  "storage.js",
  "firebase-config.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
];

const CDN_HOSTS = ["esm.sh", "unpkg.com", "www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  // cache: "reload" 跳過瀏覽器自己的暫存，確保存進來的是伺服器上的最新版
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL.map((u) => new Request(u, { cache: "reload" }))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
  }
  // 其他（Firebase 登入、資料庫連線）不攔截，交給 Firebase 自己處理
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    // no-cache：每次都向伺服器確認有沒有新版，避免拿到瀏覽器暫存的舊檔
    // 打開頁面（navigate）的請求不能直接加選項，改用網址重新發一個請求
    const fresh = req.mode === "navigate" ? new Request(req.url, { cache: "no-cache" }) : new Request(req, { cache: "no-cache" });
    const res = await fetch(fresh);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    throw e;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}
