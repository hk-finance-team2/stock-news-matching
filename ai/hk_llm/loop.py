"""자동 실행 (35번): 5분마다 파이프라인, 1시간마다 종목별 하루 요약 (SNS 는 스위치를 켰을 때만). 끌 때까지 돎

    python -m hk_llm.loop     (ai 폴더에서, DB 켜져 있어야 함. 켜 두는 동안 OpenAI 비용 발생, 월 최대 약 $30 추정)
    python -m hk_llm.loop --limit 3   차례마다 뉴스·공시 요약을 3건씩만 (시험용)

- 5분 정각에 맞춰 시작. 실행이 5분을 넘으면 지나간 차례는 건너뜀
- 실행이 실패해도 멈추지 않고 다음 차례에 다시
- 시작할 때 DB 가 받을 때까지 최대 2분 기다림: Docker 를 다시 켜면 재시작 정책은 depends_on 을 안 지켜서 수집기가 DB 보다 먼저 뜸
  → 기다리지 않으면 첫 차례가 실패하고 5분 뒤에야 수집 (2026-11-12 시연 점검에서 발견)
- SNS(네이버 블로그·카페): 1차에서 뺌 (2026-11-09). 측정해 보니 카페는 작성 날짜가 오지 않고 거르면 3% 만 남았고,
  블로그는 42% 가 같은 소식을 뉴스보다 8시간 늦게 다시 쓴 글이라 뉴스에 더하는 정보가 작았음. 댓글·커뮤니티는 robots.txt 가 막음
  → SNS_ENABLED=true 일 때만 1시간마다 따로 돎(오래 걸려도 뉴스 수집을 막지 않음). 이미 모은 SNS 글은 run.py 가 7일 뒤 지움
"""
import os
import sys
import threading
import time
from datetime import datetime, timedelta

from sqlalchemy import text

from hk_llm.core.config import KST
from hk_llm.core.db import get_engine
from hk_llm.core.util import get_logger
from hk_llm.run import run
from hk_llm.steps.sns import TOP, run_locked
from hk_llm.steps.step5_summary import BATCH

INTERVAL = 300  # 초
EARLY_WAKE = 5  # 초. 정각 차례가 이만큼 일찍 시작해도 그 시의 차례로 봄
DB_WAIT = 120  # 초. 시작할 때 DB 를 기다리는 최대 시간 (MariaDB 가 켜지는 데 보통 10~30초)
DB_RETRY = 3  # 초. 그동안 다시 확인하는 간격
log = get_logger(__name__)


def wait_seconds(now, interval=INTERVAL):
    """다음 정각 차례까지 남은 초"""
    return interval - now % interval


def run_hour(now):
    """이번 차례가 몇 시 차례인가. 몇 밀리초 일찍 깨면(11:59:59.99) 아직 11시로 쳐서 1시간 작업이 5분 밀려서 여유를 둠"""
    return (now + timedelta(seconds=EARLY_WAKE)).replace(minute=0, second=0, microsecond=0)


def wait_for_db(engine, limit=DB_WAIT, every=DB_RETRY):
    """DB 가 SELECT 1 에 답할 때까지 기다림. 되면 True, limit 초가 지나면 False (그래도 루프는 시작 → 차례마다 다시 시도)"""
    waited = 0
    while True:
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            if waited:
                log.info("DB 연결됨 (%d초 기다림)", waited)
            return True
        except Exception as e:
            if waited >= limit:
                log.warning("DB 를 %d초 기다렸지만 연결 안 됨, 그대로 시작: %s", waited, e)
                return False
            if not waited:
                log.info("DB 가 아직 준비 안 됨, 최대 %d초 기다림", limit)
            time.sleep(every)
            waited += every


def sns_enabled():
    """SNS 수집을 켤지. 기본 꺼짐 (1차 제외, 2026-11-09)"""
    return os.environ.get("SNS_ENABLED", "false").strip().lower() == "true"


def main(limit=BATCH):
    engine = get_engine()
    done_hour = None  # 하루 요약을 마지막으로 돌린 시 (시작하자마자 1번 돎)
    sns_hour = None
    sns_on = sns_enabled()
    log.info("자동 실행 시작 (SNS %s)", "켜짐" if sns_on else "꺼짐")
    wait_for_db(engine)
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
