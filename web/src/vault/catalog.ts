// iM Print 홈 화면(피그마 55:467)의 보관함 칸 — 모두 실제 원문이 있는 문서다.
// 칸은 그 문서의 영수증(이 기기에서 받은 것, 없으면 미리 기록한 것)이 있을 때만 보인다 — "블록체인으로 보호받는 서류"만 보관함에 있다.
// 피그마 시안의 예시 서류(체크카드·연금보험·펀드 등)와 "+N" 숫자, 예시 알림은 넣지 않는다 (2026-09-18 사용자: "더미로 만들지 말고").

import thumbAltCredit from "./assets/thumb-alt-credit-info.webp";
import thumbAltThirdParty from "./assets/thumb-alt-third-party.webp";
import thumbCreditInquiry from "./assets/thumb-credit-inquiry.webp";
import thumbIsa from "./assets/thumb-isa.webp";
import thumbKftc from "./assets/thumb-kftc-credit-info.webp";
import thumbLoanCredit from "./assets/thumb-loan-credit-info.webp";
import thumbSsdam from "./assets/thumb-ssdam-loan.webp";
import thumbSuitability from "./assets/thumb-suitability-check.webp";

export type Affiliate = "bank" | "securities" | "life" | "asset" | "etc";

/** 보관함 분류 칩 — 피그마의 순서·색 그대로. */
export const AFFILIATES: { id: Affiliate | "all"; label: string; color: string }[] = [
  { id: "all", label: "전체", color: "#666666" },
  { id: "bank", label: "iM뱅크", color: "#00c4a6" },
  { id: "securities", label: "iM증권", color: "#dfee5e" },
  { id: "life", label: "iM라이프", color: "#53e1e5" },
  { id: "asset", label: "iM에셋", color: "#d1b5ff" },
  { id: "etc", label: "기타", color: "#cdc9b7" },
];

export interface CatalogItem {
  /** data/documents 의 문서 id — 이 문서의 영수증을 연다. */
  documentId: string;
  name: string;
  affiliate: Affiliate;
  thumb: string;
}

// 앞의 두 칸은 피그마 시안 그대로의 상품 이미지, 나머지는 원문 첫 쪽.
export const CATALOG: CatalogItem[] = [
  { documentId: "ssdam-loan", name: "쓰담쓰담 간편대출", affiliate: "bank", thumb: thumbSsdam },
  { documentId: "isa-discretionary", name: "일임형 ISA", affiliate: "bank", thumb: thumbIsa },
  { documentId: "credit-inquiry", name: "신용정보 조회 동의서", affiliate: "bank", thumb: thumbCreditInquiry },
  { documentId: "loan-credit-info", name: "여신거래 신용정보 동의서", affiliate: "bank", thumb: thumbLoanCredit },
  { documentId: "alt-credit-info", name: "대안정보 활용 동의서", affiliate: "bank", thumb: thumbAltCredit },
  { documentId: "kftc-credit-info", name: "금융결제원정보 이용 동의서", affiliate: "bank", thumb: thumbKftc },
  { documentId: "alt-third-party", name: "대안정보 제3자 제공 동의서", affiliate: "bank", thumb: thumbAltThirdParty },
  { documentId: "suitability-check", name: "적합성·적정성 확인서", affiliate: "bank", thumb: thumbSuitability },
];

export function catalogName(documentId: string): string | undefined {
  return CATALOG.find((c) => c.documentId === documentId)?.name;
}

// 피그마 메모의 "최신순, 만료 임박 순, 가나다순" 중 만료일은 영수증·원문 어디에도 없어서 뺐다.
export type SortKey = "latest" | "name";

export const SORTS: { id: SortKey; label: string }[] = [
  { id: "latest", label: "최신순" },
  { id: "name", label: "가나다순" },
];
