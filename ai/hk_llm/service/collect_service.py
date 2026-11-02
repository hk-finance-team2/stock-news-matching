"""RSS 수집 1번 실행 (18번): RSS 목록 → 주소 중복 제거 → article 에 LISTED 저장 → collect_run 기록

    python -m hk_llm.service.collect_service   (ai 폴더에서, DB 켜져 있어야 함)

이미 DB 에 있는 기사는 article.url_key UNIQUE 로 건너뛴다 → 30분마다 돌려도 새 기사만 들어감.
"""
from hk_llm.collector.rss_collector import FEEDS, fetch_all
from hk_llm.common.logger import get_logger
from hk_llm.dao.article_dao import ArticleDao
from hk_llm.dao.collect_run_dao import CollectRunDao
from hk_llm.service.dedup_service import dedup_by_url

log = get_logger(__name__)


def collect_rss(article_dao=None, run_dao=None):
    """새로 저장한 기사 수를 돌려준다. 피드 일부만 실패하면 SUCCESS + error 에 실패 피드, 전부 실패하면 FAILED"""
    article_dao = article_dao or ArticleDao()
    run_dao = run_dao or CollectRunDao()
    run_id = run_dao.start("RSS")
    try:
        articles, failed = fetch_all()
        total = sum(len(urls) for urls in FEEDS.values())
        if len(failed) == total:
            raise RuntimeError("RSS 전부 실패")
        new = article_dao.insert_listed(dedup_by_url(articles))
    except Exception as e:
        log.exception("수집 실패")
        run_dao.finish(run_id, "FAILED", error=str(e))
        raise
    error = "실패한 피드: " + ", ".join(failed) if failed else None
    run_dao.finish(run_id, "SUCCESS", collected_count=new, error=error)
    log.info("RSS 수집 끝: 받은 %d건, 새로 저장 %d건, 실패 피드 %d개", len(articles), new, len(failed))
    return new


if __name__ == "__main__":
    from sqlalchemy import text

    first = collect_rss()
    again = collect_rss()
    assert again <= first, "두 번째 실행은 새 기사만 들어가야 함"
    with ArticleDao().engine.connect() as conn:
        dup = conn.execute(text("SELECT COUNT(*) - COUNT(DISTINCT url_key) FROM article")).scalar()
        last = conn.execute(text("SELECT status, collected_count FROM collect_run ORDER BY run_id DESC LIMIT 1")).first()
    assert dup == 0 and last.status == "SUCCESS" and last.collected_count == again
    print("ok 1회차", first, "2회차", again)
