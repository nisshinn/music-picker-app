// Music Picker service worker
// 画面の枠(HTML/CSS/JS/アイコン)だけをキャッシュし、オフラインでも画面が開けるようにする。
// /api/ や Spotify などの通信は常にネットワークへ（ログイン情報や検索結果をキャッシュしない）。
const CACHE = "music-picker-shell-v1";
const SHELL = ["/", "/index.html", "/search.html", "/favorites.html", "/top-tracks.html", "/history.html", "/settings.html", "/account.html", "/style.css", "/script.js", "/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  // ネットワーク優先。失敗（オフライン）したときだけキャッシュを使う → 更新が反映されやすい
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/index.html")))
  );
});
