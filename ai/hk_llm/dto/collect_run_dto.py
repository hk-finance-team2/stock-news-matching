"""collect_run 테이블 한 줄 = 수집·요약 실행 1번 (V5). 화면의 "마지막 갱신 시각" """
from dataclasses import dataclass
from datetime import datetime


@dataclass
class CollectRunDto:
    started_at: datetime
    run_id: int | None = None  # DB 가 붙여줌
    finished_at: datetime | None = None  # 실행 중이면 None
    status: str = "RUNNING"  # RUNNING, SUCCESS, FAILED
    collected_count: int = 0  # 새로 받은 기사 수
    summarized_count: int = 0  # 요약한 기사 수
    error: str | None = None
    channel: str | None = None  # [확장] RSS, NAVER_NEWS 등
