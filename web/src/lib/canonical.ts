// 결과 무결성 해시 — api/hashing.py 와 바이트 단위로 같은 문자열을 만들어야 한다.
// 규칙: api/hashing.py 와 바이트 단위로 같아야 한다 (교차검증: tests/test_canonical_hash.py)
//   1. integrity 키 제거
//   2. 키 재귀 정렬, 공백 없음
//   3. float 금지 (정수형 number 는 허용, 소수는 문자열이어야 함)

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function assertNoFloat(value: Json, path = "$"): void {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(
        `해시 대상에 소수 number 가 있습니다 (${path}=${value}). ` +
          `소수는 문자열로 넣어야 합니다.`,
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoFloat(v, `${path}[${i}]`));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertNoFloat(v, `${path}.${k}`);
  }
}

function sortDeep(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const out: { [k: string]: Json } = {};
    for (const k of Object.keys(value).sort()) out[k] = sortDeep(value[k]);
    return out;
  }
  return value;
}

/** 정규화된 JSON 문자열. float 가 있으면 throw. */
export function canonicalJson(obj: unknown): string {
  const v = obj as Json;
  assertNoFloat(v);
  return JSON.stringify(sortDeep(v));
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 임의 객체의 정규화 SHA-256. `0x` 접두 포함. */
export async function sha256Hex(obj: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(obj));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return "0x" + toHex(digest);
}

/** 응답에서 integrity 를 뺀 것의 해시. api.hashing.result_hash 와 일치해야 한다. */
export async function resultHash(response: Record<string, unknown>): Promise<string> {
  const { integrity: _omit, ...rest } = response;
  void _omit;
  return sha256Hex(rest);
}

/** 영수증 해시 = payload 만의 해시. scripts/lib/canonical.mjs 의 recordHash 와 같은 규칙. */
export async function recordHash(payload: unknown): Promise<string> {
  return sha256Hex(payload);
}

/** 문서 버전 해시 = 그 버전 content 의 해시. scripts/lib/canonical.mjs 의 documentHash 와 같은 규칙. */
export async function documentHash(content: string): Promise<string> {
  return sha256Hex(content);
}
