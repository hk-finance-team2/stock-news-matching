"""공통 도구: 로그 남기기, 실패하면 다시 해보기

    from hk_llm.core.util import get_logger, retry
    log = get_logger(__name__)
    log.info("RSS %d건", n)                              # 화면 + logs/hk_llm.log
    res = retry(lambda: requests.get(url, timeout=10))  # 실패하면 3번까지 다시
"""
import logging
import logging.handlers
import time

import requests

from hk_llm.core.config import LOG_DIR

FORMAT = "%(asctime)s %(levelname)-7s %(name)s | %(message)s"


def _setup():
    LOG_DIR.mkdir(exist_ok=True)
    # 하루마다 새 파일, 14일치만 남김 (본문 보관 7일보다 길게 → 실패 원인 추적용)
    file = logging.handlers.TimedRotatingFileHandler(
        LOG_DIR / "hk_llm.log", when="midnight", backupCount=14, encoding="utf-8"
    )
    logging.basicConfig(level=logging.INFO, format=FORMAT, handlers=[logging.StreamHandler(), file])
    # 라이브러리 잡음 줄이기
    for name in ("urllib3", "httpx", "openai"):
        logging.getLogger(name).setLevel(logging.WARNING)


def get_logger(name):
    if not logging.getLogger().handlers:
        _setup()
    return logging.getLogger(name)


log = get_logger(__name__)


# 다시 해볼 만한 오류만: 네트워크 끊김·시간 초과, 서버 5xx, 429(너무 많은 요청)
def _retryable(e):
    if isinstance(e, (requests.ConnectionError, requests.Timeout)):
        return True
    if isinstance(e, requests.HTTPError) and e.response is not None:
        return e.response.status_code >= 500 or e.response.status_code == 429
    return False


MAX_WAIT = 30.0  # 한 실행 안에서 기다리는 최대 시간(초). 서버가 더 오래 기다리라고 하면 여기서 안 기다리고 차단기에 맡김


def retry(fn, tries=3, wait=2.0):
    """fn() 을 실행. 다시 해볼 만한 오류면 쉬었다가 최대 tries 번.
    응답을 돌려주는 함수면 raise_for_status 까지 여기서 해서 5xx 도 재시도한다.
    끝까지 실패하면 마지막 예외를 그대로 던진다 → 호출한 쪽이 FAILED 처리·차단기 기록.

    쉬는 시간 (2026-11-10, 근거는 resilience.py):
    - 서버가 Retry-After 를 주면 그 시간 (RFC 6585·9110). MAX_WAIT 보다 길면 기다리지 않고 바로 실패로 넘김
    - 없으면 0 ~ wait·2^(i-1) 사이 무작위 (full jitter, 전에는 2·4초 고정)"""
    from hk_llm.core.resilience import jitter_wait, retry_after_seconds  # resilience 가 이 파일의 get_logger 를 씀 (순환 방지)

    for i in range(1, tries + 1):
        try:
            out = fn()
            if isinstance(out, requests.Response):
                out.raise_for_status()
            return out
        except Exception as e:
            if i == tries or not _retryable(e):
                raise
            asked = retry_after_seconds(getattr(e, "response", None))
            if asked is not None and asked > MAX_WAIT:
                raise
            pause = asked if asked is not None else jitter_wait(i, base=wait, cap=MAX_WAIT)
            log.warning("재시도 %d/%d (%.1f초 뒤): %s", i, tries - 1, pause, e)
            time.sleep(pause)
