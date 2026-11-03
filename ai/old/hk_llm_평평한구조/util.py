"""공통 도구: 로그 남기기, 실패하면 다시 해보기

    from hk_llm.util import get_logger, retry
    log = get_logger(__name__)
    log.info("RSS %d건", n)                              # 화면 + logs/hk_llm.log
    res = retry(lambda: requests.get(url, timeout=10))  # 실패하면 3번까지 다시
"""
import logging
import logging.handlers
import time

import requests

from hk_llm.config import LOG_DIR

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


def retry(fn, tries=3, wait=2.0):
    """fn() 을 실행. 다시 해볼 만한 오류면 wait, wait*2, ... 초 쉬고 최대 tries 번.
    응답을 돌려주는 함수면 raise_for_status 까지 여기서 해서 5xx 도 재시도한다.
    끝까지 실패하면 마지막 예외를 그대로 던진다 → 호출한 쪽이 FAILED 처리."""
    for i in range(1, tries + 1):
        try:
            out = fn()
            if isinstance(out, requests.Response):
                out.raise_for_status()
            return out
        except Exception as e:
            if i == tries or not _retryable(e):
                raise
            log.warning("재시도 %d/%d (%.0f초 뒤): %s", i, tries - 1, wait, e)
            time.sleep(wait)
            wait *= 2


if __name__ == "__main__":
    calls = []

    def flaky():  # 두 번 끊겼다가 성공
        calls.append(1)
        if len(calls) < 3:
            raise requests.ConnectionError("끊김")
        return "ok"

    assert retry(flaky, wait=0) == "ok" and len(calls) == 3

    def not_found():
        r = requests.Response()
        r.status_code = 404
        calls.append(1)
        return r

    calls.clear()
    try:
        retry(not_found, wait=0)
        raise AssertionError("404 는 예외가 나야 함")
    except requests.HTTPError:
        assert len(calls) == 1, "404 는 다시 해도 같으니 재시도 안 함"
    print("ok")
