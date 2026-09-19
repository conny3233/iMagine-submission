# -*- coding: utf-8 -*-
"""쓰담쓰담 간편대출을 신청할 때 함께 동의하는 서식 6종을 문서 JSON 으로 만든다 (2026-09-18).

    py scripts/build-form-documents.py            ← data/documents/<id>/v1.json 6개를 쓴다
    py scripts/build-form-documents.py --print    ← 쓰지 않고 조항 문장만 보여 준다 (원문 대조용)

원문: data/raw/documents/<id>/원문.pdf — 팀원이 iM뱅크 앱에서 실제로 신청하며 받은 PDF 에서 신청인 이름·생년월일,
확인서의 나이·소득·부채 금액을 지운 것 (배포본이 공개 주소라서).

이 서식들은 표로 되어 있어서 약관처럼 "제N조" 로 조항을 찾을 수 없다. 그래서 조항마다
원문의 칸(쪽 · 세로 범위 · 가로 시작)을 적어 두고, 그 칸 안의 글자 줄을 그대로 이어 붙여 조항 문장으로 쓴다.
같은 줄들의 위치가 곧 "핵심조항 보는 중" 빨간 강조 좌표(marks)다 — 문장과 강조가 어긋날 수 없다.
오른쪽 끝까지 찬 줄은 문장이 이어지는 것(붙여 잇고, 낱말 사이에서 끊긴 곳만 FIX 로 띄운다),
일찍 끝난 줄은 표의 한 행이 끝난 것(줄바꿈)으로 본다.

필요: pip install pymupdf
"""

import io
import json
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent

