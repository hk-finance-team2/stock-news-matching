"""파이프라인 1번 실행: 1 RSS 받기 → 2 중복 제거 → 3 DB 저장 → 4 본문, 실행 기록은 collect_run 에

    python -m hk_llm.run           (ai 폴더에서, DB 켜져 있어야 함)
    python -m hk_llm.run --check   1~3단계 시험 (두 번 연속 수집해서 새 기사만 들어가는지)

뒷단계(본문·요약·매칭)가 생기면 여기에 이어 붙인다. 30분마다 이 파일을 돌리는 게 35번 스케줄러.
"""
from datetime import datetime

from sqlalchemy import text

from hk_llm.config import KST
from hk_llm.db import get_engine, to_db
from hk_llm.step1_rss import FEEDS, fetch_all
from hk_llm.step2_dedup import dedup_by_url
from hk_llm.step3_save import save_listed
from hk_llm.step4_body import fetch_bodies, purge_old_bodies
from hk_llm.util import get_logger

log = get_logger(__name__)


def _run_start(conn):
    sql = text("INSERT INTO collect_run (started_at, status, channel) VALUES (:t, 'RUNNING', 'RSS')")
    return conn.execute(sql, {"t": to_db(datetime.now(KST))}).lastrowid


def _run_finish(conn, run_id, status, collected=0, error=None):
    sql = text("""UPDATE collect_run SET finished_at = :t, status = :status, collected_count = :c, error = :err
                  WHERE run_id = :id""")
    conn.execute(sql, {"t": to_db(datetime.now(KST)), "status": status, "c": collected, "err": error, "id": run_id})


def collect_rss(engine=None):
    """새로 저장한 기사 수를 돌려준다. 피드 일부만 실패하면 SUCCESS + error 에 실패 피드, 전부 실패하면 FAILED"""
    engine = engine or get_engine()
    with engine.begin() as conn:
        run_id = _run_start(conn)
    try:
        articles, failed = fetch_all()
        if len(failed) == sum(len(urls) for urls in FEEDS.values()):
            raise RuntimeError("RSS 전부 실패")
        new = save_listed(dedup_by_url(articles), engine)
    except Exception as e:
        log.exception("수집 실패")
        with engine.begin() as conn:
            _run_finish(conn, run_id, "FAILED", error=str(e))
        raise
    with engine.begin() as conn:
        _run_finish(conn, run_id, "SUCCESS", new, "실패한 피드: " + ", ".join(failed) if failed else None)
    log.info("RSS 수집 끝: 받은 %d건, 새로 저장 %d건, 실패 피드 %d개", len(articles), new, len(failed))
    return new


def run():
    try:
        collect_rss()
        fetch_bodies()
    finally:
        purge_old_bodies()  # 수집이 실패해도 7일 지난 본문은 반드시 지움


if __name__ == "__main__":
    import sys

    if "--check" not in sys.argv:
        run()
        sys.exit()
    engine = get_engine()

    def count():
        with engine.connect() as conn:
            return conn.execute(text("SELECT COUNT(*) FROM article")).scalar()

    first = collect_rss()
    before = count()
    again = collect_rss()  # 바로 다시: 그 몇 초 사이 새 기사만 들어가야 함
    assert count() - before == again, "돌려준 건수 = 실제로 늘어난 줄 수"
    with engine.connect() as conn:
        dup = conn.execute(text("SELECT COUNT(*) - COUNT(DISTINCT url_key) FROM article")).scalar()
        last = conn.execute(text("SELECT status, collected_count FROM collect_run ORDER BY run_id DESC LIMIT 1")).first()
    assert dup == 0 and last.status == "SUCCESS" and last.collected_count == again
    print("ok 1회차", first, "2회차", again)
