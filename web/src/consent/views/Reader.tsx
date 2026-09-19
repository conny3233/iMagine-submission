import { useEffect, useRef, useState } from "react";

import type { QaItem } from "../flow/types";
import type { ReceiptCalculation } from "../../vault/types";
import type { Scenario } from "../scenarios";
import { type ReadStyle, TEXT_STEPS } from "../settings";
import AskSheet from "./AskSheet";
import OriginalPages from "./OriginalPages";
import RateCalc from "./RateCalc";
import { CardView, TopBar } from "./parts";
import checkButton from "../assets/check-button.svg";
import fade from "../assets/fade.png";
import search from "../assets/search.svg";
import searchActive from "../assets/search-active.svg";

/**
 * 약관 읽기 화면 (피그마 33:5 · 34:43 · 34:58 · 33:28 · 34:75).
 *   hard = 원문 페이지 그대로 + "핵심조항 확인하기"(빨간 강조) + 글자 크기
 *   easy = 조항별 쉬운 설명 카드 + 몇 번째 조항인지 · 주의 개수
 * 아래 바는 "동의 + 돋보기" → 돋보기를 누르면 "체크(동의) + 궁금한 점" 으로 바뀌고 시트가 올라온다.
 * 시트는 AI 요약과 미리 준비한 질문·답뿐이다 — 글자를 입력받지 않는다 (2026-09-17 결정).
 */
export default function Reader(props: {
  scenario: Scenario;
  style: ReadStyle;
  onStyle: (style: ReadStyle) => void;
  textStep: number;
  onTextStep: (step: number) => void;
  focusClauseId: string | null;
  onFocusDone: () => void;
  onAgree: () => void;
  onHome: () => void;
  /** 금리 비교 계산을 화면에서 본 값 — 영수증에 남긴다. */
  onCalc?: (c: ReceiptCalculation) => void;
}) {
  const { scenario, style, onStyle, textStep, onTextStep, focusClauseId, onFocusDone, onAgree, onHome, onCalc } = props;
  const { content, document } = scenario;
  const [keyOn, setKeyOn] = useState(focusClauseId !== null);
  const [asking, setAsking] = useState(false);
  const [picked, setPicked] = useState<QaItem | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const cards = content.cards;
  const cautionCount = cards.filter((c) => c.caution).length;
  const title = content.shortTitle ?? document.title;

  // easy 카드 중 지금 화면 위쪽에 걸린 카드 번호 → "6개 조항 중 N번째"
  useEffect(() => {
    const root = scrollRef.current;
    if (style !== "easy" || !root) return;
    const onScroll = () => {
      const top = root.getBoundingClientRect().top + 24;
      const els = Array.from(root.querySelectorAll<HTMLElement>(".d-card"));
      const idx = els.findIndex((el) => el.getBoundingClientRect().bottom > top);
      // 맨 끝까지 내리면 마지막 카드로 친다 (마지막 카드가 짧으면 위쪽에 걸리지 않는다)
      const atEnd = root.scrollTop + root.clientHeight >= root.scrollHeight - 4;
      setCardIndex(atEnd ? els.length - 1 : Math.max(idx, 0));
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [style]);

  // 카드의 "원문 보기" · 확인 화면에서 넘어온 조항 → hard 로 바꾸고 그 조항 줄까지 내려 준다
  const [pendingFocus, setPendingFocus] = useState<string | null>(focusClauseId);
  useEffect(() => {
    if (focusClauseId) onFocusDone();
  }, [focusClauseId, onFocusDone]);
  const openOriginal = (clauseId: string) => {
    onStyle("detailed");
    setKeyOn(true);
    setPendingFocus(clauseId);
  };

  const closeAsk = () => {
    setAsking(false);
    setPicked(null);
  };

  return (
    <div className={style === "easy" ? "d-screen easy" : "d-screen"}>
      <TopBar
        title={title}
        style={style}
        onStyle={(s) => {
          onStyle(s);
          scrollRef.current?.scrollTo({ top: 0 });
        }}
        onClose={onHome}
        closeLabel="가입 화면으로"
      />

      {style === "detailed" ? (
        <div className="d-tools">
          <button
            type="button"
            className={keyOn ? "d-key on" : "d-key"}
            aria-pressed={keyOn}
            onClick={() => setKeyOn(!keyOn)}
          >
            {keyOn ? "핵심조항 보는 중" : "핵심조항 확인하기"}
          </button>
          <label className="d-size">
            <span className="d-size-small" aria-hidden="true">
              가
            </span>
            <input
              type="range"
              min={0}
              max={TEXT_STEPS - 1}
              step={1}
              value={textStep}
              aria-label="글자 크기"
              onChange={(e) => onTextStep(Number(e.target.value))}
            />
            <span className="d-size-large" aria-hidden="true">
              가
            </span>
          </label>
        </div>
      ) : (
        <div className="d-progress">
          <div className="d-progress-text">
            <span>
              {cards.length}개 조항 중 {Math.min(cardIndex + 1, cards.length)}번째
            </span>
            {cautionCount > 0 && <span className="d-progress-warn">주의 {cautionCount}개</span>}
          </div>
          <div className="d-bar" aria-hidden="true">
            <div className="d-bar-fill" style={{ width: `${((cardIndex + 1) / Math.max(cards.length, 1)) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="d-scroll" ref={scrollRef}>
        {style === "detailed" ? (
          <OriginalPages
            document={document}
            keyOn={keyOn}
            zoomStep={textStep}
            focusClauseId={pendingFocus}
            onFocused={() => setPendingFocus(null)}
            scrollRoot={scrollRef}
          />
        ) : (
          <div className="d-cards">
            {cards.map((card) => (
              <CardView key={card.clauseId} card={card} onOriginal={() => openOriginal(card.clauseId)}>
                {content.calculator?.clauseId === card.clauseId && (
                  <RateCalc calc={content.calculator} onSeen={onCalc} />
                )}
              </CardView>
            ))}
            <p className="d-cards-note">
              AI가 원문을 쉬운 말로 옮긴 설명이에요. 계약 내용은 원문이 기준이에요.
            </p>
          </div>
        )}
      </div>

      <div className="d-bottom">
        <img className="d-fade" src={fade} alt="" width={393} height={29} />
        {asking ? (
          <div className="d-bottom-row">
            <button type="button" className="d-check" aria-label="동의" onClick={onAgree}>
              <img src={checkButton} alt="" width={51} height={51} />
            </button>
            <button type="button" className="d-ask" aria-label="궁금한 점 닫기" onClick={closeAsk}>
              <span className="d-ask-label">{picked?.question ?? "궁금한 점을 골라 보세요"}</span>
              <img src={searchActive} alt="" width={23} height={23} />
            </button>
          </div>
        ) : (
          <div className="d-bottom-row">
            <button type="button" className="d-agree" onClick={onAgree}>
              동의
            </button>
            <button type="button" className="d-search" aria-label="궁금한 점 보기" onClick={() => setAsking(true)}>
              <img src={search} alt="" width={22} height={22} />
            </button>
          </div>
        )}
      </div>

      {asking && (
        <AskSheet
          content={content}
          picked={picked}
          onPick={setPicked}
          onOriginal={(clauseId) => {
            closeAsk();
            openOriginal(clauseId);
          }}
          onClose={closeAsk}
        />
      )}
    </div>
  );
}
