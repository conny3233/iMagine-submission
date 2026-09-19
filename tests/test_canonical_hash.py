r"""핵심: Python 해시 == Node 해시.

이게 통과하지 않으면 영수증 검증 화면이 원본을 "변경됨"으로 띄운다.
Python(api/hashing.py) 과 Node(scripts/hash-check.mjs) 가 같은 입력에 같은 해시를 내는지 본다.
(브라우저 쪽 구현은 web/src/lib/canonical.ts 에 그대로 남아 있다.)

실행:  .\.venv\Scripts\python.exe -m pytest tests/test_canonical_hash.py -v
전제:  node 가 PATH 에 있어야 한다.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from api.hashing import sha256_hex

ROOT = Path(__file__).resolve().parents[1]
HASH_CHECK = ROOT / "scripts" / "hash-check.mjs"

pytestmark = pytest.mark.skipif(
    shutil.which("node") is None, reason="node 가 없음"
)

CASES = [
    {"z": 1, "a": "2", "m": [3, "4.5", {"k": "v"}]},
    {"한글": "키", "값": ["가", "나", "다"], "n": 0},
    {"nested": {"b": {"c": [1, 2, 3]}, "a": "x"}, "empty": [], "obj": {}},
    {"unicode": "café ☕ 동의 영수증", "list": [{"x": "1.0"}, {"x": "2"}]},
    {"bignum": 2418, "neg": -5, "zero": 0, "s": "43.7"},
]


def _node_hash(payload: dict, mode: str | None = None) -> str:
    tmp = ROOT / "tests" / "_tmp_hash_case.json"
    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    try:
        args = ["node", str(HASH_CHECK), str(tmp)]
        if mode:
            args.append(mode)
        out = subprocess.run(args, capture_output=True, text=True, check=True)
        return out.stdout.strip()
    finally:
        tmp.unlink(missing_ok=True)


@pytest.mark.parametrize("payload", CASES)
def test_python_matches_node(payload):
    assert sha256_hex(payload) == _node_hash(payload)


def test_float_rejected_both_sides():
    from api.hashing import canonical_json

    with pytest.raises(TypeError):
        canonical_json({"x": 34.8})

    tmp = ROOT / "tests" / "_tmp_float.json"
    tmp.write_text('{"x": 34.8}', encoding="utf-8")
    try:
        r = subprocess.run(
            ["node", str(HASH_CHECK), str(tmp)], capture_output=True, text=True
        )
        assert r.returncode != 0  # Node 도 거부
    finally:
        tmp.unlink(missing_ok=True)
