import { type ReceiptWithStatus, useReceipt } from "../data";
import { useChainCheck } from "../useChainCheck";
import { OriginalPdf, OriginalText } from "./OriginalDocument";
import PaperReceipt from "./PaperReceipt";
import { diffClauses } from "./shared";
import VerifyCertificate from "./VerifyCertificate";

export type DetailTab = "receipt" | "verify" | "text" | "pdf";

// 피그마 메모: "버튼 총 4개" · "블록체인 버튼만 클릭할 때 빨간색, 나머지는 클릭하면 초록색"
const TABS: { id: DetailTab; label: string }[] = [
  { id: "receipt", label: "동의 영수증" },
  { id: "verify", label: "블록체인 원본 검증" },
  { id: "text", label: "동의한 약관 원문" },
  { id: "pdf", label: "약관 PDF 원본" },
];

export default function ReceiptDetail(props: {
  receiptId: string;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
  onHome: () => void;
}) {
  const item = useReceipt(props.receiptId);
  if (!item) {
    return (
      <main className="im-detail">
        <p className="stamp bad">영수증을 찾을 수 없습니다.</p>
        <button type="button" className="retry-btn" onClick={props.onHome}>
          홈으로
        </button>
      </main>
    );
  }
  return <DetailBody item={item} tab={props.tab} onTab={props.onTab} />;
}

function DetailBody({ item, tab, onTab }: { item: ReceiptWithStatus; tab: DetailTab; onTab: (t: DetailTab) => void }) {
  // 체인 대조는 탭을 바꿔도 한 번만 — 영수증 도장과 검증서가 같은 결과를 보인다.
  const check = useChainCheck(item);
  const { usedDocument, latestDocument, isOutdated } = item;
  const changedClauses = isOutdated ? diffClauses(usedDocument, latestDocument) : [];

  return (
    <main className="im-detail">
      <nav className="im-tabs" role="tablist" aria-label="영수증 보기">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`im-tab${tab === t.id ? (t.id === "verify" ? " on red" : " on") : ""}`}
            onClick={() => {
              onTab(t.id);
              window.scrollTo({ top: 0 });
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="im-panel" role="tabpanel">
        {tab === "receipt" && (
          <>
            {isOutdated && latestDocument && (
              <div className="renewal-detail">
                <p className="stamp bad">
                  ⚠ 동의하신 건 <b>{usedDocument?.version}</b>입니다. 지금 약관은 <b>{latestDocument.version}</b>입니다.
                </p>
                {latestDocument.changeSummary && <p>{latestDocument.changeSummary}</p>}
                {changedClauses.map((c) => (
                  <div key={c.id} className="clause-diff">
                    <div className="clause-diff-title">{c.title}</div>
                    <div className="clause-diff-before">이전: {c.before ?? "(없음)"}</div>
                    <div className="clause-diff-after">지금: {c.after ?? "(삭제됨)"}</div>
                  </div>
                ))}
              </div>
            )}
            <PaperReceipt item={item} check={check} />
          </>
        )}
        {tab === "verify" && <VerifyCertificate item={item} check={check} />}
        {tab === "text" && <OriginalText item={item} />}
        {tab === "pdf" && <OriginalPdf item={item} />}
      </div>
    </main>
  );
}
