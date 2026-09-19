// 앱 ① 이해 확인 흐름의 콘텐츠 모양. 원본은 data/content/<문서 id>/<버전>.json 이다
// (0918-team-plan.md §5 의 "C가 개발자에게 넘길 표" 형식을 옮긴 것 — C 작성, B 원문 대조).
// 화면(피그마)보다 먼저 고정한다. 화면은 이 데이터를 그리기만 하고 채점·진행 규칙은 flow/machine.ts 가 정한다.

export type ReviewStatus = "초안" | "수정 필요" | "승인";

export interface Choice {
  id: string;
  text: string;
}

export interface Question {
  id: string; // "P1-A"(최초) · "P1-B"(재확인)
  /** 누가 만든 문제인가 — "ai" 면 화면에 "AI가 만든 문제"로 밝힌다 (09/15 회의: 사람 1 + LLM 1). */
  madeBy?: "person" | "ai";
  prompt: string;
  choices: Choice[]; // 3개가 기본
  answerId: string; // 채점은 이 값으로만 한다 — 화면이 보내는 정오답을 믿지 않는다
  rationale: string; // 정답 근거
}

export interface Concept {
  id: string; // "P1"~"P3", "L1"~"L3"
  /** data/documents 의 조항 id. 영수증에는 이 값이 들어간다 — 앱 ② 가 이 키로 조항 제목을 찾는다. */
  clauseId: string;
  title: string;
  /** 없으면 화면이 그 조항의 쉬운 설명 카드(cards)로 대신한다. */
  explanations?: {
    detailed?: string; // 기본 설명
    easy?: string; // 쉬운 설명
    remedial?: string; // 최초 오답 뒤 재설명
  };
  questions: [Question, Question]; // [최초, 재확인]
  /**
   * 최초 문항을 틀렸을 때 재설명 화면에서 재생할 쇼츠 영상 (web/public 아래 경로, 예: "/shorts/ssdam-loan-L1.mp4").
   * 파일이 아직 없거나 못 틀면 영상 없이 지금의 재설명 카드만 보인다 — 파일만 넣으면 바로 나온다.
   */
  remedialVideo?: string;
}

/** 원문 조항 하나를 쉬운 말로 옮긴 카드 (easy 모드). AI 가 쓰고 사람이 원문과 대조한다. */
export interface ClauseCard {
  clauseId: string; // data/documents 의 조항 id
  article: string; // "제10조"
  label: string; // "중도해지"
  headline: string; // JSON 의 줄바꿈 문자는 화면에서도 줄바꿈
  points: string[];
  /** 놓치면 손해 보는 내용. 있으면 빨간 상자로 보이고 "주의 N개"에 센다. */
  caution?: string;
}

/** 금리가 오르면 이자가 얼마나 느는지 보여 주는 가상 계산 (계획서 §11). 숫자는 팀이 정한 예시이고 실제 판매 금리가 아니다. */
export interface RateCalculator {
  /** 이 조항 카드 아래에 붙는다. */
  clauseId: string;
  principalWon: number;
  /** "4.2" — 비교의 기준이 되는 지금 금리. */
  rateBeforePct: string;
  /** 고를 수 있는 상승폭(%p). "0" 을 넣어 차이 0 도 보여 준다. */
  stepsPctPoint: string[];
  defaultStep: string;
  /** 화면에 그대로 보이는 가정 문장. */
  assumption: string;
}

/** 궁금한 점 시트에 미리 넣어 두는 질문과 답. 이용자는 고르기만 한다 — 입력창도, 실시간 AI 호출도 없다. */
export interface QaItem {
  id: string;
  question: string;
  answer: string;
  /** 답의 근거 조항. 있으면 답 아래에 "원문 보기"가 붙는다. */
  clauseId?: string;
}

export interface ScenarioContent {
  scenarioId: string; // "privacy-complaint-v1"
  document: { id: string; version: string };
  /** 상단 바에 들어갈 짧은 제목. 없으면 문서 제목을 쓴다. */
  shortTitle?: string;
  /** 메인화면(가입 화면)에 보일 상품 이름. */
  productName?: string;
  /** AI 요약 — 궁금한 점 시트 맨 위에 보인다. AI 가 쓰고 사람이 원문과 대조한다. */
  summary?: { title: string; points: string[] };
  reviewStatus: ReviewStatus;
  note?: string;
  cards: ClauseCard[];
  /** 있으면 해당 조항 카드에 금리 비교 계산이 붙고, 본 값이 영수증에 남는다. */
  calculator?: RateCalculator;
  /** 확인 문제. 비어 있으면 동의 버튼이 바로 최종 선택으로 간다. */
  concepts: Concept[];
  qa: QaItem[];
}
