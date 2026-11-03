"""새로 받은 기사 한 건의 모양. 1단계가 만들고 2단계가 url_key 를 채우고 3단계가 article 테이블에 넣는다"""
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
    source_type: str = "NEWS"  # NEWS, SNS
    channel: str = "RSS"  # RSS, NAVER_NEWS, NAVER_BLOG, NAVER_CAFE
    collect_mode: str = "REALTIME"  # REALTIME, BACKFILL
