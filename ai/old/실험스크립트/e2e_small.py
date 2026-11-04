"""E2E 소량 (약 $0.02): 오늘 기사 최신 15건 요약·매칭 + 공시 5건 + 기사 묶기(칸 없으면 건너뜀) + 오늘 하루 요약"""
from datetime import datetime

from sqlalchemy import text

from hk_llm.core.config import KST
from hk_llm.core.db import get_engine
from hk_llm.steps.dart import summarize_disclosures
from hk_llm.steps.step5_summary import MODEL, _save, summarize
from hk_llm.steps.step6_match import match_articles
from hk_llm.steps.step8_daily import summarize_recent

e = get_engine()
with e.connect() as c:
    rows = c.execute(text("""SELECT article_id, title, body FROM article WHERE status='FETCHED' AND channel='RSS'
                             AND published_at >= :d ORDER BY published_at DESC LIMIT 15"""), {"d": datetime.now(KST).date()}).all()
tin = tout = 0
for r in rows:
    s, u = summarize(r.title, r.body)
    _save(e, r.article_id, s, MODEL)
    tin, tout = tin + u["input_tokens"], tout + u["output_tokens"]
print("뉴스 요약", len(rows), "토큰", tin, tout, f"${(tin * .2 + tout * 1.25) / 1e6:.4f}")
print("매칭 DONE", match_articles(e))
print("공시 요약", summarize_disclosures(e, limit=5))
print("하루 요약 (저장, LLM, 그대로)", summarize_recent(e))
with e.connect() as c:
    for r in c.execute(text("""SELECT a.article_id, a.title, a.summary, a.sentiment, s.reason FROM article a JOIN article_stock s USING(article_id)
                               WHERE a.channel='DART' AND a.summarized_at IS NOT NULL ORDER BY a.summarized_at DESC LIMIT 5""")):
        print("공시", r.article_id, r.title, "\n  ", r.sentiment, r.summary, "\n   이유:", r.reason)
    for r in c.execute(text("""SELECT d.stock_code, i.stock_name, d.news_summary, d.pos_count, d.neg_count, d.neu_count FROM stock_daily_summary d
                               JOIN stock_info i USING(stock_code) WHERE d.summary_date=:d AND d.news_summary NOT LIKE '[예시]%%' LIMIT 12"""), {"d": datetime.now(KST).date()}):
        print("하루", tuple(r))
