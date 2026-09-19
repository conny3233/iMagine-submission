// 앱 ②(vault) 전용 서비스워커 등록. 앱 ①(consent.html)에는 절대 등록하지 않는다 —
// scope 를 "/vault.html" 로 좁혀서 등록해도 같은 origin 이면 등록 자체는 이 파일을 import 한
// 엔트리(vault 의 main.tsx)에서만 호출되므로 안전하다.
import { assetUrl } from "../lib/paths";

export function registerVaultServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // 개발 서버(HMR)에서는 등록하지 않는다 — 캐시가 최신 코드를 가리는 걸 막는다.
  if (import.meta.env.DEV) return;
  // PWA 설치·SW 등록은 HTTPS 또는 localhost 에서만 가능하다 (브라우저 제약).
  const securable = location.protocol === "https:" || location.hostname === "localhost";
  if (!securable) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(assetUrl("/vault-sw.js"), { scope: assetUrl("/vault.html") })
      .catch((e) => console.warn("서비스워커 등록 실패:", e));
  });
}
