// 파일 경로 한 벌 — 배포(https://…/consent.html)와 제출용 오프라인 빌드(파일을 더블클릭해서 여는 file://)에서
// 같은 데이터로 동작해야 한다. 데이터(JSON)의 경로는 "/documents/…" 처럼 절대 경로 한 가지로만 적고,
// 화면에 쓸 때 이 함수로 바꾼다. 오프라인 빌드는 base="./" 로 굽기 때문에 상대 경로가 된다.
// 제출용 폴더 모양(더블클릭할 두 장 + 자료 폴더)은 offline-layout.json 에 있다.

import layout from "../../offline-layout.json";

const BASE = import.meta.env.BASE_URL;

/** 제출용(더블클릭으로 여는) 빌드인가 — 서비스워커·설치 안내처럼 서버가 있어야 하는 기능을 끌 때 쓴다. */
export const OFFLINE_BUILD = BASE !== "/";

/** 원문·영상·아이콘 — 제출용 빌드에서는 자료 폴더 안에 있다. */
export function assetUrl(path: string): string {
  if (!path.startsWith("/")) return path;
  return BASE === "/" ? path : `${BASE}${layout.files}/${path.slice(1)}`;
}

/** 다른 앱 화면 — 배포에서는 /vault.html, 제출용에서는 바로 옆의 2_iM_Print.html. */
export function pageUrl(page: keyof typeof layout.pages): string {
  return BASE === "/" ? `/${page}.html` : BASE + layout.pages[page];
}
