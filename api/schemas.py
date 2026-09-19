"""API 스키마 — 새 주제(동의 영수증)용으로 비워 둔 상태.

상권분석 스키마(AnalyzeRequest/AnalyzeResponse/Evidence/...)는 전부 삭제했다.
여기에 들어올 것은 0918-team-plan.md §10~11 이 정의한 것들이다:
    문서 등록(document_id·버전) / 세션 시작·답변·재확인 / 최종 선택
    영수증 payload · recordHash · chainAttachment

해시 대상 규칙은 api/hashing.py 가 그대로 유지한다 (payload 만 해시, 체인 정보 제외).
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    """계약에 없는 필드를 금지한다."""

    model_config = ConfigDict(extra="forbid")


class Health(StrictModel):
    status: Literal["ok"]
    version: str


class ChainAttachment(StrictModel):
    """영수증 본문(payload) **밖에** 붙는 체인 기록 정보.

    0918-team-plan.md §11: 해시 대상은 payload 뿐이다. 거래 결과를 나중에 붙여도
    이미 기록한 본문 해시가 바뀌지 않아야 한다.
    영수증 파일의 키 이름(camelCase)은 contract/scripts/record-receipts.js 가 쓰는 것과 같다.
    """

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    network: str
    chain_id: int = Field(alias="chainId")
    contract_address: str = Field(alias="contractAddress")
    tx_hash: str = Field(alias="txHash")
    block_number: int = Field(alias="blockNumber")
    recorded_at: str = Field(alias="recordedAt")
    issuer_address: str = Field(alias="issuerAddress")
    explorer_tx_url: Optional[str] = Field(default=None, alias="explorerTxUrl")


class ChatMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(StrictModel):
    messages: list[ChatMessage] = Field(min_length=1)
