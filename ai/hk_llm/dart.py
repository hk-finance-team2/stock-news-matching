"""공시 수집: DART 공시 목록에서 주요 공시만 골라 저장 → 바로 DONE (LLM 안 씀, 비용 0)

    from hk_llm.dart import collect_disclosures
    n = collect_disclosures()   # 새로 저장한 건수. .env 에 DART_API_KEY 필요

- 범위: 어제~오늘, 코스피·코스닥, 아래 TAKE 에 걸리는 제목만
- 저장: article (source_type NEWS, channel DART, 요약 = 제목) + article_stock (DART 가 준 종목코드)
- ponytail: 제목만 쓰므로 호재·악재를 알 수 없어 감성은 NEUTRAL. 원문 요약을 붙일 때 바꿈
- 시각: DART 는 날짜만 줌 → 오늘 공시는 수집 시각, 어제 공시는 그날 00:00
"""
import os
import re
from datetime import datetime, timedelta

import requests
from sqlalchemy import bindparam, text

from hk_llm.config import KST
from hk_llm.db import get_engine, to_db
from hk_llm.step2_dedup import url_key
from hk_llm.util import get_logger

API = "https://opendart.fss.or.kr/api/list.json"
VIEW = "https://dart.fss.or.kr/dsaf001/main.do?rcpNo={}"
PRESS = "전자공시(DART)"
REASON = "공시 제목 기준 (내용으로 호재·악재를 판단하지 않음)"
TAKE = re.compile(r"영업\(잠정\)실적|단일판매|공급계약|유상증자|무상증자|감자결정|합병|분할|자기주식|주식소각|최대주주변경"
                  r"|공개매수|타법인주식|투자판단관련|생산중단|영업정지|중대재해|풍문또는보도|조회공시|소송|횡령|배임"
                  r"|상장폐지|관리종목|거래정지|회생|부도|기업가치제고|주요사항보고서")
SKIP = re.compile(r"종료보고서|결과보고서|안내공시|설명서|공고|중요공시대상없음")

log = get_logger(__name__)


def important(report_nm):
    return bool(TAKE.search(report_nm)) and not SKIP.search(report_nm)


def _get_page(key, cls, begin, end, page):
    """한 쪽 받기. 키가 주소에 들어가므로 오류 문구에 주소를 남기지 않는다"""
    params = {"crtfc_key": key, "bgn_de": begin, "end_de": end, "corp_cls": cls, "page_no": page, "page_count": 100}
    try:
        res = requests.get(API, params=params, timeout=20)
        if res.status_code != 200:
            raise RuntimeError(f"DART HTTP {res.status_code}")
        data = res.json()
    except (requests.RequestException, ValueError) as e:
        raise RuntimeError(f"DART 요청 실패 ({type(e).__name__})") from None
    if data.get("status") == "013":  # 조회 결과 없음
        return [], 1
    if data.get("status") != "000":
        raise RuntimeError(f"DART 오류 {data.get('status')}: {data.get('message')}")
    return data["list"], int(data["total_page"])


def fetch_disclosures(key, today=None):
    today = today or datetime.now(KST).date()
    begin, end = (today - timedelta(days=1)).strftime("%Y%m%d"), today.strftime("%Y%m%d")
    rows = []
    for cls in ("Y", "K"):  # 코스피, 코스닥
        page, pages = 1, 1
        while page <= pages:
            got, pages = _get_page(key, cls, begin, end, page)
            rows += got
            page += 1
    return [r for r in rows if important(r["report_nm"])]


def published(rcept_dt, now):
    d = datetime.strptime(rcept_dt, "%Y%m%d").replace(tzinfo=KST)
    return now if d.date() == now.date() else d


