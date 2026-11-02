"""데이터 모양. article 테이블 한 줄 = 기사 1건 + LLM 요약 (V5)"""
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Article:
    url: str  # 원래 주소. 화면의 원문 링크
    press: str  # 언론사 이름 (모르는 곳은 도메인)
    title: str
    published_at: datetime  # 발행 시각 KST (없으면 수집 시각)
    reporter: str | None = None
    description: str | None = None  # RSS 짧은 요약문
    url_key: str | None = None  # 추적용 꼬리 뗀 주소, 중복 판단용 (step2_dedup 이 채움)
    body: str | None = None  # 정제 본문. 7일 후 NULL
    article_id: int | None = None  # DB 가 붙여줌
    collected_at: datetime | None = None  # DB 기본값: 저장 시각
    status: str = "LISTED"  # LISTED → FETCHED → SUMMARIZED → DONE / FAILED, SKIPPED, NO_STOCK
    retry_count: int = 0
    last_error: str | None = None
    summary: str | None = None  # LLM 요약. 계속 보관
    model: str | None = None  # 요약한 모델 (AI 생성 표시용)
    summarized_at: datetime | None = None
    # [확장]
    source_type: str = "NEWS"  # NEWS, SNS
    channel: str = "RSS"  # RSS, NAVER_NEWS, NAVER_BLOG, NAVER_CAFE
    collect_mode: str = "REALTIME"  # REALTIME, BACKFILL
    keywords: str | None = None  # 쉼표 구분
    sentiment: str | None = None  # 글 전체: POSITIVE, NEGATIVE, NEUTRAL
