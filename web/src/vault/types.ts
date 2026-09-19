// 영수증·문서 데이터 모양. Node 쪽 원본 정의는 scripts/seal-receipts.mjs 와
// data/documents · data/receipts 의 JSON 이 실제 기준이다 — 여기는 그 모양을 따라 옮긴 타입일 뿐이다.

export interface DocumentClause {
  id: string;
  title: string;
  text: string;
  /** 원문 페이지 이미지에서 이 조항 문장이 있는 줄들 (페이지 크기 대비 %). scripts/locate-clauses.py 가 채운다. */
  marks?: ClauseMark[];
}

export interface ClauseMark {
  page: number; // 1쪽부터
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DocumentVersion {
  id: string;
  version: string;
  title: string;
  issuer: string; // 데이터일 뿐 — 화면에 기관명을 하드코딩하지 않는다 (앱 ② 범용성 원칙)
  sourceUrl: string | null;
  /** 원문 PDF 를 구운 페이지 이미지 경로. scripts/render-pdf-pages.py 가 채운다.
   *  content 가 아니라서 여기에 뭘 넣어도 documentHash 는 바뀌지 않는다. */
  sourcePages?: string[];
  publishedAt: string;
  supersedes: string | null;
  changeSummary?: string;
  clauses: DocumentClause[];
  content: string;
}

export interface ReceiptQuestion {
  conceptId: string;
  attempt: 1 | 2;
  correct: boolean;
  choiceId: string;
}

export interface ReceiptCalculation {
  principal: string;
  rateBeforePct: string;
  rateAfterPct: string;
  yearlyDiffWon: string;
}

export interface ReceiptPayload {
  receiptId: string;
  scenarioId: string;
  document: { id: string; version: string; hash: string };
  conceptsShown: string[];
  explanationMode: { style: "easy" | "detailed"; largeText: boolean };
  questions: ReceiptQuestion[];
  calculation: ReceiptCalculation | null;
  decision: { choice: "agree" | "decline"; at: string };
}

export interface ChainAttachment {
  network: string;
  chainId: number;
  contractAddress: string;
  txHash: string;
  blockNumber: number;
  recordedAt: string;
  issuerAddress: string;
  explorerTxUrl: string | null;
}

export interface ReceiptFile {
  payload: ReceiptPayload;
  recordHash: string;
  chainAttachment: ChainAttachment | null;
}
