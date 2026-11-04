import json,sys
from collections import Counter
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import load_dictionary, match_one, on_topic, norm
start=open(sys.argv[1]).read().strip()
e=get_engine(); d=load_dictionary(e); names=d[0]
with e.connect() as c:
    print("run",dict(c.execute(text("SELECT run_id,status,collected_count,summarized_count,error FROM collect_run ORDER BY run_id DESC LIMIT 1")).mappings().one()))
    print("상태",Counter(r[0] for r in c.execute(text("SELECT status FROM article"))))
    info=dict(c.execute(text("SELECT stock_code,stock_name FROM stock_info")).all())
    rows=c.execute(text("SELECT article_id,press,status,title,body,summary,sentiment,keywords,companies FROM article WHERE summarized_at>=:s ORDER BY article_id"),{"s":start}).all()
    links={}
    for r in c.execute(text("SELECT article_id,stock_code,is_main,sentiment,relevance FROM article_stock")): links.setdefault(r.article_id,[]).append(r)
print("요약 건수",len(rows),Counter(r.status for r in rows),"감성",Counter(r.sentiment for r in rows))
print("언론사",Counter(r.press for r in rows))
tot=[0,0];CS=Counter();miss=Counter()
for r in rows:
    cs=json.loads(r.companies); f=match_one(cs,(r.keywords or "").split(","),d,miss); g=on_topic(r.title,r.body,f,names)
    assert {x[0] for x in g}=={x.stock_code for x in links.get(r.article_id,[])},r.article_id
    tot[0]+=len(f);tot[1]+=len(g)
    for x in g: CS[x[1]["sentiment"]]+=1
    print(f"#{r.article_id} {r.status} {r.title[:44]}\n   연결 {[info[x[0]]+('*' if x[1]['is_main'] else '')+'/'+x[1]['sentiment'][:3] for x in g]} 제거 {[info[x[0]] for x in f if x not in g]} LLM회사 {[c['name'] for c in cs]}")
print("규칙 전 연결",tot[0],"후",tot[1],"연결 감성",CS)
print("사전에 없는 이름",list(miss))
print("요약 평균",sum(len(r.summary) for r in rows)//max(len(rows),1))
