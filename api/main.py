r"""API — FastAPI 앱.

주제 전환(2026-09-12): 상권분석 엔드포인트(/events, /analyze, /record)를 전부 제거했다.
새 주제는 Notion 「전현준 아이디어」 = AI 이해 확인형 금융동의 + 동의 영수증이며,
실행 계획은 레포 루트의 0918-team-plan.md / .xlsx 에 있다.

남아 있는 것 (인프라):
    GET  /health   서버 상태
    POST /chat     SSE 스트림 배관 — 지금은 자리표시자, 도메인 로직 없음

실행 (반드시 레포 루트에서):
    .\.venv\Scripts\python.exe -m uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import settings
from api.chat import router as chat_router
from api.schemas import Health

# 새 주제의 첫 구현이 들어오기 전까지의 자리표시자 버전.
SERVICE_VERSION = "0.0.0-consent-receipt"

app = FastAPI(
    title="동의 영수증 API",
    version=SERVICE_VERSION,
    description="AI 이해 확인형 금융동의 + 영수증 해시 앵커링 — 계획: 0918-team-plan.md",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)


@app.get("/health", response_model=Health)
def health() -> Health:
    return Health(status="ok", version=SERVICE_VERSION)
