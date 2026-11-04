import json,sys
from collections import Counter
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import load_dictionary, match_one, on_topic, norm
e=get_engine(); d=load_dictionary(e); names=d[0]
with e.connect() as c:
    info=dict(c.execute(text("SELECT stock_code,stock_name FROM stock_info")).all())
    rows=c.execute(text("SELECT article_id,title,body,keywords,companies FROM article WHERE companies IS NOT NULL")).all()
    print("상태",Counter(r[0] for r in c.execute(text("SELECT status FROM article"))))
a=b=da=db=0;U=Counter()
for r in rows:
    f=match_one(json.loads(r.companies),(r.keywords or "").split(","),d); g=on_topic(r.title,r.body,f,names)
    u=len({x for n,x in names.items() if len(n)>=3 and n in norm(r.body or "")}); U[u]+=1
    a+=len(f);b+=len(g);da+=bool(f);db+=bool(g)
    if len(f)!=len(g) or u>5: print(r.article_id,"스캔",u,r.title[:36],"제거",[info[x[0]] for x in f if x not in g])
print("연결",a,"->",b,"DONE",da,"->",db,"스캔분포",sorted(U.items()))
