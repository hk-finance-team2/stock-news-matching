import sys
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
W=["주간","시황","증시 전망","증시전망","산업생산","생산지표","CPI","소비자물가","고용지표"]
with get_engine().connect() as c:
    t=c.execute(text("SELECT article_id,title,body IS NULL n FROM article WHERE source_type<>'DART' OR source_type IS NULL")).all()
    print("총",len(t),"본문없음",sum(r.n for r in t))
for w in W:
    h=[r for r in t if w in r.title]
    print(f"[{w}] {len(h)}")
    for r in h[:14]: print("  ",r.article_id,r.title[:60])
