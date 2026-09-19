// 정규화 JSON 해시 CLI — 규칙 구현은 scripts/lib/canonical.mjs 에 있다.
// tests/test_canonical_hash.py 가 이 출력과 Python 해시가 일치하는지 검증한다.
//
//   node scripts/hash-check.mjs <json파일>            # 파일 전체의 sha256_hex
//   node scripts/hash-check.mjs <json파일> --result   # integrity 키 제거 후 (result_hash)

import { readFileSync } from "node:fs";

import { resultHash, sha256Hex } from "./lib/canonical.mjs";

const [, , file, mode] = process.argv;
if (!file) {
  console.error("usage: node scripts/hash-check.mjs <json파일> [--result]");
  process.exit(2);
}
const data = JSON.parse(readFileSync(file, "utf8"));
process.stdout.write(mode === "--result" ? resultHash(data) : sha256Hex(data));
