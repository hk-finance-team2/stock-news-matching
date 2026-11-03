"""본문 수집 전 robots.txt 확인. 사이트(호스트)별로 한 번만 받아서 캐시한다.

사용:
    from hk_llm.steps.robots import allowed, crawl_delay
    if allowed(url):
        time.sleep(crawl_delay(url))
        ...
"""
import urllib.robotparser
from functools import lru_cache
from urllib.parse import urlsplit

import requests

from hk_llm.core.config import USER_AGENT

DEFAULT_DELAY = 1.0  # robots.txt 에 Crawl-delay 가 없을 때 요청 간격(초)


# ponytail: 프로세스가 살아있는 동안 캐시 유지. 스케줄러로 오래 돌리면 하루 1번 cache_clear() 할 것
@lru_cache(maxsize=None)
def _parser(origin):
    rp = urllib.robotparser.RobotFileParser()
    try:
        res = requests.get(f"{origin}/robots.txt", headers={"User-Agent": USER_AGENT}, timeout=10)
    except requests.RequestException:
        rp.disallow_all = True  # 확인 못 하면 수집하지 않는다
        return rp
    if res.ok:
        rp.parse(res.text.splitlines())
    elif res.status_code >= 500:
        rp.disallow_all = True  # 서버 오류: 일시적일 수 있으니 수집하지 않는다
    else:
        rp.allow_all = True  # 4xx: robots.txt 없음 = 제한 없음 (RFC 9309)
    return rp


def _origin(url):
    p = urlsplit(url)
    return f"{p.scheme}://{p.netloc}"


def allowed(url):
    return _parser(_origin(url)).can_fetch(USER_AGENT, url)


def crawl_delay(url):
    return _parser(_origin(url)).crawl_delay(USER_AGENT) or DEFAULT_DELAY
