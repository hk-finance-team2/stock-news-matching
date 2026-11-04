import sys
from collections import Counter
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import load_dictionary, norm
e=get_engine(); names=load_dictionary(e)[0]
ns=[(n,c) for n,c in names.items() if len(n)>=3]
with e.connect() as c:
    rows=c.execute(text("SELECT article_id,press,status,title,body FROM article WHERE body IS NOT NULL")).all()
    print("FETCHED 언론사",Counter(r[0] for r in c.execute(text("SELECT press FROM article WHERE status='FETCHED' AND body IS NOT NULL"))))
R=[]
for r in rows:
    w=norm(r.body); h=norm(r.title); u={c for n,c in ns if n in w}; t={c for n,c in ns if n in h}
    R.append((len(u),len(t),r.article_id,r.press,r.title[:58]))
R.sort(reverse=True)
print("본문",len(R),"구간",[(a,sum(lo<=x[0]<=hi for x in R)) for a,lo,hi in [("0-5",0,5),("6-9",6,9),("10-14",10,14),("15-19",15,19),("20-29",20,29),("30+",30,9999)]])
for x in R:
    if x[0]>=8: print(x)
print("43번",[x for x in R if x[2]==43])
