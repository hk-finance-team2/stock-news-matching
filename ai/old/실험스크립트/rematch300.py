import json,sys
from collections import Counter
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import match_articles,TYPE_WORDS
e=get_engine()
def snap():
    with e.connect() as c:
        info=dict(c.execute(text("SELECT stock_code,stock_name FROM stock_info")).all())
        L=set((r.article_id,info[r.stock_code]) for r in c.execute(text("SELECT s.article_id,s.stock_code FROM article_stock s JOIN article a ON a.article_id=s.article_id WHERE a.companies IS NOT NULL")))
        S=Counter(r[0] for r in c.execute(text("SELECT status FROM article WHERE companies IS NOT NULL")))
        T={r.article_id:r.title for r in c.execute(text("SELECT article_id,title FROM article WHERE companies IS NOT NULL"))}
    return L,S,T
b,sb,T=snap(); match_articles(e,statuses=("SUMMARIZED","DONE","NO_STOCK")); a,sa,_=snap()
print("상태",dict(sb),"->",dict(sa),"연결",len(b),"->",len(a)); print("추가",sorted(a-b))
g={}
for i,n in b-a: g.setdefault(i,[]).append(n)
for i in sorted(g): print(" 빠짐",i,T[i][:44],g[i][:5],len(g[i]))
with e.connect() as c:
    H=[(r.article_id,r.status,r.title[:50]) for r in c.execute(text("SELECT article_id,status,title FROM article WHERE title LIKE '[부고]%' OR title LIKE '[게시판]%' OR title LIKE '[인사]%' OR title LIKE '[마켓%'"))]
print("말머리 기사 전체",len(H),Counter(x[2][:5] for x in H))
