"""Anthropic 클라이언트 + LLM_MODE 스위치.

LLM_MODE=fixture (기본): API 를 호출하지 않는다. 저장된 산출물을 쓴다.
LLM_MODE=live: ANTHROPIC_API_KEY 로 실제 호출.

시연이 네트워크·크레딧에 의존하지 않게 하기 위한 것.
"""

from __future__ import annotations

from functools import lru_cache

from api import settings


class LLMUnavailable(RuntimeError):
    """live 모드인데 키가 없거나 호출이 실패한 경우."""


def is_live() -> bool:
    return settings.LLM_MODE == "live"


@lru_cache(maxsize=1)
def get_client():
    """anthropic.Anthropic 인스턴스. live 모드에서만 호출할 것."""
    if not settings.ANTHROPIC_API_KEY:
        raise LLMUnavailable(
            "LLM_MODE=live 인데 ANTHROPIC_API_KEY 가 비어 있습니다. "
            ".env 에 키를 넣거나 LLM_MODE=fixture 로 두세요."
        )
    import anthropic

    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


MODEL = settings.LLM_MODEL
