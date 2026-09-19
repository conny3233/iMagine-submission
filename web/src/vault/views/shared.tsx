import type { DocumentClause, DocumentVersion } from "../types";

/** 영수증·체인 시각은 촬영 기기 설정과 무관하게 한국 시간으로 보여준다. */
export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

/** 0x 해시를 8글자씩 끊는다 — 사람이 눈으로 대조하기 쉽게. */
export function hexGroups(hash: string): string[] {
  return hash.replace(/^0x/, "").match(/.{1,8}/g) ?? [];
}

/** 앞 8글자 … 뒤 8글자. 두 지문을 나란히 놓고 한눈에 비교할 때 쓴다. */
export function shortHash(hash: string): string {
  const h = hash.replace(/^0x/, "");
  return `${h.slice(0, 8)}…${h.slice(-8)}`;
}

/** 두 문서 버전의 조항을 id 기준으로 비교해, 내용이 달라진 조항만 반환한다. */
export function diffClauses(
  before: DocumentVersion | undefined,
  after: DocumentVersion | undefined,
): Array<{ id: string; title: string; before: string | null; after: string | null }> {
  if (!before || !after) return [];
  const beforeById = new Map(before.clauses.map((c: DocumentClause) => [c.id, c]));
  const afterById = new Map(after.clauses.map((c: DocumentClause) => [c.id, c]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  const out: Array<{ id: string; title: string; before: string | null; after: string | null }> = [];
  for (const id of ids) {
    const b = beforeById.get(id);
    const a = afterById.get(id);
    if (b?.text === a?.text) continue;
    out.push({ id, title: (a ?? b)!.title, before: b?.text ?? null, after: a?.text ?? null });
  }
  return out;
}
