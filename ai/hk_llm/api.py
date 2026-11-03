"""AI 서버: 백엔드가 "다시 생성" 버튼(B-06)에서 부르는 내부 API. 수집·요약은 loop.py 가 따로 돌림

    uvicorn hk_llm.api:app --port 8000     (ai 폴더에서. .env 에 AI_INTERNAL_TOKEN 필요)

LLM 비용이 나가는 API 라 토큰이 안 맞으면 거부, 같은 종목은 10분에 한 번만 새로 만듦
"""
import os
import secrets
from datetime import datetime, timedelta
from typing import Annotated

import openai
from fastapi import FastAPI, Header, HTTPException, Path
from sqlalchemy import text

from hk_llm.core.config import KST
from hk_llm.core.db import get_engine
from hk_llm.steps.step5_summary import STOP_ERRORS
from hk_llm.steps.step8_daily import regenerate

COOLDOWN = timedelta(minutes=10)

app = FastAPI(title="hk_llm")


def stored(engine, code, day):
    """(요약 문장, 생성 시각 KST) 또는 None"""
    sql = text("SELECT news_summary, generated_at FROM stock_daily_summary WHERE stock_code = :c AND summary_date = :d")
    with engine.connect() as conn:
        row = conn.execute(sql, {"c": code, "d": day}).first()
    return (row.news_summary, row.generated_at.replace(tzinfo=KST)) if row else None


def body(code, day, row, regenerated):
    return {"stockCode": code, "summaryDate": day.isoformat(), "newsSummary": row[0] if row else None,
            "generatedAt": row[1].isoformat() if row else None, "regenerated": regenerated}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/summaries/{stock_code}")
def regenerate_summary(stock_code: Annotated[str, Path(pattern=r"^[0-9A-Z]{6}$")],
                       x_internal_token: Annotated[str, Header()] = ""):
    """오늘 종합 요약을 새로 만듦. 10분 안에 또 부르면 저장된 것을 그대로 돌려줌 (regenerated=false)"""
    token = os.environ.get("AI_INTERNAL_TOKEN")
    if not token or not secrets.compare_digest(x_internal_token.encode(), token.encode()):
        raise HTTPException(401, "내부 토큰이 맞지 않음")
    engine, now = get_engine(), datetime.now(KST)
    day = now.date()
    row = stored(engine, stock_code, day)
    if row and now - row[1] < COOLDOWN:
        return body(stock_code, day, row, False)
    try:
        made = regenerate(engine, stock_code, day)
    except STOP_ERRORS as e:
        raise HTTPException(429 if isinstance(e, openai.RateLimitError) else 503, "요약 서버를 지금 쓸 수 없음") from None
    return body(stock_code, day, stored(engine, stock_code, day), made is not None)
