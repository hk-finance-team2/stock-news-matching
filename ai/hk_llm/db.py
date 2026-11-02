"""DB 연결. 팀 Docker MariaDB (stocknews, 3308)

DB 의 DATETIME 칸에는 시간대가 없다 → 넣을 때는 KST 로 맞춘 뒤 시간대를 떼고,
읽을 때는 KST 를 다시 붙인다. (팀 약속: 시간대 Asia/Seoul)
"""
from functools import lru_cache

from sqlalchemy import create_engine

from hk_llm.config import KST, db_url


@lru_cache(maxsize=None)
def get_engine():
    return create_engine(db_url(), pool_pre_ping=True)  # pre_ping: 오래 쉬다 끊긴 연결 자동 복구


def to_db(dt):
    return dt.astimezone(KST).replace(tzinfo=None) if dt and dt.tzinfo else dt


def from_db(dt):
    return dt.replace(tzinfo=KST) if dt else dt
