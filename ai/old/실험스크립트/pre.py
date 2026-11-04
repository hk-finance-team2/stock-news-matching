"""요약 전에 사전 대조로 기사를 걸렀다면: 절약 건수와 잃는 연결. DB 읽기만"""
import json,sys
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import load_dictionary,match_one,on_topic,norm
e=get_engine(); d=load_dictionary(e); names=d[0]
with e.connect() as c:
    rows=c.execute(text("SELECT article_id,title,body,keywords,companies FROM article WHERE companies IS NOT NULL AND body IS NOT NULL")).all()
n3=[k for k in names if len(k)>=3]; n2=[k for k in names if len(k)>=2]
tot=len(rows); linked=[r for r in rows if on_topic(r.title,r.body,match_one(json.loads(r.companies),(r.keywords or "").split(","),d),names)]
L={r.article_id for r in linked}; print("대상",tot,"지금 규칙으로 연결 있음",len(L),"없음",tot-len(L))
for label,ns,scope in (("제목+앞200자, 3자이상",n3,200),("제목+앞200자, 2자이상",n2,200),("제목+앞3000자, 3자이상",n3,3000),("제목+앞3000자, 2자이상",n2,3000)):
    skip=[];lost=[]
    for r in rows:
        t=norm(r.title+" "+r.body[:scope])
        if not any(k in t for k in ns):
            skip.append(r.article_id)
            if r.article_id in L: lost.append((r.article_id,r.title[:40]))
    print(label,"| 요약 건너뜀",len(skip),f"({len(skip)/tot:.0%})","| 연결 있는 기사 잃음",len(lost),lost[:6])
