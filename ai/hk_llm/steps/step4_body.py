"""4단계 (20~22번): LISTED 기사의 원문 페이지에서 본문을 가져와 FETCHED 로 저장

    from hk_llm.steps.step4_body import fetch_bodies, purge_old_bodies
    fetch_bodies()      # 어제 이후 LISTED 를 새 기사부터 처리. 결과 건수를 dict 로 돌려줌
    purge_old_bodies()  # 7일 지난 본문 지우기 (요약은 남음)

- robots.txt 가 막은 주소, 유료 기사 → SKIPPED (다시 안 함)
- robots.txt 를 확인하지 못한 사이트 → LISTED 그대로, 재시도 횟수에 안 넣음 (금지와 구별)
- 실패(네트워크·본문 못 찾음) → retry_count + 1, LISTED 그대로 → 다음 실행에서 다시. 3번째 실패면 FAILED
- 사이트마다 요청 간격 지킴 (robots.txt Crawl-delay, 없으면 1초)
"""
import re
import time
from collections import Counter
from datetime import datetime, timedelta
from urllib.parse import urlsplit

import lxml.html
import requests
from sqlalchemy import bindparam, text

from hk_llm.core.config import KST, USER_AGENT
from hk_llm.core.db import get_engine
from hk_llm.core.press_policy import title_only_presses
from hk_llm.steps.robots import allowed, crawl_delay, reachable
from hk_llm.core.util import get_logger, retry

# 언론사가 적어서 범용 추출기 대신 사이트별 본문 칸을 직접 지정 (2026-11-02 기사 페이지 확인)
BODY_XPATH = {
    "www.hankyung.com": '//*[@id="articletxt"]',
    "www.yna.co.kr": '//div[contains(@class, "story-news")]/p',  # 문단만: 칸 안에 구독 버튼·송고 시각이 섞여 있음
    "www.sedaily.com": '//*[@id="article-body"]',
    "www.fnnews.com": '//div[contains(@class, "article-view__body")]',
    "www.etnews.com": '//*[@itemprop="articleBody"]',
    "news.einfomax.co.kr": '//*[@itemprop="articleBody"]',
    "news.bizwatch.co.kr": '//*[@itemprop="articleBody"]',
}
DROP = ".//figure | .//figcaption | .//aside | .//script | .//style | .//table"  # 사진 설명·광고·표는 요약에 방해
PAYWALL = b"paywall-popup__body"  # 한경 프리미엄: 본문 대신 결제 안내만 옴 → 우회하지 않고 SKIPPED
MIN_LEN = 100  # 이보다 짧으면 본문 없는 기사([속보] 등) → SKIPPED
MAX_TRIES = 3
BAD_HOST_FAILS = 3  # 한 실행에서 이만큼 실패하고 성공이 0건이면 사이트 구조 변경 등으로 보고 알림
BATCH = 200  # ponytail: 1번 실행에 최대 200건 (사이트당 1초 → 최대 약 3분). 밀리면 다음 실행에서 이어감
KEEP_DAYS = 7
MAX_DELAY = 10  # robots.txt Crawl-delay 가 터무니없이 커도 1건당 최대 10초만 기다림

log = get_logger(__name__)


def extract(html, url):
    """HTML 에서 정제된 본문. 모르는 사이트거나 본문 칸이 없으면 None (칸이 여러 개면 이어 붙임)"""
    xpath = BODY_XPATH.get(urlsplit(url).netloc)
    if not xpath:
        return None
    found = lxml.html.fromstring(html).xpath(xpath)
    if not found:
        return None
    parts = []
    for body in found:
        for el in body.xpath(DROP):
            el.drop_tree()
        for br in body.iter("br"):
            br.tail = "\n" + (br.tail or "")
        for p in body.iter("p", "div"):
            p.tail = "\n" + (p.tail or "")
        parts.append(body.text_content())
    return clean("\n".join(parts))


def clean(text_):
    lines = []
    for line in text_.splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        # 기자 이메일·저작권·제보 안내 줄은 요약에 쓸모없음
        if (not line or re.search(r"\S+@\S+\.\S+|무단\s*전재", line) or line.startswith(("ⓒ", "©", "<저작권자", "제보는"))
                or line.endswith(" 송고")):  # 연합 "2026/11/02 10:30 송고"
            continue
        lines.append(line)
    return "\n".join(lines)


def _get(url):
    return retry(lambda: requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=15))


