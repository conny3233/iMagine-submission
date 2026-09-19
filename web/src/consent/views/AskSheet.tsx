import type { QaItem, ScenarioContent } from "../flow/types";
import { Sheet } from "./parts";

/** 답 문장 안의 **낱말** 을 청록색 용어로 보여준다 (피그마의 "파생결합증권" 표시). */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="d-term">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * 돋보기를 누르면 올라오는 "궁금한 점" 시트 (피그마 34:75 의 시트 모양).
 * 입력창도, 실시간 AI 호출도 없다 — AI 요약(content.summary)과 C(김민재)가 미리 만든 질문·답(content.qa)만 보여준다.
 * 이용자는 질문을 고르기만 하고, 답은 줄바꿈과 **강조** 만 쓴다.
 */
export default function AskSheet(props: {
  content: ScenarioContent;
  picked: QaItem | null;
  onPick: (item: QaItem | null) => void;
  onOriginal: (clauseId: string) => void;
  onClose: () => void;
}) {
  const { content, picked, onPick, onOriginal, onClose } = props;
  const { summary, qa } = content;

  if (picked) {
    return (
      <Sheet label="답변" onClose={onClose}>
        <div className="d-answer">
          <p className="d-answer-q">{picked.question}</p>
          {picked.answer.split("\n").map((line, i) => (
            <p key={i}>
              <Rich text={line} />
            </p>
          ))}
          <div className="d-answer-actions">
            {picked.clauseId && (
              <button type="button" className="d-more" onClick={() => onOriginal(picked.clauseId!)}>
                원문에서 보기 <span aria-hidden="true">›</span>
              </button>
            )}
            <button type="button" className="d-more muted" onClick={() => onPick(null)}>
              <span aria-hidden="true">‹</span> 다른 질문 보기
            </button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet label="궁금한 점" onClose={onClose}>
      {summary && (
        <section className="d-summary-box">
          <p className="d-summary-head">
            <span className="d-ai-tag">AI 요약</span>
            {summary.title}
          </p>
          <ul>
            {summary.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="d-step-note">AI가 원문을 요약했어요. 계약 내용은 원문이 기준이에요.</p>
        </section>
      )}

      <section className="d-suggest">
        <p className="d-suggest-title">자주 묻는 질문</p>
        {qa.length > 0 ? (
          <ul className="d-qa-list">
            {qa.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onPick(item)}>
                  <span>{item.question}</span>
                  <span aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="d-step-note">질문과 답을 준비하고 있어요.</p>
        )}
      </section>
    </Sheet>
  );
}
