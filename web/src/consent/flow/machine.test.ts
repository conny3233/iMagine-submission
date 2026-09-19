// 앱 ① 흐름 규칙 테스트 — 0918-team-plan.md §15 점검표의 자동 검사 버전.
//   npm test   (Node 24 의 TypeScript 실행 기능을 쓴다 — 별도 테스트 도구 없음)

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";

import * as nodeCanonical from "../../../../scripts/lib/canonical.mjs";
import type { DocumentVersion, ReceiptFile } from "../../vault/types";
import {
  currentQuestion,
  type FlowEvent,
  type FlowState,
  initialState,
  transition,
  wrongCount,
} from "./machine.ts";
import { buildReceipt } from "./receipt.ts";
import type { ScenarioContent } from "./types";

const ROOT = new URL("../../../../", import.meta.url);
const readJson = <T>(repoPath: string): T =>
  JSON.parse(readFileSync(new URL(`../../../../${repoPath}`, import.meta.url), "utf8")) as T;

const content = readJson<ScenarioContent>("data/content/privacy-complaint/v1.json");
const document = readJson<DocumentVersion>("data/documents/privacy-complaint/v1.json");
const AT = "2026-09-17T05:32:00Z";

function run(events: FlowEvent[], from: FlowState = initialState(content)): FlowState {
  return events.reduce((s, e) => transition(content, s, e), from);
}

/** 지금 출제된 문항에 정답(또는 오답)을 낸다. */
function answer(state: FlowState, correct: boolean): FlowState {
  const q = currentQuestion(content, state);
  assert.ok(q, `문항 단계가 아닙니다: ${state.phase.kind}`);
  const choiceId = correct ? q.answerId : q.choices.find((c) => c.id !== q.answerId)!.id;
  return transition(content, state, { type: "ANSWER", questionId: q.id, choiceId });
}

function passAll(state: FlowState = initialState(content)): FlowState {
  let s = state;
  while (s.phase.kind === "explain") s = answer(transition(content, s, { type: "READY" }), true);
  return s;
}

const contents: [string, ScenarioContent, DocumentVersion][] = [
  ["개인정보(엔진 검증용)", content, document],
  [
    "ISA 시연",
    readJson<ScenarioContent>("data/content/isa-discretionary/v1.json"),
    readJson<DocumentVersion>("data/documents/isa-discretionary/v1.json"),
  ],
  [
    "대출 시연",
    readJson<ScenarioContent>("data/content/ssdam-loan/v1.json"),
    readJson<DocumentVersion>("data/documents/ssdam-loan/v1.json"),
  ],
  // 간편대출 신청 때 함께 동의하는 서식 6종 (scripts/build-form-documents.py)
  ...["credit-inquiry", "loan-credit-info", "alt-credit-info", "kftc-credit-info", "alt-third-party", "suitability-check"].map(
    (id): [string, ScenarioContent, DocumentVersion] => [
      `대출 서식 ${id}`,
      readJson<ScenarioContent>(`data/content/${id}/v1.json`),
      readJson<DocumentVersion>(`data/documents/${id}/v1.json`),
    ],
  ),
];