# 조항: (id, 제목, [(쪽, 위 y, 아래 y, 가로 시작 x), ...])  — PDF 좌표(pt), 쪽은 1부터
FORMS = {
    "credit-inquiry": {
        "title": "개인(신용)정보 수집·이용·제공·조회 동의서 [(금융)거래를 위한 개인(신용)정보 조회 목적]",
        "clauses": [
            ("purpose", "① 수집·이용 목적", [(1, 300, 312, 130)]),
            ("retention", "① 보유 및 이용기간", [(1, 330, 418, 130)]),
            ("refusal", "① 거부 권리 및 불이익", [(1, 428, 462, 130)]),
            ("collect-items", "수집·이용 항목", [(1, 505, 518, 130), (1, 575, 588, 130)]),
            ("recipients", "② 제공받는 자 · 이용목적", [(1, 680, 740, 128)]),
            ("inquiry-period", "③ 조회 동의의 효력기간", [(2, 296, 332, 130)]),
            ("inquiry-items", "조회 항목 — 개인(신용)정보", [(2, 490, 582, 130)]),
        ],
    },
    "loan-credit-info": {
        "title": "개인(신용)정보 수집·이용·제공 동의서 [여신약정을 위한 필수 개인(신용)정보 수집·이용·제공 목적]",
        "clauses": [
            ("purpose", "① 수집·이용 목적", [(1, 318, 342, 130)]),
            ("retention", "① 보유 및 이용기간", [(1, 353, 452, 130)]),
            ("refusal", "① 거부 권리 및 불이익", [(1, 461, 497, 130)]),
            ("collect-items", "수집·이용 항목 — 개인(신용)정보", [(1, 617, 750, 130)]),
            ("recipients", "② 제공받는 자 · 이용목적", [(2, 85, 152, 126)]),
            ("prior-info", "※ 동의 이전 정보", [(2, 488, 500, 52)]),
            ("compensation", "※ 개인정보 유출 보상", [(2, 507, 531, 52)]),
        ],
    },
    "alt-credit-info": {
        "title": "개인(신용)정보 수집·이용·제공·조회 동의서 [대안정보를 활용한 여신(금융)거래용]",
        "clauses": [
            ("purpose", "① 수집·이용 목적", [(1, 210, 237, 130)]),
            ("retention", "① 보유 및 이용기간", [(1, 250, 366, 130)]),
            ("refusal", "① 거부 권리 및 불이익", [(1, 372, 411, 130)]),
            ("collect-items", "수집·이용 항목 — 일반개인정보", [(1, 536, 562, 130)]),
            ("recipients", "② 제공받는 자 · 이용목적", [(1, 642, 707, 130)]),
            ("inquiry-period", "③ 조회 동의의 효력 기간", [(2, 322, 380, 130)]),
            ("inquiry-items", "조회 항목 — 신용거래정보 · 신용도판단정보", [(2, 594, 645, 130)]),
        ],
    },
    "kftc-credit-info": {
        "title": "개인(신용)정보 이용 동의서 (금융결제원정보)",
        "clauses": [
            ("agent", "금융결제원 대리 확인", [(1, 96, 120, 30)]),
            ("unique-id", "1. [고지사항] 고유식별정보 처리", [(1, 158, 209, 70)]),
            ("data-used", "2. 이용 항목 — 대안신용정보 산출", [(1, 327, 462, 30)]),
            ("retention", "2. 보유 및 이용기간", [(1, 492, 538, 30)]),
            ("refusal", "거부 권리 및 불이익", [(1, 597, 621, 30)]),
        ],
    },
    "alt-third-party": {
        "title": "개인(신용)정보 제3자 제공동의서(대안정보이용)",
        "clauses": [
            ("recipients", "제공받는 자", [(1, 159, 200, 40)]),
            ("purposes", "제공받는 자의 이용 목적", [(1, 204, 288, 40)]),
            ("items", "제공하는 개인(신용)정보의 항목", [(1, 292, 433, 40)]),
            ("retention", "제공받는 자의 보유 및 이용기간", [(1, 451, 553, 40)]),
            ("refusal", "거부 권리", [(1, 577, 600, 30)]),
        ],
    },
    "suitability-check": {
        "title": "적합성·적정성 고객정보 확인서(개인용)",
        "clauses": [
            ("purpose", "확인서의 목적", [(1, 114, 153, 30)]),
            ("checklist", "체크리스트 항목", [(1, 229, 540, 50, 120)]),
            ("accuracy", "1. 정보의 정확성", [(1, 592, 616, 50)]),
            ("change", "2. 정보가 달라지면", [(1, 620, 644, 50)]),
            ("law", "금융소비자보호법 제17조·제18조", [(1, 707, 730, 90)]),
        ],
    },
}

# 줄이 낱말 사이에서 끊긴 곳 — 붙여 이으면 틀리는 곳만 띄어 준다 (원문과 다른 글자를 넣지 않는다)
FIX = {
    "거절시점": "거절 시점",
    "의무이행을위한": "의무이행을 위한",
    "동의의효력이": "동의의 효력이",
    "계약의체결": "계약의 체결",
    "대안정보를활용한": "대안정보를 활용한",
    "활용한여신": "활용한 여신",
    "제3자담보제공": "제3자 담보제공",
    "등)가종료된": "등)가 종료된",
    "보상받으실": "보상 받으실",
    "발생건수코리아크레딧뷰로": "발생건수 코리아크레딧뷰로",
    "관련법규에별도규정": "관련법규에 별도규정",
}

# 글머리표로 시작하는 줄은 새 항목이다 ("·이용됩니다" 처럼 줄 바꿈에 걸린 가운뎃점과 구분하려고 "· " 는 띄어쓰기까지 본다)
BULLETS = ("-", "ㅇ", "· ", "※", "*")


def lines_in(page: pymupdf.Page, y0: float, y1: float, x0: float, x1: float = 10_000) -> list[tuple]:
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(s["text"] for s in line["spans"]).strip()
            bx0, by0, bx1, by1 = line["bbox"]
            # □/■ 체크 표시와 "동의하십니까?" 질문 줄은 조항 문장이 아니라 서식의 답 칸이다
            if not text or text.startswith(("□", "■")) or "동의하십니까" in text or text in ("-", "√"):
                continue
            if y0 <= by0 <= y1 and x0 <= bx0 < x1:
                out.append((by0, bx0, bx1, by1, text))
    # 같은 줄(세로 차이 3pt 안)은 왼쪽부터
    out.sort(key=lambda l: (round(l[0] / 3), l[1]))
    return out


