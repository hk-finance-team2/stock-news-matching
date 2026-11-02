"""stock_daily_summary 테이블 쓰기 (32번에서 사용). 종목·날짜마다 한 줄, 다시 만들면 덮어씀"""
from dataclasses import asdict

from sqlalchemy import text

from hk_llm.dao.db import get_engine


class StockDailySummaryDao:
    def __init__(self, engine=None):
        self.engine = engine or get_engine()

    def upsert(self, summary):
        """summary: StockDailySummaryDto"""
        sql = text("""
            INSERT INTO stock_daily_summary (stock_code, summary_date, news_summary, sns_summary,
                                             pos_count, neg_count, neu_count)
            VALUES (:stock_code, :summary_date, :news_summary, :sns_summary, :pos_count, :neg_count, :neu_count)
            ON DUPLICATE KEY UPDATE news_summary = VALUES(news_summary), sns_summary = VALUES(sns_summary),
                pos_count = VALUES(pos_count), neg_count = VALUES(neg_count), neu_count = VALUES(neu_count),
                generated_at = CURRENT_TIMESTAMP
        """)
        with self.engine.begin() as conn:
            conn.execute(sql, asdict(summary))
