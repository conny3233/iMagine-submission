// 시연 시나리오 = 콘텐츠(data/content) + 원문(data/documents) 한 쌍.
// ISA(일임형) 약관(2026-09-15 결정)과 쓰담쓰담 간편대출(2026-09-18 추가, 원문 = 여신거래기본약관 + 상품설명서),
// 그리고 간편대출을 신청할 때 함께 동의하는 서식 6종(2026-09-18, scripts/build-form-documents.py).
// 상품을 더하려면 두 JSON 을 넣고 아래 목록에 한 줄 더한다. 메인화면은 콘텐츠의 productName 이 같은 것끼리 묶는다.

import type { DocumentVersion } from "../vault/types";
import type { ScenarioContent } from "./flow/types";

const contentModules = import.meta.glob<ScenarioContent>("../../../data/content/*/v1.json", {
  eager: true,
  import: "default",
});
const documentModules = import.meta.glob<DocumentVersion>("../../../data/documents/*/v1.json", {
  eager: true,
  import: "default",
});

export interface Scenario {
  content: ScenarioContent;
  document: DocumentVersion;
}

/** 메인화면에 보이는 순서. privacy-complaint 는 엔진 검증용 픽스처라 넣지 않는다. */
export const SCENARIO_IDS = [
  "isa-discretionary",
  "ssdam-loan",
  "credit-inquiry",
  "loan-credit-info",
  "alt-credit-info",
  "kftc-credit-info",
  "alt-third-party",
  "suitability-check",
] as const;

// JSON 은 문자열 리터럴·튜플 타입을 추론하지 못해 단언한다. 형식은 flow/machine.test.ts 가 검사한다.
export const scenarios: Scenario[] = SCENARIO_IDS.map((id) => {
  const content = contentModules[`../../../data/content/${id}/v1.json`];
  const document = documentModules[`../../../data/documents/${id}/v1.json`];
  if (!content || !document) throw new Error(`시나리오 파일이 없습니다: ${id}`);
  return { content: content as unknown as ScenarioContent, document };
});

/** 주소의 ?product=<문서 id> 로 처음 열 상품을 고를 수 있다 (시연 링크용). */
export function scenarioFromUrl(): Scenario | null {
  const id = new URLSearchParams(window.location.search).get("product");
  return scenarios.find((s) => s.document.id === id) ?? null;
}
