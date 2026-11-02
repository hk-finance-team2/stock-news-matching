"""설정 한곳 모음: 폴더 위치, 시간대, .env 값"""
import os
from datetime import timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"  # Git 제외: 기사·KRX 데이터
LOG_DIR = BASE_DIR / "logs"  # Git 제외

# 한국은 서머타임 없음. ZoneInfo("Asia/Seoul") 은 Windows 에서 tzdata 패키지가 필요해서 고정 +9 사용
KST = timezone(timedelta(hours=9), "KST")

USER_AGENT = "hk-llm-news-bot/0.1 (academy student project)"

load_dotenv(BASE_DIR.parent.parent / ".env")  # 레포 최상위 .env 하나를 팀이 같이 씀


def db_url():
    """팀 Docker MariaDB 접속 주소 (레포 docs/setup.md 8-3)"""
    e = os.environ
    return URL.create(  # 비밀번호에 특수문자가 있어도 안전하게
        "mysql+pymysql",
        username=e["DB_USERNAME"],
        password=e["DB_PASSWORD"],
        host=e.get("DB_HOST", "localhost"),
        port=int(e.get("DB_PORT", "3308")),
        database=e.get("DB_NAME", "stocknews"),
        query={"charset": "utf8mb4"},
    )
