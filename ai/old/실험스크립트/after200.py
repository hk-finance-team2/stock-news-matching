import json,sys
from collections import Counter
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import load_dictionary, match_one, on_topic, norm
e=get_engine(); d=load_dictionary(e); names=d[0]
with e.connect() as c:
    print("상태",Counter(r[0] for r in c.execute(text("SELECT status FROM article"))))
    info=dict(c.execute(text("SELECT stock_code,stock_name FROM stock_info")).all())
    rows=c.execute(text("SELECT article_id,press,status,title,body,summary,sentiment,keywords,companies,last_error FROM article WHERE summarized_at>='2026-11-03 10:54:00' AND companies IS NOT NULL ORDER BY article_id")).all()
    L={}
    for r in c.execute(text("SELECT article_id,stock_code FROM article_stock")): L.setdefault(r.article_id,set()).add(r.stock_code)
    fail=c.execute(text("SELECT COUNT(*) FROM article WHERE status='FETCHED' AND retry_count>0")).scalar()
print("이번",len(rows),Counter(r.status for r in rows),"재시도",fail)
print("언론사",Counter(r.press for r in rows)); print("기사 감성",Counter(r.sentiment for r in rows))
a=b=0;CS=Counter();M=Counter();miss=Counter();stock=Counter();noco=0;removed=[];side=0;main=0;bad=0
for r in rows:
    cs=json.loads(r.companies); noco+=not cs
    f=match_one(cs,(r.keywords or "").split(","),d,miss); g=on_topic(r.title,r.body,f,names)
    if {x[0] for x in g}!=L.get(r.article_id,set()): bad+=1
    a+=len(f);b+=len(g)
    for x in g:
        CS[x[1]["sentiment"]]+=1; stock[info[x[0]]]+=1
        if x[1]["is_main"]: main+=1
        else: side+=1
    gone=[info[x[0]] for x in f if x not in g]
    if gone: removed.append((r.article_id,r.title[:38],gone[:6],len(gone)))
    if g: print(f"#{r.article_id} {r.press[:3]} {r.title[:42]} → {[info[x[0]]+('*' if x[1]['is_main'] else '')+'/'+x[1]['sentiment'][:3] for x in g][:6]}")
print("규칙 전 연결",a,"후",b,"주인공",main,"조연",side,"감성",CS,"DB 불일치",bad)
print("회사 없음",noco,"요약평균",sum(len(r.summary) for r in rows)//len(rows))
print("자주 연결",stock.most_common(12))
print("--- 제거"); [print(x) for x in removed]
print("--- 없는 이름 수",len(miss),miss.most_common(40))
