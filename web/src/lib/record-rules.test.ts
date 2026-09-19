// 기록 서버 규칙(api/_lib/rules.js) 테스트 — 서버가 계산하는 지문이 앱·기록 스크립트와 같은지,
// 그리고 이상한 영수증을 기관 주소로 적지 않는지.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";

import * as nodeCanonical from "../../../scripts/lib/canonical.mjs";
import * as rules from "../../api/_lib/rules.js";
import type { DocumentVersion, ReceiptFile, ReceiptPayload } from "../vault/types";
import { recordHash as browserRecordHash } from "./canonical.ts";

const ROOT = new URL("../../../", import.meta.url);
const readJson = <T>(repoPath: string): T => JSON.parse(readFileSync(new URL(repoPath, ROOT), "utf8")) as T;

const receipts = readdirSync(new URL("data/receipts/", ROOT))
  .filter((f) => f.endsWith(".json"))
  .map((f) => readJson<ReceiptFile>(`data/receipts/${f}`));

/** 기록된 대출 영수증을 "방금 앱에서 만든 영수증"으로 바꾼 것. */
function appPayload(overrides: Partial<ReceiptPayload> = {}): ReceiptPayload {
  const base = structuredClone(receipts.find((r) => r.payload.document.id === "ssdam-loan")!.payload);
  return { ...base, receiptId: "rcpt_app_0123456789abcdef", decision: { choice: "agree", at: new Date().toISOString() }, ...overrides };
}

describe("서버 지문 = 앱 지문 = 기록 스크립트 지문", () => {
  test("기록된 영수증 전부에서 같은 값", async () => {
    assert.ok(receipts.length >= 2);
    for (const r of receipts) {
      const server = rules.recordHash(r.payload);
      assert.equal(server, r.recordHash, r.payload.receiptId);
      assert.equal(server, nodeCanonical.recordHash(r.payload));
      assert.equal(server, await browserRecordHash(r.payload));
    }
  });

  test("영수증 번호 → 체인 칸 번호도 같은 규칙", () => {
    for (const id of ["rcpt_isa_0001", "rcpt_app_0123456789abcdef"]) {
      assert.equal(rules.toBytes32(id), nodeCanonical.toBytes32(id));
    }
  });

  test("허용 문서 지문 = data/documents 원문 지문", () => {
    for (const [ref, hash] of Object.entries(rules.KNOWN_DOCUMENTS)) {
      const [id, version] = ref.split("@");
      const doc = readJson<DocumentVersion>(`data/documents/${id}/${version}.json`);
      assert.equal(hash, nodeCanonical.documentHash(doc), ref);
    }
  });

  test("기록 장부 주소 = 배포 기록", () => {
    const d = readJson<{ chainId: number; address: string }>("contract/deployments/sepolia.json");
    assert.equal(rules.REGISTRY.chainId, d.chainId);
    assert.equal(rules.REGISTRY.address, d.address);
  });
});

describe("기록 전 점검", () => {
  test("방금 만든 동의·거부 영수증은 통과", () => {
    assert.equal(rules.checkPayload(appPayload()), null);
    assert.equal(rules.checkPayload(appPayload({ decision: { choice: "decline", at: new Date().toISOString() }, calculation: null })), null);
  });

  test("막아야 하는 것", () => {
    const now = Date.now();
    const cases: [string, unknown][] = [
      ["미리 기록한 번호", appPayload({ receiptId: "rcpt_loan_0002" })],
      ["엔진 검증용 문서", appPayload({ document: { id: "privacy-complaint", version: "v1", hash: "0x" + "0".repeat(64) } })],
      ["원문과 다른 문서 지문", appPayload({ document: { id: "ssdam-loan", version: "v1", hash: "0x" + "1".repeat(64) } })],
      ["오래된 결정 시각", appPayload({ decision: { choice: "agree", at: new Date(now - 60 * 60 * 1000).toISOString() } })],
      ["모르는 결정", appPayload({ decision: { choice: "maybe" as "agree", at: new Date(now).toISOString() } })],
      ["항목 추가", { ...appPayload(), name: "김민재" }],
      ["소수 number", appPayload({ questions: [{ conceptId: "credit-loan", attempt: 1.5 as 1, correct: true, choiceId: "A" }] })],
      ["빈 값", null],
    ];
    for (const [label, payload] of cases) {
      assert.notEqual(rules.checkPayload(payload, now), null, label);
    }
  });
});
