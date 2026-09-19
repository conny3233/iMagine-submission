"""결과 무결성 해시 — Python 과 브라우저(JS)가 바이트 단위로 같은 문자열을 만들어야 한다.

규칙:
1. 해시 입력 = 응답에서 `integrity` 키를 통째로 제거한 것 (narrative 는 포함).
2. 직렬화: 키 정렬, 공백 없음, ensure_ascii=False.
3. float 금지 — canonical_json() 은 float 를 만나면 TypeError.

JS 대응 구현: web/src/lib/canonical.ts · 교차검증: tests/test_canonical_hash.py
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


def _reject_floats(obj: Any, path: str = "$") -> None:
    """소수는 문자열로 넣기로 했다. float 가 섞이면 언어 간 직렬화가 갈라진다."""
    if isinstance(obj, float):
        raise TypeError(
            f"해시 대상에 float 가 있습니다 ({path}={obj!r}). "
            f"소수는 문자열로, 개수는 int 로 넣으세요."
        )
    if isinstance(obj, dict):
        for k, v in obj.items():
            _reject_floats(v, f"{path}.{k}")
    elif isinstance(obj, (list, tuple)):
        for i, v in enumerate(obj):
            _reject_floats(v, f"{path}[{i}]")


def canonical_json(obj: Any) -> bytes:
    """정규화된 JSON 바이트열. float 가 있으면 TypeError."""
    _reject_floats(obj)
    return json.dumps(
        obj,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


def sha256_hex(obj: Any) -> str:
    """임의 JSON 직렬화 가능 객체의 정규화 SHA-256. `0x` 접두 포함."""
    return "0x" + hashlib.sha256(canonical_json(obj)).hexdigest()


def sha256_bytes(data: bytes) -> str:
    """원시 바이트열의 SHA-256. `0x` 접두 포함. (약관·동의서 원문 해시용)"""
    return "0x" + hashlib.sha256(data).hexdigest()


def result_hash(response: dict[str, Any]) -> str:
    """응답 객체에서 integrity 를 뺀 것의 해시.

    새 주제에서는 영수증 payload 해시가 이 자리에 온다 (0918-team-plan.md §11).
    """
    without_integrity = {k: v for k, v in response.items() if k != "integrity"}
    return sha256_hex(without_integrity)
