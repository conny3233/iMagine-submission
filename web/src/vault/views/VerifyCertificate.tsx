import { useState } from "react";

import { CHAINS, explorerAddressUrl, explorerTxUrl } from "../../lib/chain";
import { recordReceipt } from "../../lib/recording";
import imbankLogo from "../assets/imbank-logo.png";
import type { ReceiptWithStatus } from "../data";
import type { ChainAttachment } from "../types";
import { type ChainCheck, useOnChainReceiptId } from "../useChainCheck";
import { formatDateTime, shortHash } from "./shared";

/**
 * "블록체인 원본 검증서" (피그마 61:974 · 참고 이미지). 값은 모두 지금 체인에서 읽고 다시 계산한 결과다:
 *   문서 해시 = 화면의 영수증으로 지금 계산한 지문, 등록 해시 = 체인에 적혀 있는 지문.
 * 둘이 같으면 "원본 일치". 전문 용어는 줄이고, Etherscan 에서 마주치는 영어(Topics·Data)만 안내에 남긴다.
 */
export default function VerifyCertificate({ item, check }: { item: ReceiptWithStatus; check: ChainCheck }) {
  const { receipt, usedDocument } = item;
  const { payload } = receipt;
  const attachment = receipt.chainAttachment;
  const txUrl = attachment ? explorerTxUrl(attachment.chainId, attachment.txHash, "logs") : null;
  const matched = check.kind === "checked" && check.recordMatches && check.documentMatchesUsed;

  return (
    <section className="cert-wrap">
      <article className="cert" aria-label="블록체인 원본 검증서">
        <img className="cert-logo" src={imbankLogo} alt="" width={45} height={30} />
        <h2 className="cert-title">블록체인 원본 검증서</h2>

        <p className="cert-no">
          <span>검증서 번호</span> {certificateNo(payload.receiptId, attachment?.recordedAt ?? payload.decision.at)}
        </p>

        {check.kind === "loading" && <p className="cert-badge wait">블록체인에서 불러오는 중…</p>}
        {check.kind === "unrecorded" && <LocalRecording item={item} />}
        {check.kind === "untrusted" && (
          <Verdict ok={false} title="확인할 수 없음" line="영수증이 가리키는 장부 주소를 저희가 모릅니다. 대조하지 않았습니다." />
        )}
        {check.kind === "error" && (
          <Verdict ok={false} title="연결 실패" line={`블록체인에 연결하지 못했습니다 — ${check.message}`} />
        )}
        {check.kind === "not-found" && (
          <Verdict ok={false} title="기록 없음" line="블록체인에서 이 영수증을 찾지 못했습니다." />
        )}
        {check.kind === "checked" && (
          <Verdict
            ok={matched}
            title={matched ? "원본 일치" : "원본 불일치"}
            line={
              matched
                ? "발급 시점에 등록된 기록과 일치합니다."
                : check.recordMatches
                  ? "영수증은 같지만, 동의할 때 읽은 원문과 기록된 원문이 다릅니다."
                  : "등록된 기록과 다릅니다 — 영수증이 나중에 바뀌었을 수 있습니다."
            }
          />
        )}

        <dl className="cert-rows">
          <div>
            <dt>검증 대상</dt>
            <dd>{payload.decision.choice === "agree" ? "동의 영수증" : "동의 영수증 (동의하지 않음)"}</dd>
          </div>
          <div>
            <dt>약관 원본</dt>
            <dd>동의 당시 원문 ({usedDocument?.version ?? payload.document.version})</dd>
          </div>
          <div>
            <dt>등록 일시</dt>
            <dd>{check.kind === "checked" ? formatDateTime(check.recordedAt) : attachment ? formatDateTime(attachment.recordedAt) : "—"}</dd>
          </div>
          <div>
            <dt>네트워크</dt>
            <dd>{attachment ? `${CHAINS[attachment.chainId]?.name ?? attachment.network} Testnet` : "—"}</dd>
          </div>
        </dl>

        {check.kind === "checked" && (
          <div className={`cert-hash ${check.recordMatches ? "good" : "bad"}`}>
            <div className="cert-hash-row">
              <span>문서 해시</span>
              <code>{shortHash(check.computedRecordHash)}</code>
            </div>
            <div className="cert-eq" aria-hidden="true">
              <span>{check.recordMatches ? "=" : "≠"}</span>
            </div>
            <div className="cert-hash-row">
              <span>등록 해시</span>
              <code>{shortHash(check.onChainRecordHash)}</code>
            </div>
            <div className="cert-hash-row result">
              <span>대조 결과</span>
              <b>{check.recordMatches ? "일치" : "불일치"}</b>
            </div>
          </div>
        )}

        {attachment && (
          <dl className="cert-rows">
            <div>
              <dt>등록 주소</dt>
              <dd>
                <AddressLink attachment={attachment} />
              </dd>
            </div>
          </dl>
        )}

        {txUrl && (
          <a className="cert-btn" href={txUrl} target="_blank" rel="noreferrer">
            Etherscan에서 조회 <span aria-hidden="true">↗</span>
          </a>
        )}
      </article>

      {attachment && <EtherscanGuide attachment={attachment} receiptId={payload.receiptId} recordHash={receipt.recordHash} />}
    </section>
  );
}

