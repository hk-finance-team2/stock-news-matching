"""stock_daily_summary 테이블 한 줄 = 종목 1개의 하루 종합 요약 (V5, 32번에서 채움)"""
from dataclasses import dataclass
from datetime import date, datetime


@dataclass
class StockDailySummaryDto:
    stock_code: str
    summary_date: date
    news_summary: str | None = None
    sns_summary: str | None = None
    pos_count: int = 0
    neg_count: int = 0
    neu_count: int = 0
    summary_id: int | None = None  # DB 가 붙여줌
    generated_at: datetime | None = None  # DB 기본값
