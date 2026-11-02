"""3단계 (18번): 기사 목록을 article 테이블에 LISTED 로 저장

    from hk_llm.step3_save import save_listed
    new = save_listed(articles)  # step2_dedup 을 거친 기사 (url_key 필요). 새로 들어간 건수를 돌려줌

이미 DB 에 있는 기사(url_key 같음)는 건너뛴다 → 30분마다 돌려도 새 기사만 들어감.
"""
from dataclasses import fields

from sqlalchemy import bindparam, text

from hk_llm.db import get_engine, to_db

# rowcount 로는 못 셈: SQLAlchemy 가 PyMySQL 에 FOUND_ROWS 를 켜서 중복도 1 로 나옴
# → 이미 있는 키를 먼저 한 번에 조회. ON DUPLICATE 는 동시 실행 대비 안전장치로 남김
EXISTS = text("SELECT url_key FROM article WHERE url_key IN :keys").bindparams(bindparam("keys", expanding=True))
INSERT = text("""
    INSERT INTO article (url_key, url, press, title, reporter, description, published_at,
                         status, source_type, channel, collect_mode)
    VALUES (:url_key, :url, :press, :title, :reporter, :description, :published_at,
            'LISTED', :source_type, :channel, :collect_mode)
    ON DUPLICATE KEY UPDATE article_id = article_id
""")


def save_listed(articles, engine=None):
    assert all(a.url_key for a in articles), "url_key 없음: step2_dedup 을 먼저 거쳐야 함"
    if not articles:
        return 0
    with (engine or get_engine()).begin() as conn:
        have = set(conn.execute(EXISTS, {"keys": [a.url_key for a in articles]}).scalars())
        new = [a for a in articles if a.url_key not in have]
        for a in new:
            params = {f.name: getattr(a, f.name) for f in fields(a)}
            params["published_at"] = to_db(a.published_at)
            conn.execute(INSERT, params)
    return len(new)


if __name__ == "__main__":
    # DB 가 켜져 있어야 함 (docker compose up -d db). 시험용 1건을 넣었다가 지운다
    from datetime import datetime

    from hk_llm.config import KST
    from hk_llm.models import Article

    key = "test://hk_llm/step3_save_check"
    a = Article(url=key, url_key=key, press="테스트", title="저장 확인",
                published_at=datetime(2026, 11, 2, 9, 0, tzinfo=KST))
    engine = get_engine()
    try:
        assert save_listed([a]) == 1
        assert save_listed([a]) == 0, "같은 url_key 는 두 번 안 들어감"
        with engine.connect() as conn:
            row = conn.execute(text("SELECT status, published_at FROM article WHERE url_key = :k"), {"k": key}).one()
        assert row.status == "LISTED" and row.published_at == to_db(a.published_at), "시각 KST"
    finally:
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM article WHERE url_key = :k"), {"k": key})
    print("ok")
