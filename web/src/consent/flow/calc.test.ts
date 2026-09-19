// 계획서 §15 점검표 "계산 검산: +1%p 는 30만 원 차이, 0%p 는 차이 0"
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { compareRates, yearlyInterestWon } from "./calc.ts";

describe("금리 비교 계산", () => {
  test("원금 3,000만 원 · 연 4.2% → 1년 이자 126만 원", () => {
    assert.equal(yearlyInterestWon(30000000, "4.2"), 1260000);
  });

  test("+1%p 면 연 5.2% 가 되고 차이는 30만 원", () => {
    assert.deepEqual(compareRates(30000000, "4.2", "1"), {
      principal: "30000000",
      rateBeforePct: "4.2",
      rateAfterPct: "5.2",
      yearlyDiffWon: "300000",
    });
  });

  test("0%p 면 금리도 차이도 그대로 0", () => {
    const r = compareRates(30000000, "4.2", "0");
    assert.equal(r.rateAfterPct, "4.2");
    assert.equal(r.yearlyDiffWon, "0");
  });

  test("+0.5%p 는 15만 원 차이 (반올림 오차 없음)", () => {
    assert.equal(compareRates(30000000, "4.2", "0.5").yearlyDiffWon, "150000");
  });
});
