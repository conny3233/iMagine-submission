// 기록 서버(api/record.js)의 규칙 — 네트워크·키 없이 돌아가는 부분만 모았다 (단위 테스트 대상).
//
// 해시 규칙은 web/src/lib/canonical.ts · scripts/lib/canonical.mjs 와 바이트 단위로 같아야 한다.
// 이 폴더는 Vercel 함수로 따로 묶여 나가서 src/ 의 TS 를 가져다 쓸 수 없다 — 그래서 한 벌 더 두고,
// 같은 값이 나오는지는 src/lib/record-rules.test.ts 가 기존 영수증·문서로 확인한다.

import { createHash } from "node:crypto";

function assertNoFloat(value, path = "$") {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new Error(`float at ${path}: ${value}`);
    return;
  }
  if (Array.isArray(value)) value.forEach((v, i) => assertNoFloat(v, `${path}[${i}]`));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertNoFloat(v, `${path}.${k}`);
  }
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortDeep(value[k]);
    return out;
  }
  return value;
}

export function recordHash(payload) {
  assertNoFloat(payload);
  return "0x" + createHash("sha256").update(JSON.stringify(sortDeep(payload)), "utf8").digest("hex");
}

export function toBytes32(receiptId) {
  return "0x" + createHash("sha256").update(receiptId, "utf8").digest("hex");
}

/** 기록할 장부 — contract/deployments/sepolia.json 과 같아야 한다 (테스트가 확인). */
export const REGISTRY = {
  network: "sepolia",
  chainId: 11155111,
  address: "0x83c8B1AF7A0D215Bcd9c744F16Bf05B9AFCBBAEe",
};

/**
 * 앱에서 동의받는 문서 버전과 그 지문. 여기 없는 문서의 영수증은 기록하지 않는다 —
 * 엔진 검증용 픽스처(privacy-complaint)나 지어낸 문서가 기관 주소로 체인에 올라가지 않게.
 * 값은 data/documents 의 content 해시와 같아야 한다 (테스트가 확인).
 */
export const KNOWN_DOCUMENTS = {
  "isa-discretionary@v1": "0x3d125216614ff9a924c82b153d939a1178437183568e30e33d8d100c3f059ff0",
  "ssdam-loan@v1": "0x731693e1a9e973a6e0a394bdda1718c9bee1129feede43271356c464c1f14cdc",
  // 쓰담쓰담 간편대출 신청 때 함께 동의하는 서식 (2026-09-18, scripts/build-form-documents.py)
  "credit-inquiry@v1": "0x923a5dcbc6741224e5c13eebc8f9c473803639a6b3c1ca0b21560cded8bd3fc5",
  "loan-credit-info@v1": "0x44b4a0fa3ed77186e2f3c5264c491f570f4fc7b87747dbabc8db828efb3a1800",
  "alt-credit-info@v1": "0xb0273eacbdab3e785dd91cb58b92e12b426d000975a50b84c3ce0e887b4e7c69",
  "kftc-credit-info@v1": "0xe1f21a284ffe9ad7904524d62cb923becee2b91986cf0d4968dc81b8cc9fb175",
  "alt-third-party@v1": "0x60d33032c97ac78db1d4043edd9012c893bf3cb6992ed56148449e1f9f94067e",
  "suitability-check@v1": "0x5b82cfbfad820485e1031f6e746daad7910715b6a4182b89747e804fa1c0e428",
};

/** 앱 ①이 만드는 영수증 번호. 미리 기록한 rcpt_isa_0001 같은 번호는 앱에서 쓸 수 없다. */
export const APP_RECEIPT_ID = /^rcpt_app_[0-9a-f]{16}$/;

/** 동의 시각과 서버 시각의 허용 차이. 오래된 영수증을 뒤늦게 기관 이름으로 올리지 못하게. */
export const MAX_CLOCK_SKEW_MS = 15 * 60 * 1000;

const ID = /^[a-z0-9-]{1,64}$/;
const DIGITS = /^\d{1,15}$/;
const PCT = /^\d{1,2}(\.\d{1,2})?$/;

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function hasOnlyKeys(obj, keys) {
  const actual = Object.keys(obj).sort();
  return actual.length === keys.length && [...keys].sort().every((k, i) => k === actual[i]);
}

