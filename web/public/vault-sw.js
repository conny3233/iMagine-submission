// 앱 ②(iMprint) 전용 서비스워커. register() 시 scope="/vault.html" 로 좁혀서 등록하므로
// 앱 ①(consent.html)에는 영향이 없다. src/vault/registerSW.ts 가 등록한다.
//
// 전략: 같은 출처 GET 요청은 stale-while-revalidate (캐시를 먼저 주고, 백그라운드로 갱신).
// 다른 출처 요청(공개 RPC 등)은 그대로 통과시키고 캐시하지 않는다 — 체인 조회 결과를 캐시하면
// "지금 체인 상태"가 아니라 "예전에 본 상태"를 보여주게 되기 때문이다.
//
// 화면(디자인)을 바꾸면 CACHE_NAME 버전을 올린다 — 이전 캐시는 activate 단계에서 지워진다.
const CACHE_NAME = "vault-cache-v8";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // RPC 등 외부 요청은 손대지 않는다
  if (url.pathname.includes("/api/")) return; // 기록 서버 응답은 늘 새로 받는다

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
