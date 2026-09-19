import { useState } from "react";

import { assetUrl } from "../../lib/paths";
import type { Decision } from "../flow/machine";
import type { Scenario } from "../scenarios";
import { IMPRINT_URL } from "../settings";
import { TopBar } from "./parts";

export interface LastDecision {
  choice: Decision;
  at: string;
  receiptId: string;
}

/**
 * 메인화면 — 은행 앱에서 상품 가입을 시작하는 자리. 상품마다 [필수] 서류 줄이 있고, 누르면 iM Docent 로 이어진다.
 * 피그마 「iM docent 메인화면 — 한 화면에 여러 상품」(2026-09-19 확정): 안내 카드는 위에 고정(접을 수 있음), 상품 목록만 스크롤된다.
 * 쓰담쓰담 간편대출은 약관·설명서에 더해 신청 때 함께 동의하는 서식 6종까지 7줄이다 (콘텐츠 productName 으로 묶는다).
 * 약관 화면의 ✕ 와 완료 화면의 "확인"이 여기로 돌아온다.
 * 상품 정보는 지어내지 않는다 — 이름·발행 기관만 콘텐츠/문서 데이터에서 가져온다.
 */
export default function Home(props: {
  scenarios: Scenario[];
  last: Record<string, LastDecision>;
  onOpen: (scenario: Scenario) => void;
}) {
  const { scenarios, last, onOpen } = props;

  // 상품 이름으로 묶는다 (처음 나온 순서 유지)
  const products: { name: string; issuer: string; items: Scenario[] }[] = [];
  for (const scenario of scenarios) {
    const name = scenario.content.productName ?? scenario.document.title;
    const found = products.find((p) => p.name === name);
    if (found) found.items.push(scenario);
    else products.push({ name, issuer: scenario.document.issuer, items: [scenario] });
  }

  return (
    <div className="d-screen">
      <TopBar title="상품 가입" />
      <DocentIntro />
      <div className="d-scroll">
        <section className="d-step d-home">
          {products.map((product) => {
            const decided = product.items.filter((s) => last[s.document.id]);
            const agreed = decided.filter((s) => last[s.document.id].choice === "agree").length;
            return (
              <article key={product.name} className="d-product">
                <p className="d-card-kicker">
                  <span className="d-chip">{product.issuer}</span>
                </p>
                <h2 className="d-question">{product.name}</h2>
                {product.items.map((scenario) => {
                  const { content, document } = scenario;
                  const done = last[document.id];
                  const status = !done ? "확인 전" : done.choice === "agree" ? "동의함" : "동의하지 않음";
                  return (
                    <button key={document.id} type="button" className="d-term-row" onClick={() => onOpen(scenario)}>
                      <span className="d-term-need">필수</span>
                      <span className="d-term-name">{content.shortTitle ?? document.title}</span>
                      <span className={done ? `d-term-status ${done.choice}` : "d-term-status"}>{status}</span>
                      <span className="d-term-go" aria-hidden="true">
                        ›
                      </span>
                    </button>
                  );
                })}
                {decided.length > 0 && (
                  <div className="d-app">
                    <p className="d-app-title">
                      {product.items.length > 1
                        ? `필수 서류 ${product.items.length}개 중 ${agreed}개에 동의했어요`
                        : agreed > 0
                          ? "동의 영수증을 발급했어요"
                          : "동의하지 않은 기록을 남겼어요"}
                    </p>
                    <p className="d-step-note">서류마다 무엇을 보고 결정했는지 영수증으로 남겼어요.</p>
                    <a className="d-line-btn" href={IMPRINT_URL}>
                      iM Print에서 영수증 보기
                    </a>
                  </div>
                )}
              </article>
            );
          })}

        </section>
      </div>
    </div>
  );
}

/**
 * 안내 카드 — 피그마 문구 그대로 두되, "AI 검색 — 질문에 답하고…"는 앱이 입력창 없이 준비된 질문을 고르는 방식이라
 * 실제 동작에 맞춰 "AI 요약"으로 적는다.
 */
const INTRO_POINTS: [string, string][] = [
  ["핵심 표시", "중요한 조항을 원문 위에 강조"],
  ["쉬운 설명", "어려운 문장을 쉬운 말로 풀이"],
  ["AI 요약", "자주 묻는 질문을 고르면 근거 조항으로 이동"],
  ["동의 영수증", "확인한 내용을 기록·보관"],
];

function DocentIntro() {
  const [open, setOpen] = useState(true);
  return (
    <section className={open ? "d-intro" : "d-intro closed"} aria-label="iM Docent 안내">
      <button
        type="button"
        className="d-intro-toggle"
        aria-expanded={open}
        aria-label={open ? "안내 접기" : "안내 펼치기"}
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <span className="d-intro-dash" aria-hidden="true" />
        ) : (
          <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
            <path d="M1.5 1.5 8 8l6.5-6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </button>
      <img src={assetUrl("/docent.svg")} alt="" width={44} height={44} />
      <p className="d-intro-title">iM Docent가 함께 약관을 안내합니다</p>
      {open && (
        <ul>
          {INTRO_POINTS.map(([name, line]) => (
            <li key={name}>
              {name} - {line}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
