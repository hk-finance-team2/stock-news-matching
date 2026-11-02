"""stock_info 테이블 한 줄 = 종목 사전 (V1). 백엔드가 채우고 AI 는 읽기만"""
from dataclasses import dataclass


@dataclass
class StockInfoDto:
    stock_code: str  # 6자리 문자열 (앞자리 0 보존)
    stock_name: str
    market: str  # KOSPI, KOSDAQ
    sector: str | None = None
