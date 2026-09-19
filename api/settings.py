"""환경설정 — 루트 .env 를 읽는다. 없으면 기본값으로 동작 (fixture 모드)."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]

# 루트 .env 를 명시적으로 로드 (실행 위치와 무관하게)
load_dotenv(ROOT / ".env")


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


# ── LLM (B4) ──
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
# 공모전 시연에서 답변 품질이 그대로 노출된다 — 여기서 아끼지 않는다.
LLM_MODEL = os.getenv("LLM_MODEL", "claude-opus-5")
LLM_MODE = os.getenv("LLM_MODE", "fixture").lower()  # fixture | live
# 대화는 "도구 라우팅 + 결과 설명"이라 난도가 낮다. 응답 속도를 위해 low 로 시작한다.
LLM_EFFORT = os.getenv("LLM_EFFORT", "low")  # low | medium | high | xhigh | max
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "8000"))

# ── API 서버 ──
API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", "8000"))
CORS_ORIGINS = _split_csv(
    os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
)

# 블록체인 설정은 여기 없다. 기록은 contract/scripts/record-receipts.js 가 촬영 전에 하고
# (서버는 서명하지 않는다), 앱은 공개 RPC 로 읽기만 한다.
