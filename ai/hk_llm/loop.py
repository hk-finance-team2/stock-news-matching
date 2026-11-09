"""자동 실행 (35번): 5분마다 파이프라인, 1시간마다 종목별 하루 요약 (SNS 는 스위치를 켰을 때만). 끌 때까지 돎

    python -m hk_llm.loop     (ai 폴더에서, DB 켜져 있어야 함. 켜 두는 동안 OpenAI 비용 발생, 월 최대 약 $30 추정)
    python -m hk_llm.loop --limit 3   차례마다 뉴스·공시 요약을 3건씩만 (시험용)

- 5분 정각에 맞춰 시작. 실행이 5분을 넘으면 지나간 차례는 건너뜀
- 실행이 실패해도 멈추지 않고 다음 차례에 다시
- SNS(네이버 블로그·카페): 1차에서 뺌 (2026-11-09). 측정해 보니 카페는 작성 날짜가 오지 않고 거르면 3% 만 남았고,
  블로그는 42% 가 같은 소식을 뉴스보다 8시간 늦게 다시 쓴 글이라 뉴스에 더하는 정보가 작았음. 댓글·커뮤니티는 robots.txt 가 막음
  → SNS_ENABLED=true 일 때만 1시간마다 따로 돎(오래 걸려도 뉴스 수집을 막지 않음). 이미 모은 SNS 글은 run.py 가 7일 뒤 지움
"""
import os
import sys
import threading
import time
from datetime import datetime, timedelta

from hk_llm.core.config import KST
from hk_llm.core.db import get_engine
from hk_llm.core.util import get_logger
from hk_llm.run import run
from hk_llm.steps.sns import TOP, run_locked
from hk_llm.steps.step5_summary import BATCH

INTERVAL = 300  # 초
EARLY_WAKE = 5  # 초. 정각 차례가 이만큼 일찍 시작해도 그 시의 차례로 봄
log = get_logger(__name__)


def wait_seconds(now, interval=INTERVAL):
    """다음 정각 차례까지 남은 초"""
    return interval - now % interval


def run_hour(now):
    """이번 차례가 몇 시 차례인가. 몇 밀리초 일찍 깨면(11:59:59.99) 아직 11시로 쳐서 1시간 작업이 5분 밀려서 여유를 둠"""
    return (now + timedelta(seconds=EARLY_WAKE)).replace(minute=0, second=0, microsecond=0)


def sns_enabled():
    """SNS 수집을 켤지. 기본 꺼짐 (1차 제외, 2026-11-09)"""
    return os.environ.get("SNS_ENABLED", "false").strip().lower() == "true"


def main(limit=BATCH):
    engine = get_engine()
    done_hour = None  # 하루 요약을 마지막으로 돌린 시 (시작하자마자 1번 돎)
    sns_hour = None
    sns_on = sns_enabled()
    log.info("자동 실행 시작 (SNS %s)", "켜짐" if sns_on else "꺼짐")
    while True:
        hour = run_hour(datetime.now(KST))
        if sns_on and hour != sns_hour:
            sns_hour = hour
            threading.Thread(target=run_locked, args=(engine, min(limit, TOP)), daemon=True).start()
        try:
            if run(engine, limit, daily=hour != done_hour):
                done_hour = hour
        except Exception:  # run 이 collect_run 에 FAILED 를 남김. 하루 요약은 다음 차례에 다시
            log.exception("이번 실행 실패, 다음 차례에 다시")
        time.sleep(wait_seconds(time.time()))


if __name__ == "__main__":
    main(int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else BATCH)
