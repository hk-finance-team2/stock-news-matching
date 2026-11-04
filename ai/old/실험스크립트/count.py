import sys
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
with get_engine().connect() as c:
    print("전체",c.execute(text("SELECT COUNT(*) FROM article")).scalar())
    for r in c.execute(text("SELECT status,COUNT(*) n,SUM(body IS NOT NULL) b,SUM(companies IS NOT NULL) s FROM article GROUP BY status ORDER BY n DESC")): print(r.status,r.n,"본문있음",r.b,"요약있음",r.s)
    print("공시",c.execute(text("SELECT source_type,COUNT(*) FROM article GROUP BY source_type")).all())
    print("연결",c.execute(text("SELECT COUNT(*) FROM article_stock")).scalar())
    print("FETCHED 언론사",c.execute(text("SELECT press,COUNT(*) FROM article WHERE status='FETCHED' GROUP BY press ORDER BY 2 DESC")).all())
