// POST /api/record — 앱 ①에서 방금 끝낸 동의(동의·거부 모두)의 영수증을 블록체인에 적는다.
//
// 서명 키는 이 서버에만 있다 (Vercel 환경변수 RECORDER_PRIVATE_KEY). 화면에는 키가 없다.
// 체인에는 지문(recordHash)·문서 지문·문서 이름만 올라간다 — 답변 내용은 이용자 기기에만 남는다.
//
//   GET  /api/record          → 기록 서버 준비 상태 (키가 있는지, 기록 주소)
//   POST /api/record {payload} → { receiptId, recordHash, txHash }
//
// 보낸 뒤 채굴을 기다리지 않는다 (함수 시간 제한). 화면이 공개 RPC 로 거래 영수증을 읽어 확인한다.
// 지문은 서버가 payload 로 직접 다시 계산한다 — 화면이 보낸 해시를 믿지 않는다.

import { Contract, JsonRpcProvider, Network, Wallet } from "ethers";

import { checkPayload, recordHash, REGISTRY, toBytes32 } from "./_lib/rules.js";

const ABI = [
  "function record(bytes32 receiptId, bytes32 recordHash, bytes32 documentHash, string documentRef)",
  "function exists(bytes32 receiptId) view returns (bool)",
  "function get(bytes32 receiptId) view returns (tuple(bytes32 recordHash, bytes32 documentHash, string documentRef, uint64 recordedAt, address issuer))",
];

const RPC_URL = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const MAX_BODY = 16 * 1024;

// 제출용 HTML(file://)도 같은 서버로 기록하므로 출처를 가리지 않는다. 막는 건 CORS 가 아니라 checkPayload 다.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

// 인스턴스 하나 안에서만 세는 느슨한 제한 — 테스트넷 잔액이 한 사람 장난으로 바닥나지 않게.
const WINDOW_MS = 60 * 1000;
const PER_WINDOW = 6;
const hits = new Map();

function tooMany(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > PER_WINDOW;
}

// 거래 순번(nonce). 연달아 들어온 두 요청이 공개 RPC 에서 같은 "다음 순번"을 받으면 한쪽이 거절된다
// ("replacement fee too low" 등). 마지막으로 쓴 순번을 기억하고, 겹치면 다음 순번으로 다시 보낸다.
let lastNonce = -1;
const NONCE_CLASH = /nonce too low|replacement (fee|transaction) (too low|underpriced)|already known|nonce has already been used/i;

async function sendRecord(wallet, registry, args) {
  for (let attempt = 0; ; attempt++) {
    const nonce = Math.max(await wallet.getNonce("pending"), lastNonce + 1);
    try {
      const tx = await registry.record(...args, { nonce });
      lastNonce = nonce;
      return tx;
    } catch (e) {
      const message = e?.shortMessage ?? e?.message ?? String(e);
      if (attempt >= 4 || !NONCE_CLASH.test(message)) throw e;
      lastNonce = nonce; // 이 순번은 누가 썼다 — 다음 것으로
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS },
  });
}

function signer() {
  const key = process.env.RECORDER_PRIVATE_KEY;
  if (!key) return null;
  const network = Network.from(REGISTRY.chainId);
  const provider = new JsonRpcProvider(RPC_URL, network, { staticNetwork: network });
  return new Wallet(key, provider);
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export function GET() {
  const wallet = signer();
  return json(200, {
    ready: !!wallet,
    chainId: REGISTRY.chainId,
    contractAddress: REGISTRY.address,
    issuer: wallet?.address ?? null,
  });
}

export async function POST(request) {
  const wallet = signer();
  if (!wallet) {
    return json(503, { error: "기록 서버에 기록용 열쇠가 아직 없습니다. 관리자가 설정하면 기록됩니다." });
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (tooMany(ip)) return json(429, { error: "잠시 뒤에 다시 시도해 주세요." });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: "영수증이 너무 큽니다." });
  let payload;
  try {
    payload = JSON.parse(raw).payload;
  } catch {
    return json(400, { error: "영수증을 읽지 못했습니다." });
  }

  const problem = checkPayload(payload);
  if (problem) return json(422, { error: problem });

  const hash = recordHash(payload);
  const id = toBytes32(payload.receiptId);
  const registry = new Contract(REGISTRY.address, ABI, wallet);

  try {
    if (await registry.exists(id)) {
      const onChain = await registry.get(id);
      if (onChain.recordHash.toLowerCase() === hash) {
        // 같은 영수증을 두 번 보냈다 (새로고침·재시도). 이미 적혀 있으니 성공으로 돌려준다.
        return json(200, { receiptId: payload.receiptId, recordHash: hash, txHash: null, alreadyRecorded: true });
      }
      return json(409, { error: "같은 번호의 다른 영수증이 이미 적혀 있습니다." });
    }
    const tx = await sendRecord(wallet, registry, [
      id,
      hash,
      payload.document.hash,
      `${payload.document.id}@${payload.document.version}`,
    ]);
    return json(202, { receiptId: payload.receiptId, recordHash: hash, txHash: tx.hash, alreadyRecorded: false });
  } catch (e) {
    const message = e?.shortMessage ?? e?.message ?? String(e);
    console.error("record failed", payload.receiptId, message);
    if (/insufficient funds/i.test(message)) {
      return json(503, { error: "기록용 지갑의 테스트넷 잔액이 부족합니다." });
    }
    return json(502, { error: "블록체인에 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요." });
  }
}
