"""지난 기사 채우기 (BACKFILL): 언론사 사이트맵 → 기사 페이지 → 종목 이름이 있는 기사만 저장 → 요약·매칭

    python -m hk_llm.steps.backfill 2026-10-27 2026-11-01 --count   하루마다 사이트맵 기사 수·통과 수만 셈 (저장·LLM 없음)
    python -m hk_llm.steps.backfill 2026-10-27 2026-11-01           저장 → 요약 → 매칭 (요약 1건 약 $0.0006)
    python -m hk_llm.steps.backfill 2026-10-20 2026-11-12 --refetch --count   제목만 남은 한경 기사 수만 셈
    python -m hk_llm.steps.backfill 2026-10-20 2026-11-12 --refetch  제목만 남은 한경 기사를 다시 받아 요약·매칭

- --refetch (2026-11-12 밤): 언론사 기준이 하루 동안 엄격했을 때(제목만) 지운 한경 요약을 되살림. 이미 저장된 기사라
  사이트맵 채우기(새 주소만)로는 안 잡힘 → 상태를 LISTED 로 돌려 4단계(본문)부터 다시. 유료 기사(SKIPPED)는 그대로

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


REFETCH_PRESSES = ("한국경제",)
REFETCH_BATCH = 20
MAX_WAITS = 3  # 하루 처리 중 차단기를 기다리는 최대 횟수
MAX_WAIT_SECONDS = 20 * 60
BLOCK_HINTS = ("403", "429", "401", "Forbidden", "Too Many")  # 이 이유로 쉬는 중이면 진짜 막힘 신호 → 기다리지 않고 멈춤


def _breaker_wait(host):
    """차단기가 '연결 오류'로 쉬는 중이면 남은 초(최대 20분), 아니면 0. 403·429 같은 막힘 신호면 0 (기다리지 않음)"""
    from hk_llm.core.resilience import breaker

    s = breaker._load().get(host) or {}
    until, reason = s.get("until"), str(s.get("reason") or "")
    if not until or any(h in reason for h in BLOCK_HINTS):
        return 0
    return int(min(MAX_WAIT_SECONDS, max(0, until - time.time()) + 5))
PACE = 3.0  # 다시 받기 때 기사 1건당 최소 초


def refetch_titles(start, end, engine=None, count_only=False, summarize_limit=200):
    """요약 없이 제목으로만 연결된 기사(한경)를 다시 받아 요약·매칭. (대상 수, 본문 받은 수)
    하루씩, 최근 날부터: LISTED 로 돌린 기사는 끝날 때까지 화면에서 빠지므로 한 번에 몇 시간씩 사라지지 않게"""
    engine = engine or get_engine()
    total = got = 0
    day = end
    while day >= start:
        n, g = _refetch_day(engine, day, count_only, summarize_limit)
        total += n
        got += g
        if g < 0:  # 막힘 신호로 멈춤
            break
        day -= timedelta(days=1)
    log.info("다시 받기 합계 %s~%s: 대상 %d건, 본문 %d건%s", start, end, total, max(got, 0), " (세기만)" if count_only else "")
    return total, got


def _refetch_day(engine, day, count_only, summarize_limit):
    """(대상 수, 본문 받은 수 — 막혀서 멈추면 -1)"""
    from hk_llm.steps.step4_body import fetch_bodies

    # 대상 = 요약이 없는 한경 기사 중 제목만 연결된 것(DONE·NO_STOCK) + 지난번에 멈춰 남은 것(LISTED·FETCHED)
    where = """press IN :p AND summary IS NULL AND status IN ('DONE', 'NO_STOCK', 'LISTED', 'FETCHED')
               AND source_type = 'NEWS' AND published_at >= :s AND published_at < :e"""
    args = {"p": list(REFETCH_PRESSES), "s": day, "e": day + timedelta(days=1)}
    with engine.begin() as conn:
        n = conn.execute(text(f"SELECT COUNT(*) FROM article WHERE {where}").bindparams(bindparam("p", expanding=True)), args).scalar()
        if count_only or not n:
            return n, 0
        conn.execute(text(f"""UPDATE article SET status = 'LISTED', last_error = NULL, retry_count = 0
                              WHERE {where} AND status IN ('DONE', 'NO_STOCK')""").bindparams(bindparam("p", expanding=True)), args)
    got = bad = waits = 0
    # 천천히: 20건씩 받고 쉬어서 기사 1건에 약 PACE 초 (평소 수집은 하루 약 200건. 비즈워치는 빠르게 약 1,700건 받은 뒤
    # 우리 봇을 막았음 — 같은 일을 피하려고 4단계 기본 간격 1초보다 느리게). 막히는 신호(본문 0건 + 실패·재시도)가 두 번이면 멈춤
    stopped = False
    while True:  # 본문: robots·사이트별 간격·유료 기사 건너뛰기는 4단계 그대로. since=그날 → 그날 이후 LISTED 만
        t0 = time.monotonic()
        done = fetch_bodies(engine, limit=REFETCH_BATCH, since=day, only=REFETCH_PRESSES)
        got += done.get("FETCHED", 0)
        # 처리 수만 봄 (done 에는 bad_hosts·tables_dropped 같은 참고 칸도 있어 any(done.values()) 로 보면 끝나지 않음)
        if not any(done.get(k, 0) for k in ("FETCHED", "SKIPPED", "RETRY", "FAILED")):
            break
        if done.get("FETCHED", 0) == 0 and done.get("RETRY", 0) + done.get("FAILED", 0) >= 3:
            # 우리 쪽 차단기가 연결 오류(인터넷 끊김 등)로 '쉬는 중'이면 막힌 게 아님 → 쉬는 시간이 끝날 때까지 기다렸다 계속
            # (11/12 17:52·18:11: 학원 인터넷이 끊겨 차단기가 열렸는데 '차단 가능'으로 멈췄음. 같은 시각 수집기는 한경 본문을 정상으로 받음)
            wait = _breaker_wait("www.hankyung.com")
            if wait and waits < MAX_WAITS:
                waits += 1
                log.info("한경 차단기가 연결 오류로 쉬는 중 → %d초 기다렸다 계속 (%d/%d)", wait, waits, MAX_WAITS)
                time.sleep(wait)
                continue
            bad += 1
            if bad >= 2:
                log.warning("본문이 연속으로 안 받아짐(차단 가능) → 다시 받기 멈춤. 남은 기사는 LISTED 로 남음: %s", done)
                stopped = True
                break
        else:
            bad = 0
        rest = REFETCH_BATCH * PACE - (time.monotonic() - t0)
        if rest > 0:
            time.sleep(rest)
    while summarize_articles(engine, summarize_limit, since=day):
        pass
    match_articles(engine)
    log.info("다시 받기 %s: 대상 %d건, 본문 %d건", day, n, got)
    return n, (-1 if stopped else got)


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
    if "--refetch" in sys.argv:
        print(refetch_titles(s, e, count_only="--count" in sys.argv))
    else:
        print(backfill(s, e, count_only="--count" in sys.argv))
