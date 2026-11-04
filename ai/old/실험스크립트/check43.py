import json,sys
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import load_dictionary, match_one, on_topic
e=get_engine(); d=load_dictionary(e); names=d[0]
with e.connect() as c:
    rows=c.execute(text("SELECT article_id,title,body,keywords,companies,status FROM article WHERE companies IS NOT NULL")).all()
    db={}
    for r in c.execute(text("SELECT article_id,stock_code FROM article_stock")): db.setdefault(r.article_id,set()).add(r.stock_code)
a=b=da=db_=0; stale=[]
for r in rows:
    f=match_one(json.loads(r.companies),(r.keywords or "").split(","),d); g=on_topic(r.title,r.body,f,names)
    a+=len(f);b+=len(g);da+=bool(f);db_+=bool(g)
    if {x[0] for x in g}!=db.get(r.article_id,set()): stale.append(r.article_id)
    if r.article_id==43: print("43번 규칙 전",len(f),"후",len(g))
print("요약된 전체",len(rows),"연결",a,"->",b,"DONE",da,"->",db_)
print("DB 와 규칙 결과가 다른 기사(다시 매칭 안 한 것)",stale)