def collect_disclosures(engine=None, key=None):
    key = key or os.environ.get("DART_API_KEY")
    if not key:
        log.warning("DART_API_KEY 없음: 공시 수집 건너뜀")
        return 0
    engine = engine or get_engine()
    now = datetime.now(KST)
    rows = fetch_disclosures(key, now.date())
    if not rows:
        return 0
    for r in rows:
        r["url"] = VIEW.format(r["rcept_no"])
        r["url_key"] = url_key(r["url"])
    have_sql = text("SELECT url_key FROM article WHERE url_key IN :k").bindparams(bindparam("k", expanding=True))
    insert = text("""INSERT INTO article (url_key, url, press, title, description, published_at, status, summary,
                                          sentiment, source_type, channel, collect_mode)
                     VALUES (:url_key, :url, :press, :title, NULL, :at, 'DONE', :title, 'NEUTRAL', 'NEWS', 'DART', 'REALTIME')""")
    link = text("""INSERT INTO article_stock (article_id, stock_code, is_main, sentiment, reason, match_type, relevance,
                                              matched_keywords)
                   VALUES (:id, :code, TRUE, 'NEUTRAL', :reason, 'DIRECT', 1.00, :name)""")
    new = 0
    with engine.begin() as conn:
        have = set(conn.execute(have_sql, {"k": [r["url_key"] for r in rows]}).scalars())
        stocks = set(conn.execute(text("SELECT stock_code FROM stock_info")).scalars())
        for r in rows:
            code = r["stock_code"].strip()
            if r["url_key"] in have or code not in stocks:  # 사전에 없는 종목은 FK 때문에 못 넣음
                continue
            title = f"{r['corp_name'].strip()} {' '.join(r['report_nm'].split())}"[:500]
            aid = conn.execute(insert, {"url_key": r["url_key"], "url": r["url"], "press": PRESS, "title": title,
                                        "at": to_db(published(r["rcept_dt"], now))}).lastrowid
            conn.execute(link, {"id": aid, "code": code, "reason": REASON, "name": r["corp_name"].strip()[:300]})
            new += 1
    log.info("공시: 주요 공시 %d건, 새로 저장 %d건", len(rows), new)
    return new


if __name__ == "__main__":
    # 필터·시각·키 보호 시험 (네트워크 없음)
    from unittest import mock

    for title in ("연결재무제표기준영업(잠정)실적(공정공시)", "단일판매ㆍ공급계약체결", "주요사항보고서(자기주식취득결정)", "공개매수신고서"):
        assert important(title), title
    for title in ("증권발행실적보고서", "합병등종료보고서", "자기주식처분결과보고서", "공개매수설명서", "결산실적공시예고(안내공시)",
                  "임원ㆍ주요주주특정증권등소유상황보고서", "조회공시요구(현저한시황변동)에대한답변(중요공시대상없음)"):
        assert not important(title), title
    now = datetime(2026, 11, 2, 15, 0, tzinfo=KST)
    assert published("20261102", now) == now
    assert published("20261101", now) == datetime(2026, 11, 1, tzinfo=KST)
    secret = "SECRETKEY"
    boom = requests.ConnectionError(f"{API}?crtfc_key={secret}")
    with mock.patch("hk_llm.dart.requests.get", side_effect=boom):
        try:
            _get_page(secret, "Y", "20261101", "20261102", 1)
            raise AssertionError("예외가 나야 함")
        except RuntimeError as e:
            assert secret not in str(e) and e.__cause__ is None and e.__suppress_context__, "오류에 키가 남으면 안 됨"

    # 실제 API + DB: 두 번 돌려 두 번째는 새 공시만 (DB 켜져 있어야 함)
    first = collect_disclosures()

    def count():
        with get_engine().connect() as c:
            return c.execute(text("SELECT COUNT(*) FROM article WHERE channel = 'DART'")).scalar()

    before = count()
    assert count() - before == collect_disclosures(), "돌려준 건수 = 실제로 늘어난 줄 수"
    with get_engine().connect() as c:
        rows = c.execute(text("""SELECT a.title, a.status, a.url, s.stock_code FROM article a JOIN article_stock s USING(article_id)
                                 WHERE a.channel = 'DART' ORDER BY a.article_id DESC LIMIT 5""")).all()
        dup = c.execute(text("SELECT COUNT(*) - COUNT(DISTINCT url_key) FROM article WHERE channel = 'DART'")).scalar()
    assert dup == 0
    for r in rows:
        assert r.status == "DONE" and "rcpNo=" in r.url and secret not in r.url
        print(tuple(r))
    print("ok 새로 저장", first)
