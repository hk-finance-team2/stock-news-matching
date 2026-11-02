"""로그 공통 모듈. 화면 + logs/hk_llm.log 에 같이 남긴다.

사용:
    from hk_llm.common.logger import get_logger
    log = get_logger(__name__)
    log.info("RSS %d건", n)
"""
import logging
import logging.handlers

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
