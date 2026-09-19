// 보관함 = 이 기기에서 앱 ①로 동의·거부하고 받은 영수증 (lib/receiptStore.ts).
// 실서비스라면 이용자 계정별 저장소에서 오겠지만, 시연 범위에서는 기기 저장소로 충분하다.
// 홈 화면의 실제 상품 칸(쓰담쓰담 간편대출·일임형 ISA)은 이 기기에서 받은 그 약관의 최근 영수증을 연다.
// 아직 받은 게 없으면 촬영 전에 스크립트로 적어 둔 data/receipts 를 대신 연다 — 둘 다 Sepolia 에 실제로 기록된 영수증이고,
// 약관 하나에 칸 하나라서 "같은 영수증이 두 개"로 보이지 않는다 (2026-09-18 피그마 개편).

import { useMemo } from "react";

import { type StoredReceipt, useStoredReceipts } from "../lib/receiptStore";
import type { DocumentVersion, ReceiptFile } from "./types";

const preRecordedModules = import.meta.glob<ReceiptFile>("../../../data/receipts/*.json", {
  eager: true,
  import: "default",
});

/** 촬영 전에 스크립트로 Sepolia 에 적어 둔 영수증. 이 기기에 그 약관 영수증이 없을 때만 쓴다. */
const preRecorded: StoredReceipt[] = Object.values(preRecordedModules).map((receipt) => ({
  receipt,
  status: "recorded",
  txHash: receipt.chainAttachment?.txHash ?? null,
  error: null,
}));

const documentModules = import.meta.glob<DocumentVersion>("../../../data/documents/*/*.json", {
  eager: true,
  import: "default",
});

export const documents: DocumentVersion[] = Object.values(documentModules);

function documentKey(id: string, version: string): string {
  return `${id}@${version}`;
}

const documentByKey = new Map(documents.map((d) => [documentKey(d.id, d.version), d]));

export function findDocument(id: string, version: string): DocumentVersion | undefined {
  return documentByKey.get(documentKey(id, version));
}

/** 문서 id 별 "지금 유효한(가장 최근 발행된)" 버전. publishedAt 이 가장 늦은 것. */
export const latestDocumentByDocId: Record<string, DocumentVersion> = (() => {
  const out: Record<string, DocumentVersion> = {};
  for (const doc of documents) {
    const cur = out[doc.id];
    if (!cur || doc.publishedAt > cur.publishedAt) out[doc.id] = doc;
  }
  return out;
})();

export interface ReceiptWithStatus {
  receipt: ReceiptFile;
  usedDocument: DocumentVersion | undefined;
  latestDocument: DocumentVersion | undefined;
  /** 동의 당시 문서가 지금의 최신 버전보다 오래됐다 — "약관 개정" 알림 대상. */
  isOutdated: boolean;
  /** 기록 진행 상태 (보낸 거래 번호·실패 이유). */
  local: StoredReceipt;
}

function withStatus(receipt: ReceiptFile, local: StoredReceipt): ReceiptWithStatus {
  const usedDocument = findDocument(receipt.payload.document.id, receipt.payload.document.version);
  const latestDocument = latestDocumentByDocId[receipt.payload.document.id];
  return {
    receipt,
    usedDocument,
    latestDocument,
    isOutdated: !!latestDocument && latestDocument.version !== receipt.payload.document.version,
    local,
  };
}

/** 보관함 영수증, 최근 결정 순. 같은 약관(같은 버전)은 최근 결정 하나만 — 이 규칙 전에 쌓인 것도 가린다. */
export function useReceipts(): ReceiptWithStatus[] {
  const stored = useStoredReceipts();
  return useMemo(() => {
    const newestFirst = stored
      .map((e) => withStatus(e.receipt, e))
      .sort(
        (a, b) => new Date(b.receipt.payload.decision.at).getTime() - new Date(a.receipt.payload.decision.at).getTime(),
      );
    const seen = new Set<string>();
    return newestFirst.filter(({ receipt }) => {
      const key = `${receipt.payload.document.id}@${receipt.payload.document.version}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [stored]);
}

/** 약관(문서 id)마다 열 영수증 — 이 기기의 최근 영수증, 없으면 미리 기록한 영수증. */
export function useReceiptsByDocument(): Map<string, ReceiptWithStatus> {
  const local = useReceipts();
  return useMemo(() => {
    const out = new Map<string, ReceiptWithStatus>();
    for (const item of local) {
      const id = item.receipt.payload.document.id;
      if (!out.has(id)) out.set(id, item);
    }
    for (const entry of preRecorded) {
      const id = entry.receipt.payload.document.id;
      if (!out.has(id)) out.set(id, withStatus(entry.receipt, entry));
    }
    return out;
  }, [local]);
}

/** 영수증 번호로 찾기 — 이 기기 보관함 먼저, 없으면 미리 기록한 영수증. */
export function useReceipt(receiptId: string): ReceiptWithStatus | undefined {
  const stored = useStoredReceipts();
  return useMemo(() => {
    const entry =
      stored.find((e) => e.receipt.payload.receiptId === receiptId) ??
      preRecorded.find((e) => e.receipt.payload.receiptId === receiptId);
    return entry ? withStatus(entry.receipt, entry) : undefined;
  }, [stored, receiptId]);
}