def join(lines: list[tuple]) -> str:
    """칸 안의 줄들을 잇는다. 오른쪽 끝까지 찬 줄은 다음 줄로 이어지는 문장(붙여 잇고),
    일찍 끝난 줄은 표의 한 행이 끝난 것(줄바꿈)이다."""
    # 칸 오른쪽 끝 — 짧은 줄만 모인 목록 칸에서도 행 끝을 알아보게 540pt 아래로는 잡지 않는다
    right = max(max(l[2] for l in lines), 540)
    s = ""
    for i, (_, _, x1, _, text) in enumerate(lines):
        if i == 0:
            s = text
            continue
        prev_x1, prev = lines[i - 1][2], lines[i - 1][4]
        if prev_x1 < right - 25 or text.startswith(BULLETS):
            s += "\n" + text
        elif prev.endswith((".", ",", ":", ")")):
            s += " " + text
        else:
            s += text
    for a, b in FIX.items():
        s = s.replace(a, b)
    return "\n".join(" ".join(row.split()) for row in s.split("\n"))


def build(doc_id: str, spec: dict) -> dict:
    pdf = pymupdf.open(ROOT / "data" / "raw" / "documents" / doc_id / "원문.pdf")
    clauses = []
    for cid, title, ranges in spec["clauses"]:
        rows, marks = [], []
        for r in ranges:
            lines = []
            pno, y0, y1, x0 = r[:4]
            x1 = r[4] if len(r) > 4 else 10_000
            page = pdf[pno - 1]
            pw, ph = page.rect.width, page.rect.height
            for line in lines_in(page, y0, y1, x0, x1):
                by0, bx0, bx1, by1, _ = line
                lines.append(line)
                marks.append(
                    {
                        "page": pno,
                        "x": round(bx0 / pw * 100, 2),
                        "y": round(by0 / ph * 100, 2),
                        "w": round((bx1 - bx0) / pw * 100, 2),
                        "h": round((by1 - by0) / ph * 100, 2),
                    }
                )
            if not lines:
                raise SystemExit(f"{doc_id}/{cid}: 칸 안에 글자가 없습니다 — 좌표를 확인하세요")
            rows.append(join(lines))  # 칸이 여러 개면 칸마다 줄을 바꾼다
        clauses.append({"id": cid, "title": title, "text": "\n".join(rows), "marks": marks})

    return {
        "id": doc_id,
        "version": "v1",
        "title": spec["title"],
        "issuer": "iM뱅크",
        "sourceUrl": f"/documents/{doc_id}-v1.pdf",
        # 서식에 시행일이 없다 — 진본 확인 도장의 발급일(원문을 받은 날)을 쓴다
        "publishedAt": "2026-09-17",
        "supersedes": None,
        "clauses": clauses,
        "content": "\n".join(f"{c['title']} {c['text']}" for c in clauses),
    }


def main() -> None:
    show_only = "--print" in sys.argv[1:]
    for doc_id, spec in FORMS.items():
        doc = build(doc_id, spec)
        if show_only:
            print(f"\n## {doc_id} — {doc['title']}")
            for c in doc["clauses"]:
                print(f"- [{c['id']}] {c['title']}: {c['text']}")
            continue
        path = ROOT / "data" / "documents" / doc_id / "v1.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        if old.get("sourcePages"):
            doc["sourcePages"] = old["sourcePages"]  # render-pdf-pages.py 가 채운 값은 유지
        with io.open(path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"썼음: {path.relative_to(ROOT)}  조항 {len(doc['clauses'])}개")


if __name__ == "__main__":
    main()
