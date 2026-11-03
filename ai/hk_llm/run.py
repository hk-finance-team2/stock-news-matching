"""파이프라인 1번 실행: 1 RSS → 2 중복 제거 → 3 DB 저장 + 공시 → 4 본문 → 5 요약 → 6 종목 매칭 → 공시 요약 → 7 기사 묶기, 실행 기록은 collect_run 에

    python -m hk_llm.run           (ai 폴더에서, DB 켜져 있어야 함. 5단계에서 OpenAI 비용 발생)
    python -m hk_llm.run --limit 30   요약을 30건까지만 (시험용)
    python -m hk_llm.run --check   1~3단계 시험 (두 번 연속 수집해서 새 기사만 들어가는지, 비용 없음)

5분마다 자동으로 돌리는 건 loop.py. 앞 실행이 안 끝났으면 건너뜀 (GET_LOCK).
"""
from datetime import datetime

from sqlalchemy import text

from hk_llm.core.config import KST
from hk_llm.steps.dart import collect_disclosures, summarize_disclosures
from hk_llm.core.db import get_engine, to_db
from hk_llm.steps.step1_rss import FEEDS, fetch_all
from hk_llm.steps.step2_dedup import dedup_by_url
from hk_llm.steps.step3_save import save_listed
from hk_llm.steps.step4_body import fetch_bodies, purge_old_bodies
from hk_llm.steps.step5_summary import BATCH, summarize_articles
from hk_llm.steps.step6_match import match_articles
from hk_llm.steps.step7_group import save_groups
from hk_llm.steps.step8_daily import summarize_recent
from hk_llm.core.util import get_logger

log = get_logger(__name__)


def collect(engine):
    """1~3단계. (새로 저장한 수, 실패한 피드 목록). RSS 가 전부 실패하면 예외"""
    articles, failed = fetch_all()
    if len(failed) == sum(len(urls) for urls in FEEDS.values()):
        raise RuntimeError("RSS 전부 실패")
    new = save_listed(dedup_by_url(articles), engine)
    log.info("RSS 수집 끝: 받은 %d건, 새로 저장 %d건, 실패 피드 %d개", len(articles), new, len(failed))
    return new, failed


def run(engine=None, limit=BATCH, daily=False):
    """한 번 실행. 다른 실행이 돌고 있으면 건너뛰고 False. daily=True 면 종목별 하루 요약까지"""
    engine = engine or get_engine()
    with engine.connect() as lock:  # 프로세스가 죽어도 DB 연결이 끊기면서 자동으로 풀림
        if not lock.execute(text("SELECT GET_LOCK('hk_llm_run', 0)")).scalar():
            log.warning("앞 실행이 안 끝나서 이번 실행은 건너뜀")
            return False
        try:
            with engine.begin() as conn:  # 잠금을 잡았으니 RUNNING 은 전부 죽은 실행 (안 고치면 화면에 계속 '수집 중')
                conn.execute(text("""UPDATE collect_run SET status = 'FAILED', finished_at = :t, error = '비정상 종료'
                                     WHERE status = 'RUNNING'"""), {"t": to_db(datetime.now(KST))})
            _run(engine, limit, daily)
            return True
        finally:  # 연결이 풀로 돌아가도 잠금은 안 풀리므로 직접 풂
            lock.execute(text("SELECT RELEASE_LOCK('hk_llm_run')"))


def _run(engine, limit, daily):
    """성공하면 collect_run 이 SUCCESS (화면의 '갱신 시각'), 뉴스 단계에서 예외면 FAILED"""
    with engine.begin() as conn:
        run_id = conn.execute(text("INSERT INTO collect_run (started_at, status, channel) VALUES (:t, 'RUNNING', 'RSS')"),
                              {"t": to_db(datetime.now(KST))}).lastrowid
    finish = text("""UPDATE collect_run SET finished_at = :t, status = :status, collected_count = :c,
                     summarized_count = :s, error = :err WHERE run_id = :id""")
    try:
        new, failed = collect(engine)
        errors = ["실패한 피드: " + ", ".join(failed)] if failed else []
        try:  # 공시가 실패해도 뉴스는 계속
            new += collect_disclosures(engine)
        except Exception as e:
            log.error("공시 수집 실패: %s", e)
            errors.append(f"공시 실패: {e}")
        fetch_bodies(engine)
        summarized = summarize_articles(engine, limit)
        match_articles(engine)
        # 뉴스 뒤 단계들: 실패해도 뉴스 갱신 시각을 막지 않음, 다음 실행에서 다시
        after = [("공시 요약", lambda: summarize_disclosures(engine, limit)), ("기사 묶기", lambda: save_groups(engine))]
        if daily:
            after.append(("하루 요약", lambda: summarize_recent(engine)))
        for name, step in after:
            try:
                step()
            except Exception as e:
                log.exception("%s 실패", name)
                errors.append(f"{name} 실패: {type(e).__name__}")
    except Exception as e:
        log.exception("실행 실패")
        with engine.begin() as conn:
            conn.execute(finish, {"t": to_db(datetime.now(KST)), "status": "FAILED", "c": 0, "s": 0,
                                  "err": str(e), "id": run_id})
        raise
    finally:
        purge_old_bodies(engine)  # 실패해도 7일 지난 본문은 반드시 지움
    with engine.begin() as conn:
        conn.execute(finish, {"t": to_db(datetime.now(KST)), "status": "SUCCESS", "c": new, "s": summarized,
                              "err": " / ".join(errors) or None, "id": run_id})


if __name__ == "__main__":
    import sys

    if "--check" not in sys.argv:
        run(limit=int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else BATCH)
        sys.exit()
    engine = get_engine()

    def count():
        with engine.connect() as conn:
            return conn.execute(text("SELECT COUNT(*) FROM article")).scalar()

    first, _ = collect(engine)
    before = count()
    again, _ = collect(engine)  # 바로 다시: 그 몇 초 사이 새 기사만 들어가야 함
    assert count() - before == again, "돌려준 건수 = 실제로 늘어난 줄 수"
    with engine.connect() as conn:
        dup = conn.execute(text("SELECT COUNT(*) - COUNT(DISTINCT url_key) FROM article")).scalar()
    assert dup == 0
    print("ok 1회차", first, "2회차", again)
