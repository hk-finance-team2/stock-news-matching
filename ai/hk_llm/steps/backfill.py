"""지난 기사 채우기 (BACKFILL): 언론사 사이트맵 → 기사 페이지 → 종목 이름이 있는 기사만 저장 → 요약·매칭

    python -m hk_llm.steps.backfill 2026-10-27 2026-11-01 --count   하루마다 사이트맵 기사 수·통과 수만 셈 (저장·LLM 없음)
    python -m hk_llm.steps.backfill 2026-10-27 2026-11-01           저장 → 요약 → 매칭 (요약 1건 약 $0.0006)

- 대상: AI 수집 제한이 없는 한국경제만 (2026-11-03 robots.txt 확인. 조사표 docs/조사/robots_조사.md)
  연합뉴스·서울경제·비즈워치는 AI 봇을 사이트 전체에서 막았고 연합인포맥스는 기사 끝에 AI 활용 금지
  → 실시간 RSS(요약 + 링크)만 하고 몇 달치를 모으는 과거분에서는 뺌
- 같은 규칙: robots.txt, 사이트별 요청 간격, 유료 기사 건너뜀, 본문 7일 뒤 삭제 (collected_at 기준)
- LLM 전에 코드로 거름: 매칭(on_topic)은 제목이나 본문 앞부분에 회사 이름이 있어야 연결하므로,
  그 조건이 안 되는 기사는 저장도 요약도 하지 않음 (본문을 쌓지 않고 비용 0)
- 저장: status FETCHED, channel SITEMAP, collect_mode BACKFILL. 그다음은 5·6단계가 그대로 처리
"""
import re
import sys
import time
from datetime import datetime, timedelta
from urllib.parse import urlsplit

import lxml.html
from sqlalchemy import bindparam, text

from hk_llm.core.config import KST
from hk_llm.core.db import get_engine, to_db
from hk_llm.core.util import get_logger
from hk_llm.steps.robots import allowed, crawl_delay
from hk_llm.steps.step2_dedup import url_key
from hk_llm.steps.step4_body import MAX_DELAY, MIN_LEN, PAYWALL, _get, extract
from hk_llm.steps.step5_summary import summarize_articles
from hk_llm.steps.step6_match import LEAD_CHARS, load_dictionary, match_articles, norm

SITEMAPS = {"한국경제": "https://www.hankyung.com/sitemap/daily-article/{:%Y%m%d}.xml"}
MIN_NAME = 2  # 이보다 짧은 이름은 거르기에 안 씀

log = get_logger(__name__)


def sitemap_urls(xml):
    """[(주소, lastmod)] — 사이트맵의 <url> 마다"""
    return re.findall(r"<loc>\s*(.*?)\s*</loc>\s*<lastmod>\s*(.*?)\s*</lastmod>", xml)


def page_meta(html):
    """(제목, 발행 시각 또는 None) — og:title, article:published_time"""
    doc = lxml.html.fromstring(html)
    title = (doc.xpath('string(//meta[@property="og:title"]/@content)') or doc.findtext(".//title") or "").strip()
    at = doc.xpath('string(//meta[@property="article:published_time"]/@content)').strip()
    try:
        return title, datetime.fromisoformat(at) if at else None
    except ValueError:
        return title, None


def has_stock_name(title, body, names):
    """제목이나 본문 앞부분에 사전의 종목 이름·별칭이 있나 (on_topic 과 같은 범위)"""
    head = norm(title) + " " + norm(body[:LEAD_CHARS])
    return any(n in head for n in names if len(n) >= MIN_NAME)


def backfill_day(engine, press, day, names, count_only=False):
    """(사이트맵 기사 수, 이름 있는 기사 수, 새로 저장 수)"""
    res = _get(SITEMAPS[press].format(day))
    rows = sitemap_urls(res.text)
    keys = {url_key(u): (u, m) for u, m in rows}
    with engine.connect() as conn:
        have = set(conn.execute(text("SELECT url_key FROM article WHERE url_key IN :k").bindparams(
            bindparam("k", expanding=True)), {"k": list(keys) or [""]}).scalars())
    insert = text("""INSERT IGNORE INTO article (url_key, url, press, title, body, published_at, status,
                                                 source_type, channel, collect_mode)
                     VALUES (:key, :url, :press, :title, :body, :at, 'FETCHED', 'NEWS', 'SITEMAP', 'BACKFILL')""")
    hit = new = 0
    last = 0.0
    for key, (url, lastmod) in keys.items():
        if key in have or not allowed(url):
            continue
        wait = last + min(crawl_delay(url), MAX_DELAY) - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        last = time.monotonic()
        try:
            html = _get(url).content
        except Exception as e:  # 한 건 실패는 건너뜀
            log.warning("가져오기 실패 %s: %s", url, e)
            continue
        if PAYWALL in html:
            continue
        body = extract(html, url)
        if not body or len(body) < MIN_LEN:
            continue
        title, at = page_meta(html)
        if not title or not has_stock_name(title, body, names):
            continue
        hit += 1
        if count_only:
            continue
        at = at or datetime.fromisoformat(lastmod)
        with engine.begin() as conn:
            new += conn.execute(insert, {"key": key, "url": url, "press": press, "title": title[:500], "body": body,
                                         "at": to_db(at)}).rowcount
    log.info("지난 기사 %s %s: 사이트맵 %d건, 이름 있음 %d건, 새로 저장 %d건", press, day, len(rows), hit, new)
    return len(rows), hit, new


def backfill(start, end, engine=None, count_only=False, summarize_limit=200):
    """start~end(날짜 포함). 저장 뒤 그 기간 FETCHED 를 요약하고 다시 매칭"""
    engine = engine or get_engine()
    names = set(load_dictionary(engine)[0])
    total = [0, 0, 0]
    day = start
    while day <= end:
        for press in SITEMAPS:
            for i, n in enumerate(backfill_day(engine, press, day, names, count_only)):
                total[i] += n
        day += timedelta(days=1)
    log.info("지난 기사 합계 %s~%s: 사이트맵 %d건, 이름 있음 %d건, 새로 저장 %d건", start, end, *total)
    if not count_only:
        while summarize_articles(engine, summarize_limit, since=start):
            pass
        match_articles(engine)
    return total


if __name__ == "__main__":
    s, e = (datetime.strptime(x, "%Y-%m-%d").date() for x in sys.argv[1:3])
    print(backfill(s, e, count_only="--count" in sys.argv))
