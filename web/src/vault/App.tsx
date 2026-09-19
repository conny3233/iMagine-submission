import { useEffect, useState } from "react";

import { importFromHash } from "../lib/receiptStore";
import { resumeRecording } from "../lib/recording";

import homeIcon from "./assets/home.svg";
import Home from "./views/Home";
import ReceiptDetail, { type DetailTab } from "./views/ReceiptDetail";

type View = { name: "home" } | { name: "detail"; receiptId: string; tab: DetailTab };

/**
 * 앱 ② "iM Print" — 피그마(IM print UI, 2026-09-18 최종본) 구조.
 *   홈: 중요 알림 + 보관함(분류 칩 · 정렬 · 서류 격자)
 *   상세: 탭 4개 — 동의 영수증 · 블록체인 원본 검증 · 동의한 약관 원문 · 약관 PDF 원본
 * PWA 로 홈 화면에 설치된다 (앱 ①과 달리).
 */
export default function App() {
  const [view, setView] = useState<View>({ name: "home" });

  useEffect(() => {
    // 앱 ①의 "iM Print에서 보기" 링크로 왔으면 실려 온 영수증을 보관함에 넣고 바로 연다.
    void importFromHash(window.location.hash).then((receiptId) => {
      if (receiptId) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
        setView({ name: "detail", receiptId, tab: "receipt" });
      }
      // 앱 ①을 도중에 닫았어도 끝나지 않은 기록을 이어서 확인한다.
      resumeRecording();
    });
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view.name]);

  const goHome = () => setView({ name: "home" });

  return (
    <div className="im-shell">
      <header className="im-header">
        <h1 className="im-title">iM Print</h1>
        {view.name === "detail" && (
          <button type="button" className="im-home" aria-label="홈으로" onClick={goHome}>
            <img src={homeIcon} alt="" width={29} height={29} />
          </button>
        )}
      </header>

      {view.name === "home" && <Home onOpen={(receiptId) => setView({ name: "detail", receiptId, tab: "receipt" })} />}
      {view.name === "detail" && (
        <ReceiptDetail
          receiptId={view.receiptId}
          tab={view.tab}
          onTab={(tab) => setView({ ...view, tab })}
          onHome={goHome}
        />
      )}
    </div>
  );
}
