import json,sys
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
out=sys.argv[1]
with get_engine().connect() as c:
    rows=c.execute(text("""SELECT a.article_id,a.status,s.stock_code,i.stock_name,s.is_main,s.relevance,s.sentiment
       FROM article a LEFT JOIN article_stock s ON s.article_id=a.article_id LEFT JOIN stock_info i ON i.stock_code=s.stock_code
       WHERE a.companies IS NOT NULL ORDER BY 1,3""")).mappings().all()
json.dump([{k:(float(v) if k=="relevance" and v is not None else v) for k,v in r.items()} for r in rows],open(out,"w",encoding="utf-8"),ensure_ascii=False,indent=0)
print("snapshot rows",len(rows))
