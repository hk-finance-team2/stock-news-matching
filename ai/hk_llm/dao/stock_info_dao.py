"""stock_info 테이블 읽기 (종목 사전, 백엔드가 채움)"""
from sqlalchemy import text

from hk_llm.dao.db import get_engine
from hk_llm.dto.stock_info_dto import StockInfoDto


class StockInfoDao:
    def __init__(self, engine=None):
        self.engine = engine or get_engine()

    def find_all(self):
        sql = text("SELECT stock_code, stock_name, market, sector FROM stock_info ORDER BY stock_code")
        with self.engine.connect() as conn:
            return [StockInfoDto(**r._mapping) for r in conn.execute(sql)]
