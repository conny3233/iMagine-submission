// 정규화 JSON 해시 (Node) — web/src/lib/canonical.ts · api/hashing.py 와 바이트 단위로 같아야 한다.
// 교차검증: tests/test_canonical_hash.py (Python == Node)
//   1. 키 재귀 정렬, 공백 없음
//   2. float 금지 (정수 number 는 허용, 소수는 문자열)

import { createHash } from "node:crypto";

function assertNoFloat(value, path = "$") {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(`float at ${path}: ${value}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoFloat(v, `${path}[${i}]`));
  } else if (value && typeof value === "object") {
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

export function canonicalJson(obj) {
  assertNoFloat(obj);
  return JSON.stringify(sortDeep(obj));
}

export function sha256Hex(obj) {
  return "0x" + createHash("sha256").update(canonicalJson(obj), "utf8").digest("hex");
}

export function resultHash(response) {
  const { integrity: _omit, ...rest } = response;
  void _omit;
  return sha256Hex(rest);
}

/** 영수증 해시 = payload 만의 해시. recordHash·chainAttachment 는 해시 대상이 아니다. */
export function recordHash(payload) {
  return sha256Hex(payload);
}

/** 문서 버전 해시 = 그 버전 content 의 해시. 제목·메타데이터가 아니라 조항 본문이 기준이다. */
export function documentHash(documentVersion) {
  return sha256Hex(documentVersion.content);
}

/** 사람이 읽는 식별자(receiptId 등)를 컨트랙트의 bytes32 로. 이미 0x+64hex 면 그대로 쓴다.
 * web/src/lib/chain.ts 의 동명 함수와 반드시 같은 규칙이어야 한다 — 다르면 같은 영수증이
 * 기록 스크립트와 앱에서 서로 다른 온체인 슬롯을 가리키게 된다. */
export function toBytes32(hexOrStr) {
  if (hexOrStr.startsWith("0x") && hexOrStr.length === 66) return hexOrStr;
  return "0x" + createHash("sha256").update(hexOrStr, "utf8").digest("hex");
}
