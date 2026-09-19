import { useEffect, useState } from "react";

import { explorerTxUrl } from "../../lib/chain";
import { addStored, importLink, type StoredReceipt, useStoredReceipt } from "../../lib/receiptStore";
import { recordReceipt } from "../../lib/recording";
import type { DocumentVersion, ReceiptCalculation, ReceiptFile } from "../../vault/types";
import type { FlowState } from "../flow/machine";
import { buildReceipt } from "../flow/receipt";
import type { ScenarioContent } from "../flow/types";
import { IMPRINT_URL } from "../settings";
import type { LastDecision } from "./Home";
import checkButton from "../assets/check-button.svg";

function newReceiptId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return "rcpt_app_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 완료 화면 — 피그마 메모 "동의 서류 보관 완료를 확인시켜주는 화면 → 필요시 어플 다운 유도" 를 같은 스타일로 만든 것.
 * 동의든 거부든 영수증을 만들어 이 기기의 보관함(iMprint 와 같이 쓰는 곳)에 넣고, 바로 블록체인에 적는다.
 * 서명은 기록 서버(web/api/record.js)가 한다 — 화면에는 키가 없다. "적었어요"는 체인에서 블록을 확인한 뒤에만 쓴다.
 */
export default function Complete(props: {
  content: ScenarioContent;
  document: DocumentVersion;
  state: FlowState;
  /** 읽기 화면에서 본 금리 비교 계산 — 없으면 영수증에도 없다. */
  calculation?: ReceiptCalculation | null;
  onDone: (last: LastDecision | null) => void;
}) {
  const { content, document, state, calculation, onDone } = props;
  const [receiptId] = useState(newReceiptId);
  const [receipt, setReceipt] = useState<ReceiptFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    buildReceipt(content, state, { receiptId, document, calculation }).then(
      (r) => {
        if (!alive) return;
        setReceipt(r);
        addStored({ receipt: r, status: "sending", txHash: null, error: null });
        void recordReceipt(r.payload.receiptId);
      },
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [content, document, state, receiptId, calculation]);

  if (error) return <p className="d-reject">영수증을 만들지 못했어요: {error}</p>;
  if (!receipt) return <p className="d-step-text d-pad">영수증을 만드는 중…</p>;

  const { payload } = receipt;
  const agreed = payload.decision.choice === "agree";
  const answered = state.answers;
  const correct = answered.filter((a) => a.correct).length;

  return (
    <>
      <div className="d-scroll">
        <section className="d-step d-done">
          <img className="d-done-mark" src={checkButton} alt="" width={64} height={64} />
          <h2 className="d-question">{agreed ? "동의를 마쳤어요" : "동의하지 않음으로 마쳤어요"}</h2>
          <p className="d-step-text">
            무엇을 보고 어떻게 확인했는지 담은 <strong>동의 영수증</strong>을 발급했어요.
          </p>

          <div className="d-receipt">
            <dl>
              <div>
                <dt>약관</dt>
                <dd>
                  {document.title} ({document.version})
                </dd>
              </div>
              <div>
                <dt>결정</dt>
                <dd>
                  {agreed ? "동의" : "동의하지 않음"} · {new Date(payload.decision.at).toLocaleString("ko-KR")}
                </dd>
              </div>
              <div>
                <dt>읽은 방식</dt>
                <dd>
                  {payload.explanationMode.style === "easy" ? "쉬운 설명" : "원문"}
                  {payload.explanationMode.largeText && " · 큰 글씨"}
                </dd>
              </div>
              {answered.length > 0 && (
                <div>
                  <dt>확인 문제</dt>
                  <dd>
                    {answered.length}번 풀어 {correct}번 맞힘
                  </dd>
                </div>
              )}
              {payload.calculation && (
                <div>
                  <dt>금리 비교(가상)</dt>
                  <dd>
                    연 {payload.calculation.rateBeforePct}% → {payload.calculation.rateAfterPct}% · 1년에{" "}
                    {Number(payload.calculation.yearlyDiffWon).toLocaleString("ko-KR")}원
                  </dd>
                </div>
              )}
              <div>
                <dt>영수증 번호</dt>
                <dd className="d-mono">{payload.receiptId}</dd>
              </div>
              <div>
                <dt>지문</dt>
                <dd className="d-mono">{receipt.recordHash.slice(0, 18)}…</dd>
              </div>
            </dl>
            <ChainStatus receiptId={payload.receiptId} />
          </div>

          <ImprintLink receiptId={payload.receiptId} />
        </section>
      </div>
      <div className="d-bottom">
        <div className="d-bottom-row">
          <button
            type="button"
            className="d-agree"
            onClick={() => onDone({ ...payload.decision, receiptId: payload.receiptId })}
          >
            확인
          </button>
        </div>
      </div>
    </>
  );
}

/** 블록체인 기록 진행 — 보관함의 상태를 그대로 보여 준다. */
function ChainStatus({ receiptId }: { receiptId: string }) {
  const entry = useStoredReceipt(receiptId);
  const attachment = entry?.receipt.chainAttachment;

  if (attachment) {
    const url = explorerTxUrl(attachment.chainId, attachment.txHash);
    return (
      <p className="d-chain-status done" role="status">
        ✓ 블록체인에 적었어요 · 블록 {attachment.blockNumber.toLocaleString("ko-KR")}
        {url && (
          <>
            {" "}
            <a href={url} target="_blank" rel="noreferrer">
              공개 장부에서 보기 ↗
            </a>
          </>
        )}
      </p>
    );
  }
  if (!entry || entry.status === "sending" || entry.status === "mining") {
    return (
      <p className="d-chain-status" role="status">
        <span className="d-spinner" aria-hidden="true" /> 블록체인에 적는 중이에요. 보통 10~30초 걸려요.
      </p>
    );
  }
  return (
    <div className="d-chain-status failed" role="status">
      <p>블록체인에 아직 적지 못했어요. {entry.error}</p>
      <p>영수증은 iM Print에 보관돼 있어요.</p>
      <button type="button" className="d-line-btn" onClick={() => void recordReceipt(receiptId)}>
        다시 적기
      </button>
    </div>
  );
}

/** 같은 브라우저면 보관함을 같이 쓰고, 다른 브라우저로 열어도 영수증이 따라가게 링크에 싣는다. */
function ImprintLink({ receiptId }: { receiptId: string }) {
  const entry: StoredReceipt | undefined = useStoredReceipt(receiptId);
  const href = entry ? importLink(IMPRINT_URL, entry) : IMPRINT_URL;
  return (
    <div className="d-app">
      <p className="d-app-title">이 영수증은 iM Print에 담겼어요</p>
      <p className="d-step-note">동의한 약관 원문과 함께 보관하고, 블록체인 기록과 대조해 볼 수 있어요.</p>
      <a className="d-line-btn" href={href}>
        iM Print에서 보기
      </a>
    </div>
  );
}
