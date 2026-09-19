import { useEffect, useState } from "react";
import { toString as qrToString } from "qrcode";

import { CHAINS, explorerTxUrl } from "../../lib/chain";
import imbankLogo from "../assets/imbank-logo.png";
import type { ReceiptWithStatus } from "../data";
import type { DocumentVersion } from "../types";
import type { ChainCheck } from "../useChainCheck";
import { formatDateTime, hexGroups } from "./shared";

/** 발행 기관별 영수증 머리 — 기관명은 문서 데이터에서 오고, 로고·주소는 여기서 찾는다. 없으면 이름만 쓴다. */
const ISSUERS: Record<string, { logo: string; lines: string[]; phone: string }> = {
  iM뱅크: { logo: imbankLogo, lines: ["iM뱅크 본점", "대구 수성구 달구벌대로 2310"], phone: "1566-5050" },
};

/**
 * 종이 영수증 (피그마 61:270 · 61:461). 내용은 영수증 payload 그대로이고(새 정보를 만들지 않는다),
 * 체인 대조 결과는 도장으로, 체인 기록 위치는 QR(=Etherscan 거래 페이지)로 보여준다.
 * 아래쪽(결정 · 지문 · QR)은 피그마 메모대로 이전 디자인을 그대로 둔다.
 */
