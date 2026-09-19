import { type ReactNode, useReducer, useState } from "react";

import {
  currentQuestion,
  type Decision,
  type ExplanationMode,
  type FlowEvent,
  type FlowState,
  initialState,
  transition,
  wrongCount,
} from "../flow/machine";
import type { Concept, Question, ScenarioContent } from "../flow/types";
import type { ReceiptCalculation } from "../../vault/types";
import type { Scenario } from "../scenarios";
import Complete from "./Complete";
import type { LastDecision } from "./Home";
import { CardView, Sheet, TopBar, WarnIcon } from "./parts";
import RateCalc from "./RateCalc";
import Shorts from "./Shorts";
import checkButton from "../assets/check-button.svg";

const now = () => new Date().toISOString();

// 이 화면에서는 설명을 따로 띄우지 않는다 — 설명은 앞의 읽기 화면(hard/easy)이 이미 했다.
// 그래서 엔진이 설명 단계에 들어서면 바로 문항으로 넘긴다 (엔진의 shown 기록은 그대로 남는다).
function step(content: ScenarioContent, state: FlowState, event: FlowEvent): FlowState {
  const next = transition(content, state, event);
  return next.phase.kind === "explain" ? transition(content, next, { type: "READY" }) : next;
}

interface Feedback {
  concept: Concept;
  question: Question;
  choiceId: string;
  attempt: 1 | 2;
}

/**
 * 동의 버튼 뒤의 확인 화면 — 피그마에 없어서 읽기 화면과 같은 부품(상단 바 · 카드 · 아래 바)으로 만들었다.
 *   문제 → (정답) 근거 보여주고 다음 → … → 최종 선택(틀린 개수) → 완료
 *   문제 → (오답) 그 조항 다시 설명(쇼츠 영상이 있으면 재생) → 다른 문제 → 맞든 틀리든 근거 보여주고 다음
 * 틀려도 끝까지 풀고, 동의 여부는 이용자가 고른다. 거부는 어느 단계에서든 가능하다. 규칙은 flow/machine.ts.
 */