describe("콘텐츠 형식", () => {
  for (const [name, c, doc] of contents) {
    test(`${name}: 개념마다 최초·재확인 문항이 서로 다르고, 정답이 선택지 안에 있다`, () => {
      for (const concept of c.concepts) {
        assert.notEqual(concept.questions[0].id, concept.questions[1].id);
        for (const q of concept.questions) {
          assert.ok(q.choices.some((ch) => ch.id === q.answerId), `${q.id} 정답이 선택지에 없음`);
        }
        assert.ok(
          doc.clauses.some((cl) => cl.id === concept.clauseId),
          `${concept.id} 의 조항 ${concept.clauseId} 가 문서에 없음`,
        );
      }
      for (const card of c.cards) {
        assert.ok(doc.clauses.some((cl) => cl.id === card.clauseId), `카드 조항 ${card.clauseId} 가 문서에 없음`);
      }
    });
  }

  test("시연 문서: 핵심조항 강조 좌표가 원문 쪽 안에 있다", () => {
    for (const [, , doc] of contents.slice(1)) {
      const pages = doc.sourcePages?.length ?? 0;
      for (const cl of doc.clauses) {
        assert.ok(cl.marks && cl.marks.length > 0, `${doc.id}/${cl.id} 강조 좌표 없음`);
        for (const m of cl.marks) {
          assert.ok(m.page >= 1 && m.page <= pages, `${doc.id}/${cl.id} 쪽 ${m.page} 이 원문(${pages}쪽) 밖`);
          assert.ok(m.x >= 0 && m.y >= 0 && m.x + m.w <= 100.5 && m.y + m.h <= 100.5, `${doc.id}/${cl.id} 좌표가 쪽 밖`);
        }
      }
    }
  });

  // 봉인된 시연 영수증과 같은 흐름을 앱에서 그대로 재현할 수 있어야 한다 (체인에 기록된 것은 바꿀 수 없다)
  for (const file of readdirSync(new URL("data/receipts/", ROOT)).filter((f) => f.endsWith(".json"))) {
    test(`${file} 의 답 기록이 지금 문항과 맞는다`, () => {
      const { payload } = readJson<ReceiptFile>(`data/receipts/${file}`);
      const found = contents.find(([, c]) => c.scenarioId === payload.scenarioId);
      assert.ok(found, `${payload.scenarioId} 콘텐츠가 없음`);
      const [, c] = found;
      for (const r of payload.questions) {
        const concept = c.concepts.find((x) => x.clauseId === r.conceptId);
        assert.ok(concept, `${r.conceptId} 개념이 없음`);
        const q = concept.questions[r.attempt - 1];
        assert.ok(q.choices.some((ch) => ch.id === r.choiceId), `${q.id} 에 선택지 ${r.choiceId} 가 없음`);
        assert.equal(q.answerId === r.choiceId, r.correct, `${q.id}: 기록은 ${r.correct ? "정답" : "오답"}`);
      }
    });
  }
});

describe("개인정보 정상 진행", () => {
  test("모든 개념을 통과하면 최종 선택 화면으로 가고, 자동으로 동의되지 않는다", () => {
    const s = passAll();
    assert.equal(s.phase.kind, "decide");
    assert.deepEqual(s.shown, ["P1", "P2", "P3"]);
    assert.equal(s.answers.length, 3);
    assert.ok(s.answers.every((a) => a.correct && a.attempt === 1));
  });

  test("동의 → 영수증의 해시가 기록 스크립트(Node)와 바이트 단위로 같다", async () => {
    const done = transition(content, passAll(), { type: "DECIDE", choice: "agree", at: AT });
    const receipt = await buildReceipt(content, done, { receiptId: "rcpt_test_0001", document });

    assert.equal(receipt.payload.decision.choice, "agree");
    assert.deepEqual(receipt.payload.conceptsShown, ["purpose", "retention-period", "refusal"]);
    assert.equal(receipt.payload.document.hash, nodeCanonical.documentHash(document));
    assert.equal(receipt.recordHash, nodeCanonical.recordHash(receipt.payload));
    assert.equal(receipt.chainAttachment, null);
  });
});

describe("오답 후 정답", () => {
  test("그 개념만 재설명하고, 다른 문항을 낸 뒤 다음 개념으로 간다", () => {
    let s = answer(run([{ type: "READY" }]), true); // P1 통과
    s = answer(transition(content, s, { type: "READY" }), false); // P2 최초 오답

    assert.deepEqual(s.phase, { kind: "remedial", conceptIndex: 1 });
    s = transition(content, s, { type: "RETRY" });
    assert.equal(currentQuestion(content, s)?.id, "P2-B");

    s = answer(s, true);
    assert.deepEqual(s.phase, { kind: "explain", conceptIndex: 2 });
    assert.deepEqual(
      s.answers.map((a) => [a.questionId, a.attempt, a.correct]),
      [
        ["P1-A", 1, true],
        ["P2-A", 1, false],
        ["P2-B", 2, true],
      ],
    );
  });
});

