"""`POST /chat` — 대화 한 턴을 Server-Sent Events 로 흘려보낸다.

**지금은 배관만 남아 있다.** 상권분석 에이전트(api/llm/agent.py)는 주제 전환으로 삭제했고,
새 주제의 설명·이해확인 로직은 아직 없다. 이 파일을 남겨 둔 이유는 프레이밍과 헤더 때문이다 —
Render/nginx 계열 프록시가 스트림을 버퍼링하지 않게 하는 설정은 한 번 알아내면 다시 찾기 번거롭다.

프레임 형식:
    event: <이름>
    data: <JSON 한 줄>

새 주제에서 쓸 이벤트는 0918-team-plan.md §10 을 따라 정하면 된다.
지금 나가는 것은 meta / text / done 세 개뿐이다.
"""

from __future__ import annotations

import json
from typing import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from api import settings
from api.schemas import ChatRequest

router = APIRouter()

_PLACEHOLDER = (
    "대화 기능은 아직 구현되지 않았습니다. "
    "주제를 '동의 영수증'으로 전환하면서 이전 에이전트를 제거했습니다 — "
    "0918-team-plan.md 의 A04·A06 작업이 들어올 자리입니다."
)


def _frame(event: str, payload: object) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    async def body() -> AsyncIterator[str]:
        yield _frame("meta", {"mode": "placeholder", "model": settings.LLM_MODEL})
        yield _frame("text", {"delta": _PLACEHOLDER})
        yield _frame("done", {})

    return StreamingResponse(
        body(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            # Render/nginx 계열 프록시가 스트림을 버퍼링하지 않게 한다
            "X-Accel-Buffering": "no",
        },
    )
