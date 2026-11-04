"""백엔드 API 와 AI 서버 확인. 토큰은 출력하지 않음"""
import os
import re
import time

import requests
from sqlalchemy import text

from hk_llm.core.db import get_engine
from hk_llm.steps import dart

B = "http://localhost:8080"
A = "http://localhost:8000"
e = get_engine()

with e.connect() as c:
    day = c.execute(text("""SELECT d.stock_code, i.stock_name, d.news_summary, d.pos_count + d.neg_count + d.neu_count n FROM stock_daily_summary d
                            JOIN stock_info i USING(stock_code) WHERE d.summary_date = CURDATE() AND d.news_summary NOT LIKE '[예시]%' ORDER BY n DESC""")).all()
for r in day:
    print("DB 하루요약", tuple(r))
code = day[0].stock_code
one = next((r.stock_code for r in day if r.n == 1), code)

s = requests.get(f"{B}/api/stocks/{code}/summary", timeout=10).json()
print("백엔드 summary", s)
assert (s.get("data") or s).get("newsSummary") == day[0].news_summary or day[0].news_summary in str(s), "AI 저장본이 API 로 나와야 함"
lst = requests.get(f"{B}/api/articles", params={"stockCode": code, "period": "today"}, timeout=10).json()
print("백엔드 articles", str(lst)[:900])
dart_list = requests.get(f"{B}/api/articles", params={"q": "영업(잠정)실적", "size": 2}, timeout=10).json()
print("백엔드 공시", str(dart_list)[:800])

# AI 서버: LLM 없는 1건 종목으로만 (비용 0)
for _ in range(20):
    try:
        print("health", requests.get(f"{A}/health", timeout=2).json())
        break
    except requests.RequestException:
        time.sleep(1)
print("토큰 없음", requests.post(f"{A}/summaries/{one}", timeout=10).status_code)
tok = {"X-Internal-Token": os.environ["AI_INTERNAL_TOKEN"]}
print("형식 오류", requests.post(f"{A}/summaries/abc", headers=tok, timeout=10).status_code)
print("쿨다운", requests.post(f"{A}/summaries/{one}", headers=tok, timeout=30).json())
with e.begin() as c:
    c.execute(text("UPDATE stock_daily_summary SET generated_at = generated_at - INTERVAL 11 MINUTE WHERE stock_code = :c AND summary_date = CURDATE()"), {"c": one})
print("재생성", requests.post(f"{A}/summaries/{one}", headers=tok, timeout=60).json())
print("없는 기사 종목", requests.post(f"{A}/summaries/000020", headers=tok, timeout=60).json())

# 공시 요약 숫자 대조: 요약 속 숫자가 원문에 있는지
with e.connect() as c:
    rows = c.execute(text("SELECT article_id, title, url, summary, sentiment FROM article WHERE channel='DART' AND summarized_at IS NOT NULL")).all()
key = os.environ["DART_API_KEY"]
bad = 0
counts = {}
for r in rows:
    counts[r.sentiment] = counts.get(r.sentiment, 0) + 1
    src = dart.fetch_document(key, r.url.split("rcpNo=")[1])
    plain = src.replace(",", "")
    missing = [n for n in re.findall(r"\d[\d,]*\.?\d*", r.summary) if n.replace(",", "").rstrip(".") not in plain]
    if missing:
        bad += 1
        print("없는 숫자", r.article_id, r.title, missing)
print("공시", len(rows), "건 감성", counts, "없는 숫자 든 건", bad, "평균 길이", sum(len(r.summary) for r in rows) // len(rows))
