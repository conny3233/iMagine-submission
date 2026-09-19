// 앱 ①에서 발급한 영수증을 이 기기에 모아 두는 곳. 앱 ② iMprint 가 같은 곳을 읽는다.
//
// 두 앱은 같은 주소(도메인)의 두 페이지라 localStorage 를 같이 쓴다. 다른 브라우저에서 열면 보관함이
// 달라서, 앱 ①의 "iMprint 에서 보기" 링크가 영수증을 주소 뒤(#import=…)에 실어 보낸다 — importLink().
// 실서비스라면 이용자 계정 저장소에 둘 자리다. 저장이 막힌 브라우저(시크릿 창 등)에서는 이 화면에만 남는다.

import { useSyncExternalStore } from "react";

import type { ReceiptFile } from "../vault/types";
import { recordHash } from "./canonical";

/** sending = 기록 서버에 보내는 중 · mining = 블록에 들어가길 기다리는 중 · recorded · failed */
export type RecordStatus = "sending" | "mining" | "recorded" | "failed";

export interface StoredReceipt {
  receipt: ReceiptFile;
  status: RecordStatus;
  txHash: string | null;
  error: string | null;
}

const KEY = "imprint.receipts.v1";
const EVENT = "imprint-receipts";

let memory: StoredReceipt[] = [];
let cachedRaw: string | null | undefined;
let cachedList: StoredReceipt[] = [];

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function snapshot(): StoredReceipt[] {
  const raw = readRaw();
  if (raw === null) return memory;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed = JSON.parse(raw) as StoredReceipt[];
      cachedList = Array.isArray(parsed) ? parsed.filter((e) => e?.receipt?.payload?.receiptId) : [];
    } catch {
      cachedList = [];
    }
  }
  return cachedList;
}

function write(list: StoredReceipt[]): void {
  memory = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 저장이 막힌 브라우저 — memory 에만 둔다.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function listStored(): StoredReceipt[] {
  return snapshot();
}

export function getStored(receiptId: string): StoredReceipt | undefined {
  return snapshot().find((e) => e.receipt.payload.receiptId === receiptId);
}

function sameDocument(a: StoredReceipt, b: StoredReceipt): boolean {
  const x = a.receipt.payload.document;
  const y = b.receipt.payload.document;
  return x.id === y.id && x.version === y.version;
}

function decidedAt(e: StoredReceipt): number {
  return Date.parse(e.receipt.payload.decision.at);
}

/**
 * 없으면 넣는다. 이미 있으면 그대로 둔다 (다시 불러와도 기록 상태를 덮어쓰지 않게).
 * 같은 약관(같은 버전)에는 가장 최근 결정 하나만 둔다 — 같은 약관에 다시 동의·거부하면 앞의 영수증을
 * 보관함에서 뺀다 (2026-09-18 결정: 같은 내용이 쌓여 보였다). 앞의 체인 기록은 지울 수 없어 그대로 남는다.
 */
export function addStored(entry: StoredReceipt): void {
  const list = snapshot();
  if (list.some((e) => e.receipt.payload.receiptId === entry.receipt.payload.receiptId)) return;
  if (list.some((e) => sameDocument(e, entry) && decidedAt(e) > decidedAt(entry))) return; // 더 최근 결정이 이미 있다
  write([entry, ...list.filter((e) => !sameDocument(e, entry))]);
}

export function updateStored(receiptId: string, patch: Partial<StoredReceipt>): void {
  write(snapshot().map((e) => (e.receipt.payload.receiptId === receiptId ? { ...e, ...patch } : e)));
}

export function useStoredReceipts(): StoredReceipt[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function useStoredReceipt(receiptId: string): StoredReceipt | undefined {
  return useStoredReceipts().find((e) => e.receipt.payload.receiptId === receiptId);
}

// ── 다른 브라우저로 넘기기 ─────────────────────────────────────────────────

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** iMprint 주소 뒤에 영수증을 실은 링크. 지문·기록 정보는 싣지 않는다 — 받는 쪽이 다시 계산하고 체인에서 찾는다. */
export function importLink(vaultUrl: string, entry: StoredReceipt): string {
  const body = { payload: entry.receipt.payload, txHash: entry.txHash };
  return `${vaultUrl}#import=${toBase64Url(JSON.stringify(body))}`;
}

/**
 * 주소의 #import=… 를 읽어 보관함에 넣고, 넣은 영수증 번호를 돌려준다.
 * 링크에 적힌 지문을 믿지 않고 여기서 다시 계산한다 — 누가 링크를 고쳤다면 체인 대조에서 "다름"이 나온다.
 */
export async function importFromHash(hash: string): Promise<string | null> {
  const m = /^#import=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m) return null;
  try {
    const body = JSON.parse(fromBase64Url(m[1])) as { payload: ReceiptFile["payload"]; txHash: string | null };
    const receiptId = body?.payload?.receiptId;
    if (typeof receiptId !== "string") return null;
    const txHash = typeof body.txHash === "string" && /^0x[0-9a-f]{64}$/i.test(body.txHash) ? body.txHash : null;
    addStored({
      receipt: { payload: body.payload, recordHash: await recordHash(body.payload), chainAttachment: null },
      status: "mining",
      txHash,
      error: null,
    });
    return receiptId;
  } catch {
    return null;
  }
}
