import { type CSSProperties, useMemo, useState } from "react";

import chevron from "../assets/chevron.svg";
import { AFFILIATES, type Affiliate, CATALOG, catalogName, type SortKey, SORTS } from "../catalog";
import { type ReceiptWithStatus, useReceiptsByDocument } from "../data";

/** 피그마 55:467 — 중요 알림 + 보관함. 칸과 알림은 모두 실제 영수증에서 나온다. */
export default function Home({ onOpen }: { onOpen: (receiptId: string) => void }) {
  const byDocument = useReceiptsByDocument();
  const [filter, setFilter] = useState<Affiliate | "all">("all");
  const [sort, setSort] = useState<SortKey>("latest");

  const stored = useMemo(
    () =>
      CATALOG.flatMap((item) => {
        const receipt = byDocument.get(item.documentId);
        return receipt ? [{ item, receipt }] : [];
      }),
    [byDocument],
  );

  const tiles = useMemo(() => {
    const shown = filter === "all" ? stored : stored.filter((x) => x.item.affiliate === filter);
    return [...shown].sort((a, b) =>
      sort === "name"
        ? a.item.name.localeCompare(b.item.name, "ko")
        : b.receipt.receipt.payload.decision.at.localeCompare(a.receipt.receipt.payload.decision.at),
    );
  }, [stored, filter, sort]);

  const notices = useMemo(() => noticesFrom(stored.map((x) => x.receipt)), [stored]);

  return (
    <main className="im-home-page">
      <section className="im-notices" aria-labelledby="im-notices-title">
        <div className="im-notices-head">
          <h2 id="im-notices-title">중요 알림</h2>
          <span className="im-plus" aria-hidden="true" />
        </div>
        {notices.length === 0 ? (
          <p className="im-notice-empty">새 알림이 없어요.</p>
        ) : (
          <ul>
            {notices.map((n) => (
              <li key={n.key}>
                <button type="button" onClick={() => onOpen(n.receiptId)}>
                  <span className="im-notice-text">{n.text}</span>
                  <span className="im-notice-date">{n.date}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="im-vault" aria-labelledby="im-vault-title">
        <h2 id="im-vault-title">보관함</h2>
        <p className="im-vault-sub">아래의 서류가 블록체인으로 안전하게 보호받고 있습니다.</p>

        <div className="im-folders" role="tablist" aria-label="계열사">
          {AFFILIATES.map((a, i) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={filter === a.id}
              className={filter === a.id ? "im-folder on" : "im-folder"}
              style={{ "--folder": a.color, zIndex: filter === a.id ? 10 : AFFILIATES.length - i } as CSSProperties}
              onClick={() => setFilter(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="im-vault-bar">
          <span>총 {tiles.length}개</span>
          <label className="im-sort">
            <select value={sort} aria-label="정렬" onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <span aria-hidden="true">{SORTS.find((s) => s.id === sort)?.label}</span>
            <img src={chevron} alt="" width={5} height={10} />
          </label>
        </div>

        {tiles.length === 0 ? (
          <p className="im-empty">이 분류에 보관된 서류가 없어요.</p>
        ) : (
          <ul className="im-grid">
            {tiles.map(({ item, receipt }) => (
              <li key={item.documentId}>
                <button type="button" className="im-tile" onClick={() => onOpen(receipt.receipt.payload.receiptId)}>
                  <span className="im-thumb">
                    <img src={item.thumb} alt="" width={96} height={135} loading="lazy" decoding="async" />
                    {receipt.receipt.payload.decision.choice === "decline" && (
                      <span className="im-thumb-tag">동의 안 함</span>
                    )}
                  </span>
                  <span className="im-tile-name">{item.name}</span>
                  <span className="im-tile-date">{dotDate(receipt.receipt.payload.decision.at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="im-bottom-fade" aria-hidden="true" />
    </main>
  );
}

interface Notice {
  key: string;
  receiptId: string;
  text: string;
  date: string;
  at: string;
}

/** 영수증 상태에서 알림을 만든다 — 개정·기록 실패가 먼저, 그다음 최근 기록 순으로 넷까지. */
function noticesFrom(items: ReceiptWithStatus[]): Notice[] {
  const out: (Notice & { rank: number })[] = [];
  for (const item of items) {
    const { payload, chainAttachment } = item.receipt;
    const name = catalogName(payload.document.id) ?? item.usedDocument?.title ?? payload.document.id;
    const base = { receiptId: payload.receiptId, at: chainAttachment?.recordedAt ?? payload.decision.at };
    const kind = payload.decision.choice === "agree" ? "동의" : "동의하지 않음";
    if (item.isOutdated && item.latestDocument) {
      out.push({
        ...base,
        key: `${payload.receiptId}-renewal`,
        rank: 0,
        text: `[약관 개정] ${name} — 동의하신 ${payload.document.version} 이후 ${item.latestDocument.version}으로 바뀌었습니다.`,
        date: dotDate(item.latestDocument.publishedAt),
      });
    }
    if (item.local.status === "failed") {
      out.push({
        ...base,
        key: payload.receiptId,
        rank: 1,
        text: `[기록 실패] ${name} — 블록체인에 아직 적지 못했습니다. 영수증에서 다시 적어 주세요.`,
        date: dotDate(payload.decision.at),
      });
    } else if (chainAttachment) {
      out.push({
        ...base,
        key: payload.receiptId,
        rank: 2,
        text: `[블록체인 기록] ${name} — ${kind} 영수증이 블록 #${chainAttachment.blockNumber.toLocaleString("ko-KR")}에 기록되었습니다.`,
        date: dotDate(chainAttachment.recordedAt),
      });
    } else {
      out.push({
        ...base,
        key: payload.receiptId,
        rank: 2,
        text: `[기록 중] ${name} — ${kind} 영수증을 블록체인에 적고 있습니다.`,
        date: dotDate(payload.decision.at),
      });
    }
  }
  return out
    .sort((a, b) => a.rank - b.rank || b.at.localeCompare(a.at))
    .slice(0, 4)
    .map(({ rank: _rank, ...n }) => n);
}

/** 한국 시간 기준 "2026.09.18". */
function dotDate(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).replaceAll("-", ".");
}
