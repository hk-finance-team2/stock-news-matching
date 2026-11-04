"""자동 실행 (35번): 5분마다 파이프라인, 1시간마다 SNS 와 종목별 하루 요약. 끌 때까지 돎

    python -m hk_llm.loop     (ai 폴더에서, DB 켜져 있어야 함. 켜 두는 동안 OpenAI 비용 발생, 월 최대 약 $30 추정)
    python -m hk_llm.loop --limit 3   차례마다 뉴스·공시 요약을 3건씩만 (시험용)

- 5분 정각에 맞춰 시작. 실행이 5분을 넘으면 지나간 차례는 건너뜀
- 실행이 실패해도 멈추지 않고 다음 차례에 다시
"""
import sys
import time
from datetime import datetime

from hk_llm.core.config import KST
from hk_llm.core.db import get_engine
from hk_llm.core.util import get_logger
from hk_llm.run import run
from hk_llm.steps.step5_summary import BATCH

INTERVAL = 300  # 초
log = get_logger(__name__)


def wait_seconds(now, interval=INTERVAL):
    """다음 정각 차례까지 남은 초"""
    return interval - now % interval


def main(limit=BATCH):
    engine = get_engine()
    done_hour = None  # 하루 요약을 마지막으로 돌린 시 (시작하자마자 1번 돎)
    log.info("자동 실행 시작")
    while True:
        hour = datetime.now(KST).replace(minute=0, second=0, microsecond=0)
        try:
            if run(engine, limit, daily=hour != done_hour):
                done_hour = hour
        except Exception:  # run 이 collect_run 에 FAILED 를 남김. 하루 요약은 다음 차례에 다시
            log.exception("이번 실행 실패, 다음 차례에 다시")
        time.sleep(wait_seconds(time.time()))


if __name__ == "__main__":
    main(int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else BATCH)
