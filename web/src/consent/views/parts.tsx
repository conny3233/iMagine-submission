// 여러 화면이 같이 쓰는 조각 — 피그마(34:43 · 33:28 · 34:75)의 상단 바, 설명 카드, 아래에서 올라오는 시트.

import type { ReactNode } from "react";

import type { ClauseCard } from "../flow/types";
import type { ReadStyle } from "../settings";

export function TopBar(props: {
  title: string;
  style?: ReadStyle;
  onStyle?: (style: ReadStyle) => void;
  /** 없으면 닫기 버튼을 그리지 않는다 (메인화면). */
  onClose?: () => void;
  closeLabel?: string;
}) {
  const { title, style, onStyle, onClose, closeLabel } = props;
  const easy = style === "easy";
  return (
    <header className="d-top">
      <h1 className="d-top-title">{title}</h1>
      {style && onStyle && (
        <button
          type="button"
          className={easy ? "d-level easy" : "d-level"}
          role="switch"
          aria-checked={easy}
          aria-label={easy ? "쉬운 설명 보는 중 — 누르면 원문" : "원문 보는 중 — 누르면 쉬운 설명"}
          onClick={() => onStyle(easy ? "detailed" : "easy")}
        >
          <span className="d-level-knob">{easy ? "easy" : "hard"}</span>
        </button>
      )}
      {onClose && (
        <button type="button" className="d-close" aria-label={closeLabel} onClick={onClose}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </header>
  );
}

export function WarnIcon() {
  return (
    <svg className="d-warn-icon" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d="M10 3.2 17.4 16H2.6L10 3.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 8.2v3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="13.9" r="0.95" fill="currentColor" />
    </svg>
  );
}

/** easy 모드의 조항 카드. 헤드라인의 \n 은 줄바꿈으로 보여준다. */
export function CardView(props: { card: ClauseCard; onOriginal?: () => void; children?: ReactNode }) {
  const { card, onOriginal, children } = props;
  return (
    <article className="d-card" data-clause={card.clauseId}>
      <p className="d-card-kicker">
        <span className="d-chip">{card.article}</span>
        <span>{card.label}</span>
      </p>
      <h2 className="d-card-headline">{card.headline}</h2>
      <ul className="d-card-points">
        {card.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {card.caution && (
        <p className="d-caution">
          <WarnIcon />
          <span>{card.caution}</span>
        </p>
      )}
      {children}
      {onOriginal && (
        <button type="button" className="d-more" onClick={onOriginal}>
          원문 보기 <span aria-hidden="true">›</span>
        </button>
      )}
    </article>
  );
}

/** 아래에서 올라오는 시트 (피그마 34:75). 위쪽은 흐리게 덮고, 누르면 닫힌다. */
export function Sheet(props: { label: string; onClose: () => void; children: ReactNode }) {
  const { label, onClose, children } = props;
  return (
    <div className="d-sheet-layer">
      <button type="button" className="d-sheet-dim" aria-label={`${label} 닫기`} onClick={onClose} />
      <section className="d-sheet" role="dialog" aria-label={label}>
        <button type="button" className="d-sheet-grab" aria-label={`${label} 닫기`} onClick={onClose} />
        <div className="d-sheet-body">{children}</div>
      </section>
    </div>
  );
}