def fetch_bodies(engine=None, limit=BATCH):
    since = datetime.now(KST).date() - timedelta(days=1)  # 어제 이후만. 요약 대상이 아닌 옛 기사는 언론사에 요청하지 않음
    engine = engine or get_engine()
    with engine.connect() as conn:
        # 본문을 쓰지 않는 언론사(press_policy TITLE_ONLY)는 요청 자체를 안 보냄 → title_only.py 가 제목으로 처리
        rows = conn.execute(text("""SELECT article_id, url, retry_count FROM article
                                    WHERE status = 'LISTED' AND source_type = 'NEWS' AND published_at >= :since
                                      AND press NOT IN :skip
                                    ORDER BY article_id DESC LIMIT :n""").bindparams(bindparam("skip", expanding=True)),
                            {"since": since, "n": limit, "skip": title_only_presses()}).all()
    done = {"FETCHED": 0, "SKIPPED": 0, "RETRY": 0, "FAILED": 0}
    last_hit = {}  # 사이트별 마지막 요청 시각
    ok, bad = Counter(), Counter()  # 사이트별 본문 성공·실패
    for r in rows:
        p = urlsplit(r.url)
        if p.scheme != "https" or p.netloc not in BODY_XPATH:  # 정한 언론사 말고는 요청 자체를 안 보냄
            _update(engine, r.article_id, status="SKIPPED", error="모르는 사이트")
            done["SKIPPED"] += 1
            continue
        if not reachable(r.url):
            done["RETRY"] += 1
            continue
        if not allowed(r.url):
            _update(engine, r.article_id, status="SKIPPED", error="robots.txt 금지")
            done["SKIPPED"] += 1
            continue
        host = urlsplit(r.url).netloc
        wait = last_hit.get(host, 0) + min(crawl_delay(r.url), MAX_DELAY) - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        try:
            last_hit[host] = time.monotonic()
            html = _get(r.url).content
            body = extract(html, r.url)
            if body is None and PAYWALL in html:
                _update(engine, r.article_id, status="SKIPPED", error="유료 기사 (본문 안 줌)")
                done["SKIPPED"] += 1
                continue
            if body is not None and len(body) < MIN_LEN:  # 페이지는 왔는데 본문이 짧음 → 다시 해도 같음
                _update(engine, r.article_id, status="SKIPPED", error=f"본문 없음 ({len(body)}자)")
                done["SKIPPED"] += 1
                continue
            if body is None:
                raise ValueError("본문 칸 못 찾음")
        except Exception as e:
            tries = r.retry_count + 1
            status = "FAILED" if tries >= MAX_TRIES else "LISTED"
            _update(engine, r.article_id, status=status, error=str(e), tries=tries)
            bad[host] += 1
            done["FAILED" if status == "FAILED" else "RETRY"] += 1
            log.warning("본문 실패 %d/%d %s: %s", tries, MAX_TRIES, r.url, e)
            continue
        _update(engine, r.article_id, status="FETCHED", body=body, tries=0)
        done["FETCHED"] += 1
        ok[host] += 1
    done["bad_hosts"] = sorted(h for h, n in bad.items() if n >= BAD_HOST_FAILS and not ok[h])
    log.info("본문: %d건 중 %s, 사이트별 성공 %s 실패 %s", len(rows), done, dict(ok), dict(bad))
    return done


def _update(engine, article_id, status, body=None, error=None, tries=None):
    sql = text("""UPDATE article SET status = :status, body = COALESCE(:body, body), last_error = :err,
                  retry_count = COALESCE(:tries, retry_count) WHERE article_id = :id""")
    with engine.begin() as conn:
        conn.execute(sql, {"status": status, "body": body, "err": error and error[:1000], "tries": tries,
                           "id": article_id})


def purge_old_bodies(engine=None):
    """수집한 지 7일 지난 본문을 지움 (결정사항: 언론사 AI 정책). 지운 건수를 돌려줌"""
    sql = text("UPDATE article SET body = NULL WHERE body IS NOT NULL AND collected_at < NOW() - INTERVAL :d DAY")
    with (engine or get_engine()).begin() as conn:
        n = conn.execute(sql, {"d": KEEP_DAYS}).rowcount
    if n:
        log.info("7일 지난 본문 %d건 삭제", n)
    return n


if __name__ == "__main__":
    # 실제 사이트 1건씩 (본문을 받은 적 있는 언론사별 최신 기사. 새 기사는 [속보]·[표] 처럼 본문이 없을 수 있음)
    with get_engine().connect() as conn:
        urls = conn.execute(text("SELECT url FROM article WHERE article_id IN "
                                 "(SELECT MAX(article_id) FROM article WHERE channel = 'RSS' AND status = 'FETCHED' GROUP BY press)")).scalars().all()
    for u in urls:
        b = extract(_get(u).content, u)
        assert b and len(b) >= MIN_LEN, u
        assert not re.search(r"구독중|무단\s*전재| 송고$", b, re.M), f"꼬리 잡음 섞임: {u}"
        log.info("%s %d자: %s …", urlsplit(u).netloc, len(b), b[:60].replace("\n", " / "))
        time.sleep(1)
    print("ok")
