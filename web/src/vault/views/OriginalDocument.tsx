import { assetUrl } from "../../lib/paths";
import type { ReceiptWithStatus } from "../data";

/**
 * 상세 화면의 "동의한 약관 원문" 탭 — 동의할 때 확인한 조항의 본문 그대로. 폰에서 실제로 읽을 수 있는 쪽이다.
 * 조항 문장은 영수증에 봉인된 문서 지문(documentHash)의 원본이다.
 */
export function OriginalText({ item }: { item: ReceiptWithStatus }) {
  const { receipt, usedDocument } = item;
  if (!usedDocument) return <p className="im-empty">원문을 찾을 수 없습니다.</p>;

  const shown = new Set(receipt.payload.conceptsShown);
  const clauses = usedDocument.clauses.filter((c) => shown.has(c.id));

  return (
    <section className="original">
      <h3>{usedDocument.title}</h3>
      <p className="original-meta">
        {usedDocument.issuer} · {usedDocument.version} · {usedDocument.publishedAt}
      </p>
      <ol className="original-clauses">
        {clauses.map((c) => (
          <li key={c.id}>
            <h4>{c.title}</h4>
            <p>{c.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * "약관 PDF 원본" 탭 — 원문 PDF 를 구운 페이지 이미지. "진짜 그 문서가 맞다"를 눈으로 보여주는 쪽.
 * 이미지를 쓰는 이유는 scripts/render-pdf-pages.py 주석에 적어 뒀다 (iOS Safari 의 PDF iframe).
 */
export function OriginalPdf({ item }: { item: ReceiptWithStatus }) {
  const { usedDocument } = item;
  if (!usedDocument) return <p className="im-empty">원문을 찾을 수 없습니다.</p>;

  const pages = (usedDocument.sourcePages ?? []).map(assetUrl);
  const pdfUrl = usedDocument.sourceUrl ? assetUrl(usedDocument.sourceUrl) : null;

  return (
    <section className="original">
      <p className="original-meta">
        {usedDocument.title} · 전체 {pages.length}쪽 · 쪽을 누르면 크게 열립니다
      </p>
      <ol className="original-pages">
        {pages.map((src, i) => (
          <li key={src}>
            <a href={src} target="_blank" rel="noreferrer">
              <img
                src={src}
                alt={`원문 ${i + 1}쪽`}
                width={1240}
                height={1753}
                loading={i < 2 ? "eager" : "lazy"}
                decoding="async"
              />
              <span className="original-page-no">
                {i + 1} / {pages.length}
              </span>
            </a>
          </li>
        ))}
      </ol>
      {pdfUrl && (
        <a className="cert-btn" href={pdfUrl} target="_blank" rel="noreferrer">
          PDF 원본 전체 열기 <span aria-hidden="true">↗</span>
        </a>
      )}
    </section>
  );
}
