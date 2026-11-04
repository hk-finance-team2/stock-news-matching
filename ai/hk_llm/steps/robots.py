"""본문 수집 전 robots.txt 확인. 사이트(호스트)별로 한 번만 받아서 캐시한다.

사용:
    from hk_llm.steps.robots import allowed, crawl_delay
    if allowed(url):
        time.sleep(crawl_delay(url))
        ...

확인에 실패하면 allowed 는 False (수집 안 함). 금지와 구별하려면 reachable 을 먼저 부른다
"""
import time
import urllib.robotparser
from datetime import date
from functools import lru_cache
from urllib.parse import urlsplit

import requests

from hk_llm.core.config import USER_AGENT

DEFAULT_DELAY = 1.0  # robots.txt 에 Crawl-delay 가 없을 때 요청 간격(초)
RETRY_AFTER = 300  # 확인에 실패한 사이트는 이 시간(초) 동안 다시 안 물어봄
_down = {}  # 사이트 → 다시 물어볼 수 있는 시각


class RobotsUnavailable(Exception):
    """robots.txt 를 확인하지 못함 (일시적일 수 있음). 예외는 캐시되지 않아 다음에 다시 받음"""


@lru_cache(maxsize=64)  # 사이트·날짜별로 저장 → 자동 실행을 오래 켜 둬도 하루 1번 새로 받음
def _parser(origin, day):
    rp = urllib.robotparser.RobotFileParser()
    try:
        res = requests.get(f"{origin}/robots.txt", headers={"User-Agent": USER_AGENT}, timeout=10)
    except requests.RequestException as e:
        raise RobotsUnavailable(origin) from e
    if res.ok:
        rp.parse(res.text.splitlines())
    elif res.status_code >= 500:
        raise RobotsUnavailable(origin)
    else:
        rp.allow_all = True  # 4xx: robots.txt 없음 = 제한 없음 (RFC 9309)
    return rp


def _origin(url):
    p = urlsplit(url)
    return f"{p.scheme}://{p.netloc}"


def _load(url):
    origin = _origin(url)
    if time.monotonic() < _down.get(origin, 0):
        raise RobotsUnavailable(origin)
    try:
        return _parser(origin, date.today())
    except RobotsUnavailable:
        _down[origin] = time.monotonic() + RETRY_AFTER
        raise


def reachable(url):
    """robots.txt 를 확인할 수 있나. False 면 금지가 아니라 지금 모르는 것"""
    try:
        _load(url)
        return True
    except RobotsUnavailable:
        return False


def allowed(url):
    try:
        return _load(url).can_fetch(USER_AGENT, url)
    except RobotsUnavailable:
        return False  # 확인 못 하면 수집하지 않는다


def crawl_delay(url):
    try:
        return _load(url).crawl_delay(USER_AGENT) or DEFAULT_DELAY
    except RobotsUnavailable:
        return DEFAULT_DELAY
