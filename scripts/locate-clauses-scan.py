# -*- coding: utf-8 -*-
"""글자층이 없는(스캔한) 원문 PDF 용 locate-clauses.py — 조항 문장이 있는 줄 좌표를 clauses[].marks 에 적는다.

    py scripts/locate-clauses-scan.py ssdam-loan v1 [--preview]

스캔본은 글자 좌표가 없고, Windows OCR 은 밑줄 친 문단(표준약관과 다른 부분)을 통째로 놓쳐서 쓸 수 없었다.
그래서 두 단계로 나눈다:
  1) 사람이 페이지를 보고 조항이 있는 영역을 적는다 → data/raw/documents/<id>/clause-ranges.json
     (원문.pdf 를 가로 2480px 로 구웠을 때의 px. 쪽은 1부터.)
  2) 이 스크립트가 그 영역 안에서 글자 줄을 찾는다 — 어두운 픽셀이 있는 가로 띠 = 한 줄,
     그 띠 안에서 어두운 픽셀이 있는 좌우 끝 = 줄 폭. 연한 배경색(표·강조 상자)은 어둡지 않아서 무시된다.
--preview 는 tmp/scan/<id>-<version>-preview/ 에 쪽마다 칠한 PNG 를 남긴다 — 반드시 눈으로 확인한다.
marks 는 문서 content 가 아니라서 documentHash 는 바뀌지 않는다.

필요: pip install pymupdf pillow numpy
"""

import io
import json
import sys
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
WIDTH = 2480
DARK = 150  # 이보다 어두우면 글자
MIN_DARK = 3  # 한 행에 어두운 픽셀이 이만큼은 있어야 글자 행
MIN_LINE = 14  # 이보다 얇은 띠는 밑줄·표 선으로 보고 앞 줄에 붙인다
GAP = 6  # 이보다 짧게 끊긴 띠는 한 줄로 본다


def render(pdf_path: Path) -> list[np.ndarray]:
    doc = pymupdf.open(pdf_path)
    pages = []
    for page in doc:
        zoom = WIDTH / page.rect.width
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), colorspace=pymupdf.csGRAY)
        pages.append(np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width))
    return pages


def lines_in(gray: np.ndarray, x: list[int], y: list[int]) -> list[tuple[int, int, int, int]]:
    x0, x1 = x
    y0, y1 = y
    region = gray[y0:y1, x0:x1] < DARK
    rows = region.sum(axis=1) >= MIN_DARK
    bands, start, gap = [], None, 0
    for i, on in enumerate(list(rows) + [False] * (GAP + 1)):
        if on:
            if start is None:
                start = i
            gap, end = 0, i
        elif start is not None:
            gap += 1
            if gap > GAP:
                bands.append([start, end + 1])
                start = None
    merged: list[list[int]] = []
    for b in bands:
        if merged and b[1] - b[0] < MIN_LINE:
            merged[-1][1] = b[1]  # 밑줄
        else:
            merged.append(b)
    out = []
    for a, b in merged:
        if b - a < MIN_LINE:
            continue
        cols = np.where(region[a:b].sum(axis=0) > 0)[0]
        out.append((x0 + int(cols[0]), y0 + a, x0 + int(cols[-1]) + 1, y0 + b))
    return out


def main(doc_id: str, version: str, want_preview: bool) -> None:
    src = ROOT / "data" / "raw" / "documents" / doc_id
    doc_json = ROOT / "data" / "documents" / doc_id / f"{version}.json"
    ranges = json.loads((src / "clause-ranges.json").read_text(encoding="utf-8"))
    doc = json.loads(doc_json.read_text(encoding="utf-8"))
    pages = render(src / "원문.pdf")

    boxes_by_page: dict[int, list] = {}
    for clause in doc["clauses"]:
        spec = ranges.get(clause["id"])
        if not spec:
            raise SystemExit(f"[{clause['id']}] clause-ranges.json 에 영역이 없습니다")
        marks = []
        for r in spec:
            gray = pages[r["page"] - 1]
            h, w = gray.shape
            found = lines_in(gray, r["x"], r["y"])
            if not found:
                raise SystemExit(f"[{clause['id']}] {r['page']}쪽 영역에서 글자 줄을 찾지 못했습니다")
            for x0, y0, x1, y1 in found:
                pad = 3
                marks.append({
                    "page": r["page"],
                    "x": round((x0 - pad) / w * 100, 2),
                    "y": round((y0 - pad) / h * 100, 2),
                    "w": round((x1 - x0 + 2 * pad) / w * 100, 2),
                    "h": round((y1 - y0 + 2 * pad) / h * 100, 2),
                })
                boxes_by_page.setdefault(r["page"], []).append((x0, y0, x1, y1))
        clause["marks"] = marks
        print(f"  {clause['id']:<16} 줄 {len(marks):>2}  ({', '.join(sorted({str(m['page']) + '쪽' for m in marks}))})")

    with io.open(doc_json, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"갱신: {doc_json.relative_to(ROOT)}")

    if want_preview:
        out = ROOT / "tmp" / "scan" / f"{doc_id}-{version}-preview"
        out.mkdir(parents=True, exist_ok=True)
        for pno, boxes in boxes_by_page.items():
            img = Image.fromarray(pages[pno - 1]).convert("RGB")
            draw = ImageDraw.Draw(img, "RGBA")
            for b in boxes:
                draw.rectangle(b, fill=(255, 0, 0, 60), outline=(255, 0, 0, 200))
            img.save(out / f"page-{pno:02d}.png")
        print(f"미리보기: {out.relative_to(ROOT)}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 2:
        raise SystemExit("사용법: py scripts/locate-clauses-scan.py <문서id> <버전> [--preview]")
    main(args[0], args[1], "--preview" in sys.argv)