function Verdict({ ok, title, line }: { ok: boolean; title: string; line: string }) {
  return (
    <>
      <p className={`cert-badge ${ok ? "good" : "bad"}`}>
        <span className="cert-badge-mark" aria-hidden="true">
          {ok ? "✓" : "!"}
        </span>
        {title}
      </p>
      <p className={`cert-line ${ok ? "good" : "bad"}`}>{line}</p>
    </>
  );
}

/** IMV-20260918-0002 — 기록 날짜(한국 시간) + 영수증 번호 끝자리. 영수증마다 하나로 정해진다. */
function certificateNo(receiptId: string, at: string): string {
  const day = new Date(at).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).replaceAll("-", "");
  const tail = receiptId.match(/_(\d+)$/)?.[1] ?? receiptId.slice(-4).toUpperCase();
  return `IMV-${day}-${tail.padStart(4, "0")}`;
}

function AddressLink({ attachment }: { attachment: ChainAttachment }) {
  const url = explorerAddressUrl(attachment.chainId, attachment.contractAddress);
  const short = `${attachment.contractAddress.slice(0, 10)}…`;
  return url ? (
    <a href={url} target="_blank" rel="noreferrer">
      {short}
    </a>
  ) : (
    <>{short}</>
  );
}

/** 이 기기에서 방금 받은 영수증 — 블록에 들어가길 기다리는 중이거나, 적지 못했다. */
function LocalRecording({ item }: { item: ReceiptWithStatus }) {
  const { local } = item;
  const receiptId = item.receipt.payload.receiptId;
  if (local.status === "failed") {
    return (
      <div className="cert-pending bad">
        <p>아직 블록체인에 적지 못했습니다. {local.error}</p>
        <button type="button" className="retry-btn" onClick={() => void recordReceipt(receiptId)}>
          다시 적기
        </button>
      </div>
    );
  }
  return (
    <div className="cert-pending" role="status">
      <p>블록체인에 적는 중입니다. 블록에 들어가면(보통 10~30초) 여기서 바로 대조합니다.</p>
      {local.txHash && (
        <a href={explorerTxUrl(11155111, local.txHash) ?? "#"} target="_blank" rel="noreferrer">
          보낸 기록 {local.txHash.slice(0, 12)}… ↗
        </a>
      )}
    </div>
  );
}

/** Etherscan 영어 화면에서 무엇을 보면 되는지 — 접어 둔다. */
function EtherscanGuide({
  attachment,
  receiptId,
  recordHash,
}: {
  attachment: ChainAttachment;
  receiptId: string;
  recordHash: string;
}) {
  const onChainId = useOnChainReceiptId(receiptId);
  return (
    <details className="cert-guide">
      <summary>Etherscan 화면에서 어디를 보면 되나요?</summary>
      <ol>
        <li>
          위 버튼을 누르면 이 영수증 <b>한 건</b>을 적어 둔 기록이 열립니다. 저희가 만든 곳이 아닌 공개 조회 사이트입니다.
        </li>
        <li>
          <b>Topics [1]</b> 줄 = 영수증 번호를 지문으로 바꾼 값 <code>{onChainId ? shortHash(onChainId) : "…"}</code>
        </li>
        <li>
          <b>Data</b> 의 첫 줄 = 영수증 지문. 아래 값과 같으면 이 영수증은 적어 둔 그때 그대로입니다.
          <HashCopy hash={recordHash} />
        </li>
        <li>
          이 영수증은 블록 <b>{attachment.blockNumber.toLocaleString("ko-KR")}</b>에 들어가 있습니다.
        </li>
      </ol>
    </details>
  );
}

function HashCopy({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);
  const bare = hash.replace(/^0x/, "");
  return (
    <span className="hash-copy">
      <code>{shortHash(hash)}</code>
      <button
        type="button"
        onClick={() => {
          // Etherscan 원본 Data 에는 0x 없이 이어 붙어 보이므로 0x 를 뺀 값을 복사한다 (Ctrl+F 로 찾기 좋게)
          navigator.clipboard
            ?.writeText(bare)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
      >
        {copied ? "복사됨" : "지문 복사"}
      </button>
    </span>
  );
}
