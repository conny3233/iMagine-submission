// 영수증을 블록체인에 적는 순서 — 두 앱이 같이 쓴다.
//   1. 기록 서버(web/api/record.js)에 payload 를 보낸다. 서명은 서버가 한다.
//   2. 서버가 돌려준 거래가 블록에 들어갔는지 공개 RPC 로 직접 확인한다 (lib/chain.ts).
//   3. 확인되면 영수증에 거래 정보(chainAttachment)를 붙인다. 이건 지문 대상이 아니라 지문은 그대로다.
// 앱 ①을 도중에 닫아도 iMprint 가 열릴 때 resumeRecording() 으로 이어서 확인한다.

import { waitForRecorded } from "./chain";
import { OFFLINE_BUILD, assetUrl } from "./paths";
import { getStored, listStored, updateStored } from "./receiptStore";

/** 제출용 HTML(file://)은 서버가 없어서 배포된 기록 서버를 쓴다. */
const PRODUCTION_API = "https://i-magine-yzla.vercel.app/api/record";
export const RECORD_API: string =
  import.meta.env.VITE_RECORD_API || (OFFLINE_BUILD ? PRODUCTION_API : assetUrl("/api/record"));

const inFlight = new Set<string>();

async function send(payload: unknown): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(RECORD_API, {
      method: "POST",
      // text/plain 이면 브라우저가 사전 확인(preflight) 없이 바로 보낸다 — 제출용 HTML(file://)에서도 한 번에 간다.
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ payload }),
    });
  } catch {
    throw new Error("기록 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.");
  }
  const body = (await res.json().catch(() => ({}))) as { txHash?: string | null; error?: string };
  if (!res.ok) throw new Error(body.error ?? `기록 서버가 응답하지 않았어요 (${res.status}).`);
  return body.txHash ?? null;
}

/** 이 영수증을 체인에 적는다. 이미 하는 중이면 아무것도 안 한다. 결과는 보관함(receiptStore)에 남는다. */
export async function recordReceipt(receiptId: string, { resend = false } = {}): Promise<void> {
  if (inFlight.has(receiptId)) return;
  const entry = getStored(receiptId);
  if (!entry || entry.receipt.chainAttachment) return;
  inFlight.add(receiptId);
  try {
    let txHash = entry.txHash;
    // 보낸 적이 있으면(거래 번호가 있거나 "기다리는 중") 다시 보내지 않고 체인에서 찾는다.
    if (resend || (!txHash && entry.status !== "mining")) {
      updateStored(receiptId, { status: "sending", error: null });
      txHash = await send(entry.receipt.payload);
    }
    updateStored(receiptId, { status: "mining", txHash, error: null });
    const attachment = await waitForRecorded(receiptId, txHash);
    const latest = getStored(receiptId);
    if (!latest) return;
    updateStored(receiptId, {
      status: "recorded",
      error: null,
      receipt: { ...latest.receipt, chainAttachment: attachment },
    });
  } catch (e) {
    updateStored(receiptId, { status: "failed", error: e instanceof Error ? e.message : String(e) });
  } finally {
    inFlight.delete(receiptId);
  }
}

/** 끝나지 않은 기록을 이어서 확인한다 (실패한 건 사람이 "다시 적기"를 누를 때까지 둔다). */
export function resumeRecording(): void {
  for (const e of listStored()) {
    if (e.status === "sending" || e.status === "mining") void recordReceipt(e.receipt.payload.receiptId);
  }
}
