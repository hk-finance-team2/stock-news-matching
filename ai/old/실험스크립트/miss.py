import re,sys
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
pat = re.compile("어닝 ?쇼크|(컨센서스|시장 ?전망치?|시장 ?기대치?|예상치|전망치|기대치)[^.]{0,25}(하회|밑돌|못 ?미|미달|부합하지)")
with get_engine().connect() as c:
    rows=c.execute(text("SELECT article_id,status,title,body FROM article WHERE body IS NOT NULL")).all()
    r1724=c.execute(text("SELECT title,status FROM article WHERE article_id=1724")).one()
print("1724:",r1724)
n=0
for r in rows:
    m=pat.search(r.body[:3000])
    if m:
        n+=1
        print(r.article_id,r.status,len(r.body),"|",r.title,"\n   ...",r.body[max(0,m.start()-80):m.end()+30].replace("\n"," "))
print("total",n)
