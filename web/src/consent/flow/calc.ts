// 금리 비교 계산 — 0918-team-plan.md §11 의 "단순 연이자 비교" 한 종류뿐이다.
//   단순 연이자 = 원금 × 연이율,  차이 = 오른 금리의 이자 − 지금 금리의 이자
// 상환에 따른 원금 감소·실제 금리 변경일·일수 계산·수수료·세금은 넣지 않는다 (계획서 §11).
// 화면에 보여 준 값과 영수증에 남는 값이 같아야 해서, 계산은 이 함수 한 곳에서만 한다.

import type { ReceiptCalculation } from "../../vault/types";

/** 퍼센트 문자열("4.2")을 1/100 %p 단위 정수로 — 소수 곱셈의 오차를 피한다. */
function toBasisPoints(pct: string): number {
  const [whole, frac = ""] = pct.trim().split(".");
  const padded = (frac + "00").slice(0, 2);
  return Number(whole) * 100 + Number(padded);
}

export function yearlyInterestWon(principalWon: number, pct: string): number {
  return Math.round((principalWon * toBasisPoints(pct)) / 10000);
}

/** 지금 금리와 오른 금리(+Np)를 비교한다. 결과는 영수증에 그대로 들어가는 문자열 값이다. */
export function compareRates(principalWon: number, rateBeforePct: string, plusPctPoint: string): ReceiptCalculation {
  const after = ((toBasisPoints(rateBeforePct) + toBasisPoints(plusPctPoint)) / 100).toFixed(2).replace(/\.?0+$/, "");
  return {
    principal: String(principalWon),
    rateBeforePct: rateBeforePct,
    rateAfterPct: after,
    yearlyDiffWon: String(yearlyInterestWon(principalWon, after) - yearlyInterestWon(principalWon, rateBeforePct)),
  };
}
