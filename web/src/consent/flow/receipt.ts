// 끝난 흐름 → 영수증 파일. 형식은 앱 ② 가 이미 읽고 있는 data/receipts 와 똑같아야 해서
// 타입도 vault/types 를 그대로 쓴다 (두 앱 공용이라 나중에 src/lib 로 옮길 대상).
// 해시 규칙은 lib/canonical.ts 한 벌 — scripts/seal-receipts.mjs 가 만드는 값과 같아야 한다.

import { documentHash, recordHash } from "../../lib/canonical.ts";
import type { DocumentVersion, ReceiptCalculation, ReceiptFile, ReceiptPayload } from "../../vault/types";
import type { FlowState } from "./machine";
import type { ScenarioContent } from "./types";

/** 카드 순서대로 읽은 조항 + (카드에 없는데 문제를 낸 조항이 있으면) 그 조항까지. */
function clausesRead(content: ScenarioContent, state: FlowState): string[] {
  const out = content.cards.map((c) => c.clauseId);
  for (const concept of content.concepts) {
    if (state.shown.includes(concept.id) && !out.includes(concept.clauseId)) out.push(concept.clauseId);
  }
  return out;
}

export async function buildReceipt(
  content: ScenarioContent,
  state: FlowState,
  opts: { receiptId: string; document: DocumentVersion; calculation?: ReceiptCalculation | null },
): Promise<ReceiptFile> {
  const { phase } = state;
  if (phase.kind !== "done") throw new Error("최종 선택 전에는 영수증을 만들 수 없습니다.");
  if (opts.document.id !== content.document.id || opts.document.version !== content.document.version) {
    throw new Error(
      `콘텐츠(${content.document.id}@${content.document.version})와 ` +
        `문서(${opts.document.id}@${opts.document.version})의 버전이 다릅니다.`,
    );
  }

  // 영수증에는 개념 id(P1) 대신 문서 조항 id 를 남긴다 — 앱 ② 는 조항 id 로 제목을 찾는다.
  const clauseOf = new Map(content.concepts.map((c) => [c.id, c.clauseId]));
  const toClause = (conceptId: string): string => {
    const clauseId = clauseOf.get(conceptId);
    if (!clauseId) throw new Error(`콘텐츠에 없는 개념입니다: ${conceptId}`);
    return clauseId;
  };

  const payload: ReceiptPayload = {
    receiptId: opts.receiptId,
    scenarioId: content.scenarioId,
    document: {
      id: opts.document.id,
      version: opts.document.version,
      hash: await documentHash(opts.document.content),
    },
    // "확인한 조항" = 읽기 화면에서 보여 준 조항(쉬운 설명 카드 = 이 문서의 핵심 조항) 전부.
    // 문제를 낸 조항만 적으면, 실제로 읽은 조항이 영수증에서 빠진다. 카드가 없는 콘텐츠(엔진 검증용)는
    // 흐름에서 보여 준 개념을 그대로 쓴다.
    conceptsShown: content.cards.length > 0 ? clausesRead(content, state) : state.shown.map(toClause),
    explanationMode: { style: state.mode.style, largeText: state.mode.largeText },
    questions: state.answers.map((a) => ({
      conceptId: toClause(a.conceptId),
      attempt: a.attempt,
      correct: a.correct,
      choiceId: a.choiceId,
    })),
    // 화면에서 실제로 본 계산만 남긴다 — 안 봤으면 null (계획서 §11: 화면 값과 영수증 값이 같아야 한다)
    calculation: opts.calculation ?? null,
    decision: { choice: phase.choice, at: phase.at },
  };

  return { payload, recordHash: await recordHash(payload), chainAttachment: null };
}
