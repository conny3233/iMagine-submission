import { useEffect, useState } from "react";

import { documentHash as computeDocumentHash, recordHash as computeRecordHash } from "../lib/canonical";
import { readReceipt, toBytes32, trustedRegistry } from "../lib/chain";
import type { ReceiptWithStatus } from "./data";

export type ChainCheck =
  | { kind: "loading" }
  | { kind: "unrecorded" } // chainAttachment 가 아직 없음 — 촬영 전 기록 대기
  | { kind: "untrusted"; chainId: number; address: string } // 배포 목록에 없는 계약 주소
  | { kind: "error"; message: string } // RPC 조회 자체가 실패
  | { kind: "not-found" } // 체인에 그 receiptId 가 없음
  | {
      kind: "checked";
      /** 화면의 payload 로 지금 다시 계산한 지문. 파일에 적힌 recordHash 를 믿지 않는다. */
      computedRecordHash: string;
      onChainRecordHash: string;
      recordMatches: boolean;
      documentMatchesUsed: boolean; // 온체인 documentHash == 동의 당시 문서 해시
      documentMatchesLatest: boolean; // 온체인 documentHash == 지금 최신 문서 해시
      recordedAt: Date;
      issuer: string;
    };

/**
 * 영수증 한 건을 체인과 대조한다. 상세 화면에서 한 번만 부르고 결과를 종이 영수증(도장)과
 * 증거 패널에 같이 넘긴다 — 둘이 따로 부르면 RPC 를 두 번 치고, 잠깐이지만 서로 다른 상태를 보인다.
 */
export function useChainCheck(item: ReceiptWithStatus): ChainCheck {
  const [status, setStatus] = useState<ChainCheck>({ kind: "loading" });
  const { receipt, usedDocument, latestDocument } = item;
  const attachment = receipt.chainAttachment;

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!attachment) {
        setStatus({ kind: "unrecorded" });
        return;
      }
      const trusted = trustedRegistry(attachment.chainId, attachment.contractAddress);
      if (!trusted) {
        setStatus({ kind: "untrusted", chainId: attachment.chainId, address: attachment.contractAddress });
        return;
      }
      try {
        const onChain = await readReceipt(attachment.chainId, attachment.contractAddress, receipt.payload.receiptId);
        if (cancelled) return;
        if (!onChain) {
          setStatus({ kind: "not-found" });
          return;
        }
        const computedRecordHash = await computeRecordHash(receipt.payload);
        const usedHash = usedDocument ? await computeDocumentHash(usedDocument.content) : null;
        const latestHash = latestDocument ? await computeDocumentHash(latestDocument.content) : null;
        if (cancelled) return;
        setStatus({
          kind: "checked",
          computedRecordHash,
          onChainRecordHash: onChain.recordHash,
          recordMatches: onChain.recordHash.toLowerCase() === computedRecordHash.toLowerCase(),
          documentMatchesUsed: usedHash !== null && onChain.documentHash.toLowerCase() === usedHash.toLowerCase(),
          documentMatchesLatest:
            latestHash !== null && onChain.documentHash.toLowerCase() === latestHash.toLowerCase(),
          recordedAt: onChain.recordedAt,
          issuer: onChain.issuer,
        });
      } catch (e) {
        if (!cancelled) {
          setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [attachment, receipt, usedDocument, latestDocument]);

  return status;
}

/** 컨트랙트 안의 영수증 번호(bytes32). Etherscan Logs 탭의 Topics[1] 에 이 값이 보인다. */
export function useOnChainReceiptId(receiptId: string): string | null {
  const [value, setValue] = useState<{ receiptId: string; id: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void toBytes32(receiptId).then((id) => {
      if (!cancelled) setValue({ receiptId, id });
    });
    return () => {
      cancelled = true;
    };
  }, [receiptId]);
  return value && value.receiptId === receiptId ? value.id : null;
}
