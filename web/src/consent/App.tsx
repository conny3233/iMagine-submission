import { type CSSProperties, useState } from "react";

import "./consent.css";
import type { ExplanationMode } from "./flow/machine";
import type { ReceiptCalculation } from "../vault/types";
import { type Scenario, scenarioFromUrl, scenarios } from "./scenarios";
import { LARGE_TEXT_FROM, type ReadStyle } from "./settings";
import CheckFlow from "./views/CheckFlow";
import Home, { type LastDecision } from "./views/Home";
import Reader from "./views/Reader";

type Stage = "home" | "read" | "check";

/**
 * 앱 ① "iM Docent" — iM뱅크 서비스 안의 한 화면으로 보여준다 (2026-09-14 결정).
 * 그래서 설치(PWA)하지 않는다 — 앱 ②(iMprint, vault.html)만 홈 화면에 설치된다.
 *
 * 메인(상품 가입: ISA · 대출) → 약관 읽기(hard 원문 / easy 카드, D 김나연 피그마) → 동의 → 확인 문제 → 완료 → 메인.
 * 메인·확인 문제·완료 화면은 피그마에 없어서 같은 스타일로 맞춰 만들었다.
 * 진행 규칙은 flow/machine.ts, 영수증은 flow/receipt.ts 가 맡는다.
 */
export default function App() {
  const [scenario, setScenario] = useState<Scenario>(() => scenarioFromUrl() ?? scenarios[0]);
  const [stage, setStage] = useState<Stage>(() => (scenarioFromUrl() ? "read" : "home"));
  const [style, setStyle] = useState<ReadStyle>("detailed");
  const [textStep, setTextStep] = useState(0);
  // 상품(문서 id)별 마지막 결정
  const [last, setLast] = useState<Record<string, LastDecision>>({});
  // 읽기 화면에서 본 금리 비교 계산 (상품별) — 영수증에 남는다
  const [calc, setCalc] = useState<Record<string, ReceiptCalculation>>({});
  // 확인 화면에서 "원문에서 다시 읽기"로 돌아올 때 그 조항으로 바로 데려간다
  const [focusClauseId, setFocusClauseId] = useState<string | null>(null);

  const mode: ExplanationMode = { style, largeText: textStep >= LARGE_TEXT_FROM };

  return (
    <div className="docent" style={{ "--text-step": textStep } as CSSProperties}>
      {stage === "home" && (
        <Home
          scenarios={scenarios}
          last={last}
          onOpen={(s) => {
            if (s !== scenario) {
              setScenario(s);
              setStyle("detailed");
              setFocusClauseId(null);
            }
            setStage("read");
          }}
        />
      )}
      {stage === "read" && (
        <Reader
          key={scenario.document.id}
          scenario={scenario}
          style={style}
          onStyle={setStyle}
          textStep={textStep}
          onTextStep={setTextStep}
          focusClauseId={focusClauseId}
          onFocusDone={() => setFocusClauseId(null)}
          onCalc={(c) => setCalc((prev) => ({ ...prev, [scenario.document.id]: c }))}
          onAgree={() => setStage("check")}
          onHome={() => setStage("home")}
        />
      )}
      {stage === "check" && (
        <CheckFlow
          key={scenario.document.id}
          scenario={scenario}
          mode={mode}
          calculation={calc[scenario.document.id] ?? null}
          onCalc={(c) => setCalc((prev) => ({ ...prev, [scenario.document.id]: c }))}
          onClose={(clauseId) => {
            setStage("read");
            if (clauseId) {
              setStyle("detailed");
              setFocusClauseId(clauseId);
            }
          }}
          onFinish={(decision) => {
            if (decision) setLast((prev) => ({ ...prev, [scenario.document.id]: decision }));
            setStage("home");
          }}
        />
      )}
    </div>
  );
}