/**
 * payload 모양 점검. 문제가 있으면 사람이 읽을 이유를, 없으면 null 을 돌려준다.
 * 체인에는 지문만 올라가므로 여기서 막는 건 "기관 주소로 아무거나 적히는 것"이다.
 */
export function checkPayload(payload, now = Date.now()) {
  if (!isPlainObject(payload)) return "영수증 내용이 없습니다.";
  const keys = ["receiptId", "scenarioId", "document", "conceptsShown", "explanationMode", "questions", "calculation", "decision"];
  if (!hasOnlyKeys(payload, keys)) return "영수증 항목이 정해진 모양과 다릅니다.";

  if (typeof payload.receiptId !== "string" || !APP_RECEIPT_ID.test(payload.receiptId)) {
    return "영수증 번호 형식이 다릅니다.";
  }
  if (typeof payload.scenarioId !== "string" || !/^[a-z0-9-]{1,64}$/.test(payload.scenarioId)) {
    return "시나리오 이름 형식이 다릅니다.";
  }

  const doc = payload.document;
  if (!isPlainObject(doc) || !hasOnlyKeys(doc, ["id", "version", "hash"])) return "문서 정보가 없습니다.";
  const known = KNOWN_DOCUMENTS[`${doc.id}@${doc.version}`];
  if (!known) return "이 앱에서 동의받는 문서가 아닙니다.";
  if (doc.hash !== known) return "문서 지문이 원문과 다릅니다.";

  if (
    !Array.isArray(payload.conceptsShown) ||
    payload.conceptsShown.length > 40 ||
    !payload.conceptsShown.every((c) => typeof c === "string" && ID.test(c))
  ) {
    return "확인한 조항 목록 형식이 다릅니다.";
  }

  const mode = payload.explanationMode;
  if (
    !isPlainObject(mode) ||
    !hasOnlyKeys(mode, ["style", "largeText"]) ||
    !["easy", "detailed"].includes(mode.style) ||
    typeof mode.largeText !== "boolean"
  ) {
    return "읽은 방식 형식이 다릅니다.";
  }

  if (!Array.isArray(payload.questions) || payload.questions.length > 40) return "확인 문제 형식이 다릅니다.";
  for (const q of payload.questions) {
    if (
      !isPlainObject(q) ||
      !hasOnlyKeys(q, ["conceptId", "attempt", "correct", "choiceId"]) ||
      typeof q.conceptId !== "string" ||
      !ID.test(q.conceptId) ||
      (q.attempt !== 1 && q.attempt !== 2) ||
      typeof q.correct !== "boolean" ||
      typeof q.choiceId !== "string" ||
      !/^[A-Z]$/.test(q.choiceId)
    ) {
      return "확인 문제 형식이 다릅니다.";
    }
  }

  const calc = payload.calculation;
  if (calc !== null) {
    if (
      !isPlainObject(calc) ||
      !hasOnlyKeys(calc, ["principal", "rateBeforePct", "rateAfterPct", "yearlyDiffWon"]) ||
      !DIGITS.test(calc.principal) ||
      !PCT.test(calc.rateBeforePct) ||
      !PCT.test(calc.rateAfterPct) ||
      !DIGITS.test(calc.yearlyDiffWon)
    ) {
      return "계산 결과 형식이 다릅니다.";
    }
  }

  const decision = payload.decision;
  if (!isPlainObject(decision) || !hasOnlyKeys(decision, ["choice", "at"])) return "결정 형식이 다릅니다.";
  if (decision.choice !== "agree" && decision.choice !== "decline") return "결정은 동의 또는 동의하지 않음이어야 합니다.";
  const at = typeof decision.at === "string" ? Date.parse(decision.at) : NaN;
  if (!Number.isFinite(at)) return "결정 시각 형식이 다릅니다.";
  if (Math.abs(now - at) > MAX_CLOCK_SKEW_MS) return "결정 시각이 지금과 너무 멉니다. 방금 한 동의만 기록합니다.";

  try {
    recordHash(payload);
  } catch {
    return "소수는 문자열로 적어야 합니다.";
  }
  return null;
}
