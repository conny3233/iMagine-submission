import { useEffect, useRef, useState } from "react";

import { compareRates, yearlyInterestWon } from "../flow/calc";
import type { RateCalculator } from "../flow/types";
import type { ReceiptCalculation } from "../../vault/types";

/** 1,260,000 → "126만 원" (만 단위로 떨어질 때만), 아니면 "1,260,000원" */
function won(n: number): string {
  if (n !== 0 && n % 10000 === 0) return `${(n / 10000).toLocaleString("ko-KR")}만 원`;
  return `${n.toLocaleString("ko-KR")}원`;
}

/**
 * 금리 비교 계산 (계획서 §11). 원문이 설명하는 개념(변동금리)과 팀이 만든 가상 숫자를 화면에서 구분해 보여 준다.
 * 화면에 보인 값은 그대로 영수증에 남는다 — onSeen 으로 올려 보낸다. 계산은 flow/calc.ts 한 곳에서만 한다.
 */
export default function RateCalc(props: { calc: RateCalculator; onSeen?: (c: ReceiptCalculation) => void }) {
  const { calc, onSeen } = props;
  const [step, setStep] = useState(calc.defaultStep);
  const result = compareRates(calc.principalWon, calc.rateBeforePct, step);
  const before = yearlyInterestWon(calc.principalWon, calc.rateBeforePct);
  const after = yearlyInterestWon(calc.principalWon, result.rateAfterPct);

  // 실제로 화면에 나타났을 때만 영수증에 남긴다 (스크롤해서 본 적 없는 계산을 남기지 않는다)
  const box = useRef<HTMLDivElement>(null);
  const seen = useRef(onSeen);
  useEffect(() => {
    seen.current = onSeen;
  });
  useEffect(() => {
    const el = box.current;
    if (!el || !seen.current) return;
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && seen.current?.(result),
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [result.rateAfterPct, result.yearlyDiffWon]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="d-calc" ref={box}>
      <p className="d-calc-head">
        <span className="d-calc-tag">가상 예시</span>
        금리가 오르면 이자는 얼마나 늘까요?
      </p>
      <div className="d-calc-steps" role="radiogroup" aria-label="금리 상승폭">
        {calc.stepsPctPoint.map((s) => (
          <button
            type="button"
            key={s}
            role="radio"
            aria-checked={s === step}
            className={s === step ? "d-calc-step on" : "d-calc-step"}
            onClick={() => setStep(s)}
          >
            +{s}%p
          </button>
        ))}
      </div>
      <dl className="d-calc-rows">
        <div>
          <dt>빌린 돈</dt>
          <dd>{won(calc.principalWon)}</dd>
        </div>
        <div>
          <dt>지금 금리 연 {calc.rateBeforePct}%</dt>
          <dd>1년 이자 {won(before)}</dd>
        </div>
        <div>
          <dt>오른 금리 연 {result.rateAfterPct}%</dt>
          <dd>1년 이자 {won(after)}</dd>
        </div>
        <div className="d-calc-diff">
          <dt>1년에 더 내는 돈</dt>
          <dd>{Number(result.yearlyDiffWon) === 0 ? "차이 없음" : `+${won(Number(result.yearlyDiffWon))}`}</dd>
        </div>
      </dl>
      <p className="d-step-note">{calc.assumption}</p>
    </div>
  );
}
