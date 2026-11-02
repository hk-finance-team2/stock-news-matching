"""article_stock 테이블 한 줄 = 기사 1건 × 종목 1개 (V5)"""
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal


@dataclass
class ArticleStockDto:
    article_id: int
    stock_code: str  # 6자리 문자열. stock_info 에 있어야 저장됨 (FK)
    sentiment: str  # 종목별: POSITIVE, NEGATIVE, NEUTRAL
    reason: str  # 판단 이유
    is_main: bool = False  # 대표 종목 여부
    created_at: datetime | None = None  # DB 기본값
    # [확장] 매칭 방식(23번)에서 채움
    match_type: str | None = None  # DIRECT 회사명 등장, INDIRECT 이슈 영향
    relevance: Decimal | None = None  # 관련도 0.00~1.00
    evidence: str | None = None  # 근거 문장
    matched_keywords: str | None = None  # 쉼표 구분
