// data/receipts-drafts/*.json (payload 초안, document.hash 없음) 을 봉인해
// data/receipts/<receiptId>.json (payload + recordHash + chainAttachment:null) 으로 만든다.
//
//   node scripts/seal-receipts.mjs                 # 전부
//   node scripts/seal-receipts.mjs privacy-agree   # 파일 이름 필터
//
// 콘텐츠(개념·설명·문항)가 바뀌어 초안을 다시 봉인하면 recordHash 도 달라진다.
// 이미 체인에 기록된 receiptId 를 다시 봉인하면 record-receipts.js 가 "체인과 다른 해시"로 막는다 —
// 그럴 땐 receiptId 를 새로 발급해야 한다 (영수증은 사실상 불변이라는 전제 때문).

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { documentHash, recordHash } from "./lib/canonical.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRAFTS_DIR = path.join(ROOT, "data", "receipts-drafts");
const DOCS_DIR = path.join(ROOT, "data", "documents");
const OUT_DIR = path.join(ROOT, "data", "receipts");

function loadDocument(id, version) {
  const p = path.join(DOCS_DIR, id, `${version}.json`);
  return JSON.parse(readFileSync(p, "utf8"));
}

const filter = process.argv[2] || "";
mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(DRAFTS_DIR).filter((f) => f.endsWith(".json") && f.includes(filter));
if (files.length === 0) throw new Error(`봉인할 초안이 없습니다: ${DRAFTS_DIR}`);

for (const file of files) {
  const draft = JSON.parse(readFileSync(path.join(DRAFTS_DIR, file), "utf8"));
  const payload = structuredClone(draft);

  const doc = loadDocument(payload.document.id, payload.document.version);
  payload.document.hash = documentHash(doc);

  const outPath = path.join(OUT_DIR, `${payload.receiptId}.json`);
  const hash = recordHash(payload);

  // 이미 봉인·기록된 영수증을 다시 봉인해도 체인 기록 정보는 잃지 않는다. 내용이 그대로면
  // (recordHash 가 같으면) 그 영수증은 체인의 같은 기록을 가리키는 게 맞다. 내용이 바뀌었다면
  // 그건 다른 영수증이므로 chainAttachment 를 버린다 — record-receipts.js 가 "체인과 다른 해시"로 막는다.
  const previous = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : null;
  const keptAttachment = previous?.recordHash === hash ? (previous.chainAttachment ?? null) : null;

  const receipt = {
    payload,
    recordHash: hash,
    chainAttachment: keptAttachment,
  };

  writeFileSync(outPath, JSON.stringify(receipt, null, 2) + "\n");
  const note = keptAttachment ? "  · 체인 기록 유지" : "";
  console.log(`✔ ${file} → ${path.relative(ROOT, outPath)}  (recordHash ${receipt.recordHash.slice(0, 14)}…)${note}`);
}