export default function PaperReceipt({ item, check }: { item: ReceiptWithStatus; check: ChainCheck }) {
  const { receipt, usedDocument } = item;
  const { payload } = receipt;
  const attachment = receipt.chainAttachment;
  const txUrl = attachment ? explorerTxUrl(attachment.chainId, attachment.txHash, "logs") : null;
  const qrSvg = useQrSvg(txUrl);
  const issuer = usedDocument?.issuer ?? "알 수 없는 기관";
  const profile = ISSUERS[issuer];
  const [mainTitle, subTitle] = splitTitle(usedDocument?.title ?? payload.document.id);

  const part = (id: string) => clauseParts(id, usedDocument);
  const questionConcepts = [...new Set(payload.questions.map((q) => q.conceptId))];
  const groups = hexGroups(receipt.recordHash);

  return (
    <div className="paper-wrap">
      <article className="paper" aria-label="동의 영수증">
        {check.kind === "checked" && (
          <div className={`paper-stamp ${check.recordMatches ? "ok" : "bad"}`} aria-hidden="true">
            <span>블록체인</span>
            <b>{check.recordMatches ? "대조 일치" : "불일치"}</b>
          </div>
        )}

        <header className="paper-head">
          {profile ? (
            <img className="paper-logo" src={profile.logo} alt={issuer} width={80} height={53} />
          ) : (
            <div className="paper-issuer">{issuer}</div>
          )}
          <div className="paper-brand">동의 영수증</div>
        </header>

        <div className="paper-meta">
          <div>
            {(profile?.lines ?? [issuer]).map((l) => (
              <div key={l}>{l}</div>
            ))}
            <div>[전자동의]</div>
          </div>
          <div className="paper-meta-right">
            {profile && <div>고객센터 {profile.phone}</div>}
            <div>영수증 ID {payload.receiptId}</div>
            <div>{formatStamp(payload.decision.at)}</div>
          </div>
        </div>

        <hr className="paper-rule" />

        <div className="paper-doc-title">
          <b>{mainTitle}</b>
          {subTitle && <span>{subTitle}</span>}
        </div>

        <hr className="paper-rule" />

        <div className="paper-table" role="table" aria-label="확인한 조항">
          <div className="paper-tr head" role="row">
            <span role="columnheader">문서</span>
            <span role="columnheader">핵심조항</span>
            <span role="columnheader">확인여부</span>
          </div>
          {payload.conceptsShown.map((id) => {
            const p = part(id);
            return (
              <div className="paper-tr" role="row" key={id}>
                <span role="cell">{p.doc}</span>
                <span role="cell">{p.name}</span>
                <span role="cell">✓</span>
              </div>
            );
          })}
        </div>

        {questionConcepts.length > 0 && (
          <>
            <hr className="paper-rule" />
            <div className="paper-section">이해 확인</div>
            <hr className="paper-rule" />
            <div className="paper-table" role="table" aria-label="이해 확인">
              {questionConcepts.map((id) => {
                const p = part(id);
                const tries = payload.questions.filter((q) => q.conceptId === id).sort((a, b) => a.attempt - b.attempt);
                const result = tries[0]?.correct ? "✓" : tries[1]?.correct ? "1차 오답" : "오답";
                return (
                  <div className="paper-tr" role="row" key={id}>
                    <span role="cell">{p.doc}</span>
                    <span role="cell">{p.name}</span>
                    <span role="cell">{result}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {payload.calculation && (
          <>
            <hr className="paper-rule" />
            <div className="paper-section">계산결과</div>
            <hr className="paper-rule" />
            <Row label="원금" value={`${Number(payload.calculation.principal).toLocaleString("ko-KR")}원`} />
            <Row label="금리" value={`${payload.calculation.rateBeforePct}% → ${payload.calculation.rateAfterPct}%`} />
            <Row label="연간 이자 차이" value={`${Number(payload.calculation.yearlyDiffWon).toLocaleString("ko-KR")}원`} />
          </>
        )}

        <hr className="paper-rule double" />

        <div className="paper-total">
          <span>결정</span>
          <span>{payload.decision.choice === "agree" ? "동의" : "거부"}</span>
        </div>

        <hr className="paper-rule" />

        <div className="paper-section">영수증 지문 (SHA-256)</div>
        <code className="paper-hash">
          {[0, 4].map((start) => (
            <span key={start}>{groups.slice(start, start + 4).join(" ")}</span>
          ))}
        </code>

        <hr className="paper-rule" />

        {attachment ? (
          <div className="paper-chain">
            {txUrl && qrSvg && (
              <a
                className="paper-qr"
                href={txUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Etherscan 에서 블록체인 기록 열기"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            )}
            <div className="paper-chain-text">
              <div className="paper-chain-title">⛓ 블록체인에 기록됨</div>
              <div>
                {CHAINS[attachment.chainId]?.name ?? attachment.network} · 블록 #
                {attachment.blockNumber.toLocaleString("ko-KR")}
              </div>
              <div>{formatDateTime(attachment.recordedAt)}</div>
              {txUrl && <div className="paper-chain-hint">QR을 찍거나 누르면 공개 장부의 기록이 열립니다</div>}
            </div>
          </div>
        ) : (
          <div className="paper-chain-pending">아직 블록체인에 적히지 않았습니다</div>
        )}

        <footer className="paper-foot">내용이 한 글자라도 바뀌면 지문이 달라집니다</footer>
      </article>
    </div>
  );
}

/** "은행여신거래기본약관(가계용) · 가계대출 상품설명서" → 두 줄, "○○ 동의서 [목적]" → 제목 · [목적]. */
function splitTitle(title: string): [string, string | null] {
  const dot = title.indexOf(" · ");
  if (dot > 0) return [title.slice(0, dot), `- ${title.slice(dot + 3)}`];
  const bracket = title.indexOf(" [");
  if (bracket > 0) return [title.slice(0, bracket), title.slice(bracket + 1)];
  return [title, null];
}

/** 조항 제목 "[약관] 제7조 (기한전의 채무변제의무)" → 문서 "약관" · 핵심조항 "기한전의 채무변제의무". */
function clauseParts(clauseId: string, doc: DocumentVersion | undefined): { doc: string; name: string } {
  const docTitle = doc?.title ?? "";
  let kind = /확인서/.test(docTitle) ? "확인서" : /동의서/.test(docTitle) ? "동의서" : "약관";
  let name = doc?.clauses.find((c) => c.id === clauseId)?.title ?? clauseId;
  const tag = name.match(/^\[([^\]]+)\]\s*/);
  if (tag) {
    kind = tag[1];
    name = name.slice(tag[0].length);
  }
  const article = name.match(/^제\s*\d+\s*조\s*\((.+)\)$/);
  if (article) name = article[1];
  name = name.replace(/^(?:[①-⑩]|\d+\.|※)\s*/, "");
  return { doc: kind, name };
}

/** 영수증 머리의 시각 — "2026-09-18 11:40:32" (한국 시간). */
function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="paper-row">
      <span className="paper-row-label">{label}</span>
      <span className="paper-row-value">{value}</span>
    </div>
  );
}

function useQrSvg(text: string | null): string | null {
  const [svg, setSvg] = useState<{ text: string; svg: string } | null>(null);
  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    qrToString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1d1b16", light: "#0000" } })
      .then((s) => {
        if (!cancelled) setSvg({ text, svg: s });
      })
      .catch(() => {
        /* QR 은 보조 수단 — 실패해도 영수증 자체는 보여준다 */
      });
    return () => {
      cancelled = true;
    };
  }, [text]);
  return svg && svg.text === text ? svg.svg : null;
}