export default function CheckFlow(props: {
  scenario: Scenario;
  mode: ExplanationMode;
  /** 결정 없이 약관으로 돌아간다. clauseId 가 있으면 그 조항 원문으로. */
  onClose: (clauseId?: string) => void;
  /** 완료 화면을 닫았다 → 메인화면. */
  onFinish: (last: LastDecision | null) => void;
  /** 읽기 화면에서 본 금리 비교 계산 (영수증에 남긴다). */
  calculation?: ReceiptCalculation | null;
  onCalc?: (c: ReceiptCalculation) => void;
}) {
  const { scenario, mode, onClose, onFinish, calculation, onCalc } = props;
  const { content, document } = scenario;
  const [state, dispatch] = useReducer(
    (s: FlowState, e: FlowEvent) => step(content, s, e),
    content,
    (c) => step(c, initialState(c, mode), { type: "SET_MODE" }),
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [originalOf, setOriginalOf] = useState<string | null>(null);

  const { phase } = state;
  const total = content.concepts.length;
  const conceptIndex = "conceptIndex" in phase ? phase.conceptIndex : total;
  const concept: Concept | undefined = content.concepts[conceptIndex];
  const question = currentQuestion(content, state);
  const cardOf = (clauseId: string) => content.cards.find((c) => c.clauseId === clauseId);
  const clauseOf = (clauseId: string) => document.clauses.find((c) => c.id === clauseId);

  const title = content.shortTitle ?? document.title;
  const decline = () => {
    if (window.confirm("동의하지 않음으로 기록할까요?")) dispatch({ type: "DECIDE", choice: "decline", at: now() });
  };
  const quit = () => {
    if (window.confirm("확인을 그만두고 약관으로 돌아갈까요? 아무것도 기록하지 않아요.")) onClose();
  };

  if (phase.kind === "done") {
    return (
      <div className="d-screen">
        <TopBar title={title} />
        <Complete
          content={content}
          document={document}
          state={state}
          calculation={calculation}
          onDone={onFinish}
        />
      </div>
    );
  }

  const wrong = wrongCount(state);
  const decide = (choice: Decision) => dispatch({ type: "DECIDE", choice, at: now() });
  const answer = () => {
    if (!question || !picked || !concept) return;
    setFeedback({ concept, question, choiceId: picked, attempt: phase.kind === "question" ? phase.attempt : 1 });
    dispatch({ type: "ANSWER", questionId: question.id, choiceId: picked });
    setPicked(null);
  };

  // ── 화면마다 본문 · 아래 바 ──
  let body: ReactNode;
  let bottom: ReactNode;
  // 방금 푼 문제의 결과. 정답이거나 재확인 문항이면 여기서 근거를 보여 주고 다음으로 간다.
  // 최초 문항 오답은 엔진의 remedial 화면이 이어받는다.
  const lastCorrect = feedback !== null && feedback.choiceId === feedback.question.answerId;
  const showResult = feedback !== null && (lastCorrect || feedback.attempt === 2);

  if (showResult) {
    const card = cardOf(feedback.concept.clauseId);
    const where = card ? `${card.article} ${card.label}` : feedback.concept.title;
    const answerChoice = feedback.question.choices.find((c) => c.id === feedback.question.answerId);
    body = (
      <section className="d-step">
        {lastCorrect ? (
          <div className="d-result good">
            <img src={checkButton} alt="" width={40} height={40} />
            <div>
              <p className="d-result-title">정답이에요</p>
              <p className="d-result-sub">{where}</p>
            </div>
          </div>
        ) : (
          <div className="d-result bad">
            <WarnIcon />
            <div>
              <p className="d-result-title">정답은 {answerChoice?.id}예요</p>
              <p className="d-result-sub">{where} · 아래 근거를 한 번 더 읽어 보세요</p>
            </div>
          </div>
        )}
        <div className="d-card">
          <p className="d-card-kicker">
            <span className="d-chip">근거</span>
            <span>{clauseOf(feedback.concept.clauseId)?.title}</span>
          </p>
          <p className="d-rationale">{feedback.question.rationale}</p>
          <button type="button" className="d-more" onClick={() => setOriginalOf(feedback.concept.clauseId)}>
            원문 보기 <span aria-hidden="true">›</span>
          </button>
        </div>
      </section>
    );
    bottom = (
      <button type="button" className="d-agree" onClick={() => setFeedback(null)}>
        {phase.kind === "decide" ? "확인 마치기" : "다음 문제"}
      </button>
    );
  } else if (phase.kind === "question" && question && concept) {
    const card = cardOf(concept.clauseId);
    body = (
      <section className="d-step">
        <p className="d-card-kicker">
          {card && <span className="d-chip">{card.article}</span>}
          <span>{card?.label ?? concept.title}</span>
          {phase.attempt === 2 && <span className="d-retry-tag">다시 확인</span>}
          {question.madeBy === "ai" && <span className="d-ai-tag">AI가 만든 문제</span>}
        </p>
        <h2 className="d-question">{question.prompt}</h2>
        <ul className="d-choices" role="radiogroup" aria-label="보기">
          {question.choices.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="radio"
                aria-checked={picked === c.id}
                className={picked === c.id ? "d-choice on" : "d-choice"}
                onClick={() => setPicked(c.id)}
              >
                <span className="d-choice-id">{c.id}</span>
                <span>{c.text}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="d-decline" onClick={decline}>
          동의하지 않고 끝내기
        </button>
      </section>
    );
    bottom = (
      <button type="button" className="d-agree" disabled={!picked} onClick={answer}>
        정답 확인
      </button>
    );
  } else if (phase.kind === "remedial" && concept) {
    const card = cardOf(concept.clauseId);
    const remedial = concept.explanations?.remedial;
    body = (
      <section className="d-step">
        <div className="d-result bad">
          <WarnIcon />
          <div>
            <p className="d-result-title">이 부분을 다시 볼게요</p>
            <p className="d-result-sub">틀려도 괜찮아요. 다른 문제로 한 번 더 확인해요.</p>
          </div>
        </div>
        {concept.remedialVideo && <Shorts key={concept.id} src={concept.remedialVideo} />}
        {card ? (
          <CardView card={card} onOriginal={() => setOriginalOf(concept.clauseId)}>
            {remedial && <p className="d-remedial">{remedial}</p>}
            {content.calculator?.clauseId === card.clauseId && (
              <RateCalc calc={content.calculator} onSeen={onCalc} />
            )}
          </CardView>
        ) : (
          remedial && <p className="d-remedial">{remedial}</p>
        )}
        <button type="button" className="d-decline" onClick={decline}>
          동의하지 않고 끝내기
        </button>
      </section>
    );
    bottom = (
      <button
        type="button"
        className="d-agree"
        onClick={() => {
          setFeedback(null);
          dispatch({ type: "RETRY" });
        }}
      >
        다른 문제로 다시 확인
      </button>
    );
  } else if (phase.kind === "decide") {
    body = (
      <section className="d-step">
        <h2 className="d-question">
          {total > 0 ? "확인을 모두 마쳤어요" : `${title}에`}
          <br />
          동의하시겠어요?
        </h2>
        {state.answers.length > 0 && (
          <div className={wrong > 0 ? "d-result bad" : "d-result good"}>
            {wrong > 0 ? <WarnIcon /> : <img src={checkButton} alt="" width={40} height={40} />}
            <div>
              <p className="d-result-title">
                {wrong > 0 ? `${state.answers.length}문제 중 ${wrong}문제를 틀렸어요` : `${state.answers.length}문제 모두 맞혔어요`}
              </p>
              {wrong > 0 && <p className="d-result-sub">헷갈린 부분은 약관을 다시 읽고 정해도 돼요.</p>}
            </div>
          </div>
        )}
        <ul className="d-summary">
          {content.cards.map((card) => (
            <li key={card.clauseId}>
              <span className="d-chip">{card.article}</span>
              <span>{card.headline.replace(/\n/g, " ")}</span>
            </li>
          ))}
        </ul>
        {wrong > 0 && (
          <button type="button" className="d-line-btn d-reread" onClick={() => onClose()}>
            약관 다시 읽기
          </button>
        )}
        <p className="d-step-note">맞힌 개수와 상관없이 동의 여부는 직접 골라 주세요.</p>
      </section>
    );
    bottom = (
      <div className="d-pair">
        <button type="button" className="d-choose" onClick={() => decide("decline")}>
          동의하지 않음
        </button>
        <button type="button" className="d-choose" onClick={() => decide("agree")}>
          동의함
        </button>
      </div>
    );
  } else {
    // aborted — 이 화면에는 그만두기 버튼이 없으니 올 일이 없지만, 오면 약관으로 돌려보낸다
    body = (
      <section className="d-step">
        <p className="d-step-text">확인을 멈췄어요. 아무것도 기록하지 않았어요.</p>
      </section>
    );
    bottom = (
      <button type="button" className="d-agree" onClick={() => onClose()}>
        약관으로 돌아가기
      </button>
    );
  }

  const shownIndex = Math.min(showResult ? conceptIndex : conceptIndex + 1, total);
  const originalClause = originalOf ? clauseOf(originalOf) : undefined;

  return (
    <div className="d-screen">
      <TopBar title={title} onClose={quit} closeLabel="확인 그만두기" />
      {total > 0 && (
        <div className="d-progress">
          <div className="d-progress-text">
            <span>
              확인 문제 {shownIndex} / {total}
            </span>
          </div>
          <div className="d-bar" aria-hidden="true">
            <div className="d-bar-fill" style={{ width: `${(shownIndex / total) * 100}%` }} />
          </div>
        </div>
      )}
      {state.rejection && <p className="d-reject">{state.rejection}</p>}
      <div className="d-scroll">{body}</div>
      {bottom && (
        <div className="d-bottom">
          <div className="d-bottom-row">{bottom}</div>
        </div>
      )}
      {originalClause && (
        <Sheet label="원문" onClose={() => setOriginalOf(null)}>
          <div className="d-answer">
            <p className="d-answer-q">{originalClause.title}</p>
            <p className="d-quote">{originalClause.text}</p>
            <p className="d-step-note">
              {document.issuer} · {document.title} 원문에서 옮긴 문장이에요.
            </p>
          </div>
        </Sheet>
      )}
    </div>
  );
}
