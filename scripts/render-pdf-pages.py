# -*- coding: utf-8 -*-
"""약관 원문 PDF 를 페이지 이미지로 굽는다 — 앱 ②(iMprint) 상세 화면에 원문을 바로 깔기 위해서다.

    python scripts/render-pdf-pages.py isa-discretionary v1
    python scripts/render-pdf-pages.py credit-inquiry v1 --color   ← 색 표·색 글자가 있는 서식(동의서 등)

왜 이미지인가: iOS Safari 는 iframe 안의 PDF 를 첫 쪽만 보여주고 스크롤이 막힌다.
pdf.js 를 런타임에 얹는 방법도 있지만, 시연을 앞두고 폰에서 확실히 도는 쪽을 골랐다.
이미지는 <img> 한 줄이면 끝이고, 손가락으로 확대하는 것도 브라우저가 알아서 한다.

생성물은 커밋한다 (web/public/documents/<id>-<version>/page-NN.webp).
원문 PDF 가 바뀌면 이 스크립트를 다시 돌리고 문서 JSON 의 sourcePages 도 같이 갱신한다.
재실행 시 필요한 것만 쓴다 — 하지만 결과가 같으므로 git diff 는 비어 있는 게 정상이다.

필요: pip install pymupdf  (빌드 도구일 뿐이라 requirements.txt 에는 넣지 않는다)
"""

import io
import json
import sys
from pathlib import Path

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

# 폰 가로폭의 3배쯤 — 손가락으로 확대해도 글자가 뭉개지지 않는 선.
TARGET_WIDTH = 1240
# 글자만 있는 문서라 흑백 2치화 + 무손실이 제일 작다. 같은 쪽 기준 회색 손실(q78) 107KB,
# 회색 무손실 61KB, 2치화 무손실 21KB — 해상도를 1240px 로 올려도 30KB 다.
# 브라우저가 화면 크기로 줄이면서 알아서 부드럽게 만들어 준다.
THRESHOLD = 176
SCAN_QUALITY = 72


def main(doc_id: str, version: str, color: bool = False) -> None:
    pdf_path = ROOT / "data" / "raw" / "documents" / doc_id / "원문.pdf"
    if not pdf_path.exists():
        raise SystemExit(f"원문 PDF 가 없습니다: {pdf_path.relative_to(ROOT)}")

    out_dir = ROOT / "web" / "public" / "documents" / f"{doc_id}-{version}"
    out_dir.mkdir(parents=True, exist_ok=True)

    doc = pymupdf.open(pdf_path)
    pages, total = [], 0
    for i, page in enumerate(doc, start=1):
        zoom = TARGET_WIDTH / page.rect.width
        buf = io.BytesIO()
        if page.get_text().strip() and not color:
            pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), colorspace=pymupdf.csGRAY)
            img = Image.frombytes("L", (pix.width, pix.height), pix.samples)
            img = img.point(lambda v: 255 if v > THRESHOLD else 0)
            img.save(buf, format="WEBP", lossless=True, method=6)
        else:
            # 글자층 없는 스캔본(사진으로 찍은 설명서 등)이나 색 서식(--color)은 2치화하면 색 상자·연한 색 글자가
            # 뭉개진다 — 색 그대로 손실 압축
            pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            img.save(buf, format="WEBP", quality=SCAN_QUALITY, method=6)
        out = out_dir / f"page-{i:02d}.webp"
        out.write_bytes(buf.getvalue())
        size = out.stat().st_size
        total += size
        pages.append(f"/documents/{doc_id}-{version}/{out.name}")
        print(f"  {out.relative_to(ROOT)}  {pix.width}×{pix.height}  {size / 1024:.0f} KB")

    print(f"\n{len(pages)}쪽 · 합계 {total / 1024:.0f} KB")

    # 문서 JSON 에 쪽 목록을 심는다. content 는 건드리지 않으므로 documentHash 는 그대로다
    # (= 이미 체인에 봉인된 영수증의 검증이 깨지지 않는다).
    doc_json = ROOT / "data" / "documents" / doc_id / f"{version}.json"
    data = json.loads(doc_json.read_text(encoding="utf-8"))
    before = data.get("sourcePages")
    data["sourcePages"] = pages
    if before != pages:
        with io.open(doc_json, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"갱신: {doc_json.relative_to(ROOT)}  (sourcePages {len(pages)}개)")
    else:
        print(f"변경 없음: {doc_json.relative_to(ROOT)}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--color"]
    if len(args) != 2:
        raise SystemExit("사용법: python scripts/render-pdf-pages.py <문서id> <버전> [--color]")
    main(args[0], args[1], color="--color" in sys.argv[1:])
