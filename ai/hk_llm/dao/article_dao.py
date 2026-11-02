"""article 테이블 읽기·쓰기"""
from dataclasses import fields

from sqlalchemy import text

from hk_llm.dao.db import from_db, get_engine, to_db
from hk_llm.dto.article_dto import ArticleDto

_DATETIME = ("published_at", "collected_at", "summarized_at")


def _to_dto(row):
    d = dict(row._mapping)
    for k in _DATETIME:
        d[k] = from_db(d[k])
    return ArticleDto(**{f.name: d[f.name] for f in fields(ArticleDto)})


class ArticleDao:
    def __init__(self, engine=None):
        self.engine = engine or get_engine()

    def insert_listed(self, articles):
        """새 기사를 LISTED 로 저장. url_key 가 이미 있으면 건너뜀. 새로 들어간 건수를 돌려준다."""
        # 중복이면 아무것도 안 바꿈 → rowcount 0
        sql = text("""
            INSERT INTO article (url_key, url, press, title, reporter, description, published_at,
                                 status, source_type, channel, collect_mode)
            VALUES (:url_key, :url, :press, :title, :reporter, :description, :published_at,
                    'LISTED', :source_type, :channel, :collect_mode)
            ON DUPLICATE KEY UPDATE article_id = article_id
        """)
        new = 0
        with self.engine.begin() as conn:
            for a in articles:
                assert a.url_key, "url_key 없음: service/dedup_service.py 를 먼저 거쳐야 함"
                params = {f.name: getattr(a, f.name) for f in fields(a)}
                params["published_at"] = to_db(a.published_at)
                new += conn.execute(sql, params).rowcount
        return new

    def find_by_status(self, status, limit=100):
        sql = text("SELECT * FROM article WHERE status = :status ORDER BY published_at LIMIT :limit")
        with self.engine.connect() as conn:
            return [_to_dto(r) for r in conn.execute(sql, {"status": status, "limit": limit})]

    def find_by_url_key(self, url_key):
        with self.engine.connect() as conn:
            row = conn.execute(text("SELECT * FROM article WHERE url_key = :k"), {"k": url_key}).first()
        return _to_dto(row) if row else None

    def update_status(self, article_id, status, last_error=None):
        sql = text("UPDATE article SET status = :status, last_error = :err WHERE article_id = :id")
        with self.engine.begin() as conn:
            conn.execute(sql, {"status": status, "err": last_error and last_error[:1000], "id": article_id})


if __name__ == "__main__":
    # DB 가 켜져 있어야 함 (docker compose up -d db). 시험용 1건을 넣었다가 지운다
    from datetime import datetime

    from hk_llm.config import KST

    dao = ArticleDao()
    key = "test://hk_llm/article_dao_check"
    a = ArticleDto(url=key, url_key=key, press="테스트", title="DAO 확인",
                   published_at=datetime(2026, 11, 2, 9, 0, tzinfo=KST))
    try:
        assert dao.insert_listed([a]) == 1
        assert dao.insert_listed([a]) == 0, "같은 url_key 는 두 번 안 들어감"
        got = dao.find_by_url_key(key)
        assert got.status == "LISTED" and got.published_at == a.published_at
        dao.update_status(got.article_id, "FAILED", "시험")
        assert dao.find_by_url_key(key).status == "FAILED"
    finally:
        with dao.engine.begin() as conn:
            conn.execute(text("DELETE FROM article WHERE url_key = :k"), {"k": key})
    print("ok")
