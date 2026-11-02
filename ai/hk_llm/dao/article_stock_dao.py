"""article_stock 테이블 쓰기 (25번에서 사용). 종목은 stock_info 에 있어야 저장됨 (FK)"""
from dataclasses import asdict

from sqlalchemy import text

from hk_llm.dao.db import get_engine


class ArticleStockDao:
    def __init__(self, engine=None):
        self.engine = engine or get_engine()

    def insert_all(self, links):
        """links: ArticleStockDto 목록. 같은 (기사, 종목) 이 이미 있으면 새 값으로 바꿈"""
        sql = text("""
            INSERT INTO article_stock (article_id, stock_code, is_main, sentiment, reason,
                                       match_type, relevance, evidence, matched_keywords)
            VALUES (:article_id, :stock_code, :is_main, :sentiment, :reason,
                    :match_type, :relevance, :evidence, :matched_keywords)
            ON DUPLICATE KEY UPDATE is_main = VALUES(is_main), sentiment = VALUES(sentiment),
                reason = VALUES(reason), match_type = VALUES(match_type), relevance = VALUES(relevance),
                evidence = VALUES(evidence), matched_keywords = VALUES(matched_keywords)
        """)
        with self.engine.begin() as conn:
            for link in links:
                conn.execute(sql, asdict(link))
