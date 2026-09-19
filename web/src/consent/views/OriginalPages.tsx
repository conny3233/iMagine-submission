import { type RefObject, useEffect, useRef } from "react";

import { assetUrl } from "../../lib/paths";
import type { ClauseMark, DocumentVersion } from "../../vault/types";

/**
 * hard 모드 — 원문 PDF 를 구운 페이지 이미지를 그대로 쌓는다 (이미지를 쓰는 이유는 scripts/render-pdf-pages.py).
 * "핵심조항 보는 중"이면 조항 문장이 있는 줄(scripts/locate-clauses.py 가 찾은 좌표)을 빨간 글씨로 바꾼다:
 * 빨간 칸을 screen 으로 겹치면 검은 글자만 빨개지고 흰 바탕은 그대로 남는다.
 * 글자 크기 슬라이더는 페이지 폭을 키운다 — 이미지라 글자만 따로 키울 수 없다.
 */
export default function OriginalPages(props: {
  document: DocumentVersion;
  keyOn: boolean;
  zoomStep: number;
  focusClauseId: string | null;
  onFocused: () => void;
  scrollRoot: RefObject<HTMLDivElement | null>;
}) {
  const { document, keyOn, zoomStep, focusClauseId, onFocused, scrollRoot } = props;
  const pages = document.sourcePages ?? [];
  const ref = useRef<HTMLOListElement>(null);
  const onFocusedRef = useRef(onFocused);
  useEffect(() => {
    onFocusedRef.current = onFocused;
  });
  const prevKeyOn = useRef(false);

  const marksByPage = new Map<number, (ClauseMark & { clauseId: string })[]>();
  for (const clause of document.clauses) {
    for (const m of clause.marks ?? []) {
      const list = marksByPage.get(m.page) ?? [];
      list.push({ ...m, clauseId: clause.id });
      marksByPage.set(m.page, list);
    }
  }

  // 조항으로 데려가기: 켜자마자면 첫 핵심조항, 조항을 골라 왔으면 그 조항의 첫 줄
  useEffect(() => {
    const justTurnedOn = keyOn && !prevKeyOn.current;
    prevKeyOn.current = keyOn;
    const root = scrollRoot.current;
    const list = ref.current;
    if (!root || !list) return;
    const target = focusClauseId
      ? list.querySelector<HTMLElement>(`[data-clause="${focusClauseId}"]`)
      : justTurnedOn
        ? list.querySelector<HTMLElement>(".d-mark")
        : null;
    if (!target) return;
    // 페이지 이미지는 width/height 로 자리를 먼저 잡으니 아직 안 불러와졌어도 위치가 맞다
    const offset = target.getBoundingClientRect().top - root.getBoundingClientRect().top;
    root.scrollTo({ top: root.scrollTop + offset - root.clientHeight * 0.25, behavior: "smooth" });
    if (focusClauseId) onFocusedRef.current();
    // keyOn 을 켤 때와 조항을 골라 왔을 때만 움직인다 — 확대하거나 다시 그릴 때 화면이 튀지 않게
  }, [keyOn, focusClauseId, scrollRoot]);

  if (pages.length === 0) {
    return <p className="d-empty">원문 이미지가 없어요.</p>;
  }

  return (
    <div className="d-pages-wrap">
      <ol
        ref={ref}
        className={keyOn ? "d-pages key-on" : "d-pages"}
        style={{ width: `${100 + zoomStep * 25}%` }}
        aria-label={`${document.title} 원문 ${pages.length}쪽`}
      >
        {pages.map((src, i) => {
          const marks = marksByPage.get(i + 1) ?? [];
          return (
            <li key={src} className="d-page">
              <img
                src={assetUrl(src)}
                alt={`약관 원문 ${i + 1}쪽`}
                width={1240}
                height={1753}
                loading={i < 2 ? "eager" : "lazy"}
                decoding="async"
              />
              {marks.map((m, j) => (
                <span
                  key={j}
                  className="d-mark"
                  // 같은 조항의 첫 줄만 data-clause 를 달아 "그 조항으로 데려가기"의 도착점으로 쓴다
                  data-clause={j === marks.findIndex((x) => x.clauseId === m.clauseId) ? m.clauseId : undefined}
                  style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%` }}
                />
              ))}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
