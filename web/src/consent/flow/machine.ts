// 앱 ① 진행 규칙 — 화면 없이 동작하는 순수 함수. React 에서는 useReducer 로 감싸 쓰면 된다.
// 규칙 원본: 0918-team-plan.md §10 (2026-09-18 변경: 틀려도 멈추지 않는다)
//
//   설명 → 최초 문항 정답 → 다음 개념
//   설명 → 최초 문항 오답 → 그 개념만 재설명 → 재확인 문항(다른 문항)
//   재확인 문항은 맞든 틀리든 → 다음 개념
//   모든 개념을 다 풀면 → 최종 선택 화면(몇 개 틀렸는지 보여 준다). 동의 여부는 이용자가 정한다.
//   정답을 맞혔다고 자동 동의시키지 않고, 틀렸다고 동의를 막지도 않는다.
//
// 거부는 권리라서 끝나지 않은 어느 단계에서든 가능하다. 동의는 문제를 다 풀어야(최종 선택 화면에서만) 가능하다.
// "원문 다시 보기"는 상태 전이가 아니라 화면이 원문을 펼치는 일이라 여기엔 이벤트가 없다.
//
// 잘못된 요청(지금 출제되지 않은 문항, 없는 선택지, 중복 클릭)은 상태를 바꾸지 않고 rejection 에 이유만 남긴다.
// 서버 대신 이 함수가 §10 의 "현재 출제한 문항인지·선택지가 유효한지·이미 처리한 답변인지" 검사를 맡는다.

import type { Question, ScenarioContent } from "./types";

export type Decision = "agree" | "decline";

export type Phase =
  | { kind: "explain"; conceptIndex: number }
  | { kind: "question"; conceptIndex: number; attempt: 1 | 2 }
  | { kind: "remedial"; conceptIndex: number }
  | { kind: "decide" }
  | { kind: "done"; choice: Decision; at: string }
  | { kind: "aborted" };

export interface ExplanationMode {
  style: "easy" | "detailed";
  largeText: boolean;
}

export interface AnswerLog {
  conceptId: string;
  questionId: string;
  attempt: 1 | 2;
  choiceId: string;
  correct: boolean;
}

export interface FlowState {
  phase: Phase;
  mode: ExplanationMode;
  /** 설명을 보여준 개념 id, 보여준 순서대로. */
  shown: string[];
  answers: AnswerLog[];
  rejection: string | null;
}

export type FlowEvent =
  | { type: "SET_MODE"; style?: ExplanationMode["style"]; largeText?: boolean }
  | { type: "READY" } // 설명을 읽음 → 최초 문항
  | { type: "ANSWER"; questionId: string; choiceId: string }
  | { type: "RETRY" } // 재설명을 읽음 → 재확인 문항
  | { type: "DECIDE"; choice: Decision; at: string } // at 은 호출하는 쪽이 넣는다 (순수 함수 유지)
  | { type: "ABORT" }
  | { type: "RESTART" };

const DEFAULT_MODE: ExplanationMode = { style: "easy", largeText: false };

function enterConcept(content: ScenarioContent, state: FlowState, index: number): FlowState {
  const concept = content.concepts[index];
  if (!concept) return { ...state, phase: { kind: "decide" } };
  const shown = state.shown.includes(concept.id) ? state.shown : [...state.shown, concept.id];
  return { ...state, shown, phase: { kind: "explain", conceptIndex: index } };
}

export function initialState(content: ScenarioContent, mode: ExplanationMode = DEFAULT_MODE): FlowState {
  const empty: FlowState = { phase: { kind: "decide" }, mode, shown: [], answers: [], rejection: null };
  return enterConcept(content, empty, 0);
}

export function isFinished(state: FlowState): boolean {
  return state.phase.kind === "done" || state.phase.kind === "aborted";
}

/** 지금까지 틀린 답의 수 (재확인 문항 포함). 최종 선택 화면에 보여 준다. */
export function wrongCount(state: FlowState): number {
  return state.answers.filter((a) => !a.correct).length;
}

/** 지금 화면에 띄워야 할 문항. 문항 단계가 아니면 null. */
export function currentQuestion(content: ScenarioContent, state: FlowState): Question | null {
  const { phase } = state;
  if (phase.kind !== "question") return null;
  return content.concepts[phase.conceptIndex].questions[phase.attempt - 1];
}

function reject(state: FlowState, reason: string): FlowState {
  return { ...state, rejection: reason };
}

export function transition(content: ScenarioContent, prev: FlowState, event: FlowEvent): FlowState {
  const state = prev.rejection === null ? prev : { ...prev, rejection: null };
  const { phase } = state;

  if (event.type === "RESTART") return initialState(content, state.mode);
  if (isFinished(state)) return reject(state, "이미 끝난 흐름입니다. 새 실습을 시작하세요.");

  switch (event.type) {
    case "SET_MODE":
      return {
        ...state,
        mode: {
          style: event.style ?? state.mode.style,
          largeText: event.largeText ?? state.mode.largeText,
        },
      };

    case "READY":
      if (phase.kind !== "explain") return reject(state, "설명 단계가 아닙니다.");
      return { ...state, phase: { kind: "question", conceptIndex: phase.conceptIndex, attempt: 1 } };

    case "RETRY":
      if (phase.kind !== "remedial") return reject(state, "재설명 단계가 아닙니다.");
      return { ...state, phase: { kind: "question", conceptIndex: phase.conceptIndex, attempt: 2 } };

    case "ANSWER": {
      if (phase.kind !== "question") return reject(state, "지금 풀고 있는 문항이 없습니다.");
      const concept = content.concepts[phase.conceptIndex];
      const question = concept.questions[phase.attempt - 1];
      if (event.questionId !== question.id) {
        return reject(state, `지금 출제된 문항(${question.id})이 아닙니다: ${event.questionId}`);
      }
      if (!question.choices.some((c) => c.id === event.choiceId)) {
        return reject(state, `${question.id} 에 없는 선택지입니다: ${event.choiceId}`);
      }

      const correct = event.choiceId === question.answerId;
      const answered: FlowState = {
        ...state,
        answers: [
          ...state.answers,
          { conceptId: concept.id, questionId: question.id, attempt: phase.attempt, choiceId: event.choiceId, correct },
        ],
      };
      // 최초 오답만 재설명으로 보낸다. 재확인은 맞든 틀리든 다음 개념으로 — 틀려도 끝까지 풀게 한다.
      if (correct || phase.attempt === 2) return enterConcept(content, answered, phase.conceptIndex + 1);
      return { ...answered, phase: { kind: "remedial", conceptIndex: phase.conceptIndex } };
    }

    case "DECIDE":
      if (event.choice === "agree" && phase.kind !== "decide") {
        return reject(state, "확인 문제를 다 풀어야 동의할 수 있습니다.");
      }
      return { ...state, phase: { kind: "done", choice: event.choice, at: event.at } };

    case "ABORT":
      return { ...state, phase: { kind: "aborted" } };
  }
}