describe("재확인도 오답", () => {
  const wrongTwice = () =>
    answer(transition(content, answer(run([{ type: "READY" }]), false), { type: "RETRY" }), false);

  test("멈추지 않고 다음 개념으로 간다", () => {
    const s = wrongTwice();
    assert.equal(s.phase.kind, "explain");
    assert.equal("conceptIndex" in s.phase && s.phase.conceptIndex, 1);
    assert.equal(wrongCount(s), 2);
  });

  test("끝까지 풀면 틀린 개수와 함께 최종 선택 화면으로 가고, 동의 여부는 이용자가 고른다", async () => {
    const s = passAll(wrongTwice());
    assert.deepEqual(s.phase, { kind: "decide" });
    assert.equal(wrongCount(s), 2);

    const agreed = transition(content, s, { type: "DECIDE", choice: "agree", at: AT });
    assert.deepEqual(agreed.phase, { kind: "done", choice: "agree", at: AT });
    const receipt = await buildReceipt(content, agreed, { receiptId: "rcpt_test_0004", document });
    assert.deepEqual(
      receipt.payload.questions.filter((q) => !q.correct).map((q) => q.attempt),
      [1, 2],
    );

    const declined = transition(content, s, { type: "DECIDE", choice: "decline", at: AT });
    assert.deepEqual(declined.phase, { kind: "done", choice: "decline", at: AT });
  });

  test("다 풀기 전에는 동의할 수 없다", () => {
    const tried = transition(content, wrongTwice(), { type: "DECIDE", choice: "agree", at: AT });
    assert.equal(tried.phase.kind, "explain");
    assert.ok(tried.rejection);
  });
});

describe("거부 선택", () => {
  test("설명을 읽는 중에도 거부할 수 있고, 거부 영수증이 나온다", async () => {
    const s = transition(content, initialState(content), { type: "DECIDE", choice: "decline", at: AT });
    const receipt = await buildReceipt(content, s, { receiptId: "rcpt_test_0002", document });
    assert.equal(receipt.payload.decision.choice, "decline");
    assert.deepEqual(receipt.payload.questions, []);
  });
});

describe("임의 문항·선택지 제출", () => {
  test("지금 출제되지 않은 문항은 거부하고 상태를 바꾸지 않는다", () => {
    const s = run([{ type: "READY" }]);
    const bad = transition(content, s, { type: "ANSWER", questionId: "P3-A", choiceId: "C" });
    assert.match(bad.rejection ?? "", /P1-A/);
    assert.deepEqual({ ...bad, rejection: null }, s);
  });

  test("없는 선택지는 거부한다", () => {
    const bad = transition(content, run([{ type: "READY" }]), { type: "ANSWER", questionId: "P1-A", choiceId: "Z" });
    assert.ok(bad.rejection);
    assert.equal(bad.answers.length, 0);
  });

  test("설명 단계에서 답을 내면 거부한다", () => {
    const bad = transition(content, initialState(content), { type: "ANSWER", questionId: "P1-A", choiceId: "B" });
    assert.ok(bad.rejection);
  });
});

describe("중복 클릭", () => {
  test("같은 답을 두 번 보내도 기록은 하나다", () => {
    const click: FlowEvent = { type: "ANSWER", questionId: "P1-A", choiceId: "B" };
    const s = run([{ type: "READY" }, click, click]);
    assert.equal(s.answers.length, 1);
    assert.ok(s.rejection);
  });

  test("최종 선택을 두 번 눌러도 처음 선택이 유지된다", () => {
    const s = run(
      [
        { type: "DECIDE", choice: "agree", at: AT },
        { type: "DECIDE", choice: "decline", at: "2026-09-17T05:33:00Z" },
      ],
      passAll(),
    );
    assert.deepEqual(s.phase, { kind: "done", choice: "agree", at: AT });
    assert.ok(s.rejection);
  });

  test("끝나기 전에는 영수증을 만들 수 없다", async () => {
    await assert.rejects(buildReceipt(content, passAll(), { receiptId: "x", document }));
  });
});

describe("설명 방식", () => {
  test("쉬운 설명·큰 글씨 선택이 영수증에 남는다", async () => {
    const s = run(
      [
        { type: "SET_MODE", style: "detailed" },
        { type: "SET_MODE", largeText: true },
      ],
      initialState(content),
    );
    const done = transition(content, passAll(s), { type: "DECIDE", choice: "agree", at: AT });
    const receipt = await buildReceipt(content, done, { receiptId: "rcpt_test_0003", document });
    assert.deepEqual(receipt.payload.explanationMode, { style: "detailed", largeText: true });
  });
});
