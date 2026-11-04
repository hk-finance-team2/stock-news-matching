import sys
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
with get_engine().connect() as c:
    print("요약있음",c.execute(text("SELECT COUNT(*) FROM article WHERE companies IS NOT NULL")).scalar(),"FETCHED",c.execute(text("SELECT COUNT(*) FROM article WHERE status='FETCHED'")).scalar(),"SUMMARIZED",c.execute(text("SELECT COUNT(*) FROM article WHERE status='SUMMARIZED'")).scalar(),"최근",c.execute(text("SELECT MAX(summarized_at) FROM article")).scalar(),"재시도중",c.execute(text("SELECT COUNT(*) FROM article WHERE status='FETCHED' AND retry_count>0")).scalar())
