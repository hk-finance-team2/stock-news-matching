"""collect_run 테이블 읽기·쓰기. 실행 1번 = 1줄"""
from datetime import datetime

from sqlalchemy import text

from hk_llm.config import KST
from hk_llm.dao.db import get_engine, to_db


class CollectRunDao:
    def __init__(self, engine=None):
        self.engine = engine or get_engine()

    def start(self, channel="RSS"):
        """RUNNING 으로 한 줄 만들고 run_id 를 돌려준다"""
        sql = text("INSERT INTO collect_run (started_at, status, channel) VALUES (:t, 'RUNNING', :ch)")
        with self.engine.begin() as conn:
            return conn.execute(sql, {"t": to_db(datetime.now(KST)), "ch": channel}).lastrowid

    def finish(self, run_id, status, collected_count=0, summarized_count=0, error=None):
        """status: SUCCESS 또는 FAILED"""
        sql = text("""
            UPDATE collect_run
            SET finished_at = :t, status = :status, collected_count = :c, summarized_count = :s, error = :err
            WHERE run_id = :id
        """)
        with self.engine.begin() as conn:
            conn.execute(sql, {"t": to_db(datetime.now(KST)), "status": status, "c": collected_count,
                               "s": summarized_count, "err": error, "id": run_id})
