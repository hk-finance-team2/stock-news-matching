"""5단계 (27~34번): FETCHED 기사 본문을 LLM 으로 요약 → SUMMARIZED

    from hk_llm.step5_summary import summarize, summarize_articles
    result, usage = summarize(title, body)   # ArticleSummary (아래 스키마), 토큰 수
    n = summarize_articles()                 # DB 의 FETCHED 를 요약해서 저장. 요약한 건수

LangChain 체인: 프롬프트 → OpenAI(정해진 형식으로 답하게) → ArticleSummary
저장: summary·sentiment·keywords·model·summarized_at, 회사 목록은 companies(JSON, V7) → 6단계 매칭의 입력
"""
import json
from datetime import datetime
from typing import Literal

import openai
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from sqlalchemy import text

from hk_llm.config import KST
from hk_llm.db import get_engine, to_db
from hk_llm.util import get_logger

MODEL = "gpt-5.4-nano"  # 실측 1건 약 $0.0006 → 하루 1,000건 월 약 $19 (예산 5만원 안)
MAX_CHARS = 3000  # ponytail: 본문 앞 3,000자만 (한글 약 2,000토큰). 기사 핵심은 앞쪽. 길이 문제 생기면 토큰 단위로
BATCH = 200  # 1번 실행에 최대 200건 (약 $0.13)
MAX_TRIES = 3
# 기사 탓이 아니라 OpenAI 쪽 문제(키·한도·접속) → 기사를 실패 처리하지 않고 이번 실행을 멈춤
STOP_ERRORS = (openai.AuthenticationError, openai.PermissionDeniedError, openai.RateLimitError,
               openai.APIConnectionError, openai.InternalServerError)

log = get_logger(__name__)

Sentiment = Literal["POSITIVE", "NEGATIVE", "NEUTRAL"]


class Company(BaseModel):
    name: str = Field(description="기사에 나온 회사 이름 (기사에 쓰인 그대로)")
    is_main: bool = Field(description="기사의 주인공 회사면 true")
    sentiment: Sentiment = Field(description="이 기사가 그 회사 주가에 주는 영향")
    reason: str = Field(description="감성 판단 이유, 한국어 짧은 한 문장 (50자 이내)")


class ArticleSummary(BaseModel):
    summary: str = Field(description="기사 요약, 한국어 2~3문장")
    sentiment: Sentiment = Field(description="기사 전체가 시장에 주는 분위기")
    keywords: list[str] = Field(description="핵심 키워드 3~5개, 각각 1~3단어 명사 (예: HBM, 3분기 실적, 금리 인하)")
    companies: list[Company] = Field(description="기사에서 다룬 기업. 없으면 빈 목록")


PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "너는 한국 주식 투자자를 위한 경제 뉴스 요약가다.\n"
     "- 기사에 있는 사실만 쓴다. 추측·투자 권유 금지\n"
     "- 요약은 숫자(실적, 등락률 등)를 살려 2~3문장, 문장마다 짧게. '~다' 체\n"
     "- 감성은 주가 영향 기준: 호재 POSITIVE, 악재 NEGATIVE, 판단 어렵거나 단순 언급 NEUTRAL\n"
     "- 회사(companies)는 영리 기업만. 정부·부처·공공기관·공기업·협회·사람은 넣지 않는다\n"
     "- 장소·행사장으로만 나온 회사, 출처(증권사 리포트 인용 등)로만 나온 회사는 넣지 않는다\n"
     "- 회사 이름은 기사에 쓰인 그대로 (그룹명으로 바꾸지 않음)"),
    ("human", "제목: {title}\n\n본문:\n{body}"),
])


def chain(model=MODEL):
    llm = ChatOpenAI(model=model, timeout=60, max_retries=2)
    return PROMPT | llm.with_structured_output(ArticleSummary, include_raw=True)  # raw: 토큰 수 확인용


def summarize(title, body, model=MODEL):
    """(ArticleSummary, 토큰 사용량 dict) 를 돌려준다. 형식에 안 맞는 답이면 예외"""
    out = chain(model).invoke({"title": title, "body": body[:MAX_CHARS]})
    if out["parsed"] is None:
        raise ValueError(f"LLM 답이 형식에 안 맞음: {out['parsing_error']}")
    return out["parsed"], out["raw"].usage_metadata


def summarize_articles(engine=None, limit=BATCH, model=MODEL):
    engine = engine or get_engine()
    with engine.connect() as conn:
        rows = conn.execute(text("""SELECT article_id, title, body, retry_count FROM article
                                    WHERE status = 'FETCHED' ORDER BY article_id LIMIT :n"""), {"n": limit}).all()
    done = failed = 0
    for r in rows:
        try:
            s, _ = summarize(r.title, r.body, model)
        except STOP_ERRORS:
            log.exception("OpenAI 쪽 문제로 요약 중단 (%d건 요약 후)", done)
            raise
        except Exception as e:
            tries = r.retry_count + 1
            with engine.begin() as conn:
                conn.execute(text("""UPDATE article SET retry_count = :t, last_error = :err,
                                     status = IF(:t >= :max, 'FAILED', status) WHERE article_id = :id"""),
                             {"t": tries, "max": MAX_TRIES, "err": str(e)[:1000], "id": r.article_id})
            log.warning("요약 실패 %d/%d (article_id %d): %s", tries, MAX_TRIES, r.article_id, e)
            failed += 1
            continue
        _save(engine, r.article_id, s, model)
        done += 1
    log.info("요약: %d건 중 %d건 저장, 실패 %d건", len(rows), done, failed)
    return done


def _save(engine, article_id, s, model):
    sql = text("""UPDATE article SET status = 'SUMMARIZED', summary = :summary, sentiment = :sentiment,
                  keywords = :keywords, companies = :companies, model = :model, summarized_at = :at,
                  retry_count = 0, last_error = NULL WHERE article_id = :id""")
    with engine.begin() as conn:
        conn.execute(sql, {
            "summary": s.summary,
            "sentiment": s.sentiment,
            "keywords": ",".join(k.replace(",", " ") for k in s.keywords)[:500],  # 쉼표 구분 VARCHAR(500)
            "companies": json.dumps([c.model_dump() for c in s.companies], ensure_ascii=False),  # 깨진 JSON 은 DB 가 거부
            "model": model,
            "at": to_db(datetime.now(KST)),
            "id": article_id,
        })


if __name__ == "__main__":
    # 27번: 기사 n개 요약 시험 (DB 의 FETCHED 에서 무작위, 저장 안 함. 1건 ≈ $0.0006)
    import sys

    n = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    with get_engine().connect() as conn:
        rows = conn.execute(text("SELECT title, body FROM article WHERE status = 'FETCHED' ORDER BY RAND() LIMIT :n"),
                            {"n": n}).all()
    tin = tout = 0
    for r in rows:
        s, usage = summarize(r.title, r.body)
        assert s.summary and s.sentiment in ("POSITIVE", "NEGATIVE", "NEUTRAL")
        tin, tout = tin + usage["input_tokens"], tout + usage["output_tokens"]
        print("\n=== 제목:", r.title, f"(입력 {usage['input_tokens']} / 출력 {usage['output_tokens']} 토큰)")
        print(s.model_dump_json(indent=2))
    # gpt-5.4-nano 가격 (조사 6번, 100만 토큰당 입력 $0.20 / 출력 $1.25)
    per = (tin * 0.20 + tout * 1.25) / 1e6 / len(rows)
    print(f"ok 1건당 약 ${per:.5f} → 하루 1,000건이면 월 약 ${per * 1000 * 30:.1f}")
