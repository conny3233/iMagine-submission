# -*- coding: utf-8 -*-
"""문서 JSON 의 조항 문장이 원문 PDF 몇 쪽 어디에 있는지 찾아 줄 단위 좌표로 적는다.
앱 ①(iM Docent) 원문 화면의 "핵심조항 보는 중" 이 페이지 이미지 위에 이 좌표로 빨간 강조를 얹는다.

    py scripts/locate-clauses.py isa-discretionary v1

결과는 data/documents/<id>/<version>.json 의 clauses[].marks 에 쓴다:
    { "page": 4, "x": 11.9, "y": 77.9, "w": 77.8, "h": 1.9 }   ← 페이지 크기 대비 % (1쪽부터)
marks 는 문서 content 가 아니라서 documentHash 는 바뀌지 않는다 (sourcePages 와 같은 성격).

찾는 방법: 조항 JSON 의 text 는 원문에서 문단(①②…)을 골라 옮긴 것이다. 그래서
  1) 조항 제목("제10조")이 나오는 줄부터 다음 조항 제목 전까지를 그 조항 범위로 잡고,
  2) 그 안에서 문단 기호로 시작하는 줄을 찾아, 공백을 뺀 글자가 JSON 문장 길이만큼 찰 때까지 줄을 모은다.
  3) 마지막 줄이 문장보다 길면 문장이 끝나는 글자까지만 칠한다 (글자별 좌표를 쓴다).
원문과 글자가 어긋나면 멈추고 알려준다 — 좌표가 틀린 강조는 없는 것보다 나쁘다.

필요: pip install pymupdf  (빌드 도구일 뿐이라 requirements.txt 에는 넣지 않는다)
"""

import json
import re
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
MARKERS = "①②③④⑤⑥⑦⑧⑨⑩"
HEADING = re.compile(r"^제\s*(\d+)\s*조")


def squash(s: str) -> str:
    # 문서 JSON 은 둥근 따옴표, PDF 는 곧은 따옴표를 쓴다 — 글자 수는 같으니 모양만 맞춘다
    return re.sub(r"\s+", "", s).translate(str.maketrans("“”‘’", "\"\"''"))


def load_lines(pdf: pymupdf.Document) -> list[dict]:
    lines = []
    for pno, page in enumerate(pdf):
        pw, ph = page.rect.width, page.rect.height
        for block in page.get_text("rawdict")["blocks"]:
            for line in block.get("lines", []):
                # 공백이 아닌 글자만, 글자마다 가로 위치를 들고 다닌다 — 줄 일부만 칠할 때 쓴다
                chars = [(c["c"], c["bbox"][0], c["bbox"][2]) for span in line["spans"] for c in span["chars"]]
                chars = [c for c in chars if not c[0].isspace()]
                if not chars:
                    continue
                text = "".join(c[0] for c in chars)
                lines.append({"page": pno + 1, "pw": pw, "ph": ph, "bbox": line["bbox"], "text": text, "chars": chars})
    lines.sort(key=lambda l: (l["page"], l["bbox"][1], l["bbox"][0]))
    return lines


def pct(v: float, total: float) -> float:
    return round(v / total * 100, 2)


def mark(line: dict, count: int | None = None) -> dict:
    """line 의 앞에서부터 count 글자(공백 제외)만큼을 칠한다. None 이면 줄 전체."""
    _, y0, _, y1 = line["bbox"]
    chars = line["chars"][:count] if count else line["chars"]
    start, end = chars[0][1], chars[-1][2]
    return {
        "page": line["page"],
        "x": pct(start, line["pw"]),
        "y": pct(y0 - 1.5, line["ph"]),
        "w": pct(end - start, line["pw"]),
        "h": pct(y1 - y0 + 3, line["ph"]),
    }


def article_range(lines: list[dict], number: int) -> list[dict]:
    start = next((i for i, l in enumerate(lines) if (m := HEADING.match(l["text"].strip())) and int(m[1]) == number), None)
    if start is None:
        raise SystemExit(f"원문에서 제{number}조 제목을 찾지 못했습니다")
    end = next((i for i in range(start + 1, len(lines)) if HEADING.match(lines[i]["text"].strip())), len(lines))
    # 쪽 번호 줄("- 4 -")은 본문이 아니다
    return [l for l in lines[start + 1 : end] if not re.fullmatch(r"-\d+-", l["text"])]


def locate(lines: list[dict], clause: dict) -> list[dict]:
    number = int(re.search(r"제\s*(\d+)\s*조", clause["title"])[1])
    body = article_range(lines, number)
    # JSON 문장을 문단 기호 기준으로 자른다. 기호가 없으면 조 전체가 한 문단이다.
    parts = [p.strip() for p in re.split(f"(?=[{MARKERS}])", clause["text"]) if p.strip()]
    marks = []
    for part in parts:
        want = squash(part)
        if part[0] in MARKERS:
            first = next((i for i, l in enumerate(body) if l["text"].startswith(part[0])), None)
            if first is None:
                raise SystemExit(f"{clause['id']}: 원문에서 {part[0]} 문단을 찾지 못했습니다")
        else:
            first = 0
        got = ""
        for line in body[first:]:
            text = squash(line["text"])
            room = len(want) - len(got)
            if room <= 0:
                break
            if len(text) <= room:
                got += text
                marks.append(mark(line))
            else:
                got += text[:room]
                marks.append(mark(line, room))
        # 앞부분이 다르면 엉뚱한 곳을 칠한 것이다
        if got[:20] != want[:20] or len(got) < len(want):
            raise SystemExit(f"{clause['id']}: 원문과 글자가 맞지 않습니다\n  JSON: {want[:40]}\n  PDF : {got[:40]}")
    return marks


def main(doc_id: str, version: str) -> None:
    pdf_path = ROOT / "data" / "raw" / "documents" / doc_id / "원문.pdf"
    json_path = ROOT / "data" / "documents" / doc_id / f"{version}.json"
    lines = load_lines(pymupdf.open(pdf_path))
    doc = json.loads(json_path.read_text(encoding="utf-8"))
    for clause in doc["clauses"]:
        clause["marks"] = locate(lines, clause)
        pages = sorted({m["page"] for m in clause["marks"]})
        print(f"{clause['id']:<18} {len(clause['marks']):>2}줄  {pages}쪽")
    out = json.dumps(doc, ensure_ascii=False, indent=2)
    # 좌표 하나는 한 줄로 — 그대로 두면 조항 6개에 수백 줄이 된다
    out = re.sub(r"\{\s+(\"page\"[^{}]*?)\s+\}", lambda m: "{ " + re.sub(r"\s*\n\s*", " ", m[1]) + " }", out)
    json_path.write_text(out + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
