"""언론사별 5건 요약·저장 후 매칭. 수집 안 함"""
import json,random,sys
from collections import Counter
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step5_summary import summarize,_save,MODEL
from hk_llm.steps.step6_match import match_articles,load_dictionary,match_one,on_topic
e=get_engine(); random.seed(20261103); ids=[]
with e.connect() as c:
    pr=[r[0] for r in c.execute(text("SELECT DISTINCT press FROM article WHERE status='FETCHED' AND body IS NOT NULL")) if r[0]!="한국경제"]
    for p in sorted(pr):
        l=[r[0] for r in c.execute(text("SELECT article_id FROM article WHERE status='FETCHED' AND body IS NOT NULL AND press=:p ORDER BY article_id DESC LIMIT 60"),{"p":p})]
        pick=random.sample(l,min(5,len(l))); print(p,len(l),pick); ids+=pick
    rows=c.execute(text("SELECT article_id,title,body FROM article WHERE article_id IN (%s)"%",".join(map(str,ids)))).all()
ti=to=0;bad=[]
for r in rows:
    try:
        s,u=summarize(r.title,r.body); _save(e,r.article_id,s,MODEL); ti+=u["input_tokens"];to+=u["output_tokens"]
    except Exception as x: bad.append((r.article_id,type(x).__name__,str(x)[:120]))
print("요약 성공",len(rows)-len(bad),"실패",bad,f"토큰 {ti}/{to} 비용 ${ti*.2/1e6+to*1.25/1e6:.4f}")
match_articles(e)
d=load_dictionary(e);names=d[0]
with e.connect() as c:
    info=dict(c.execute(text("SELECT stock_code,stock_name FROM stock_info")).all())
    rows=c.execute(text("SELECT article_id,press,status,title,body,summary,sentiment,keywords,companies FROM article WHERE article_id IN (%s) ORDER BY press,article_id"%",".join(map(str,ids)))).all()
    L={}
    for r in c.execute(text("SELECT article_id,stock_code FROM article_stock")): L.setdefault(r.article_id,set()).add(r.stock_code)
print("상태",Counter(r.status for r in rows),"기사 감성",Counter(r.sentiment for r in rows))
a=b=0;CS=Counter();miss=Counter()
for r in rows:
    if not r.companies: print(f"#{r.article_id} [{r.press}] {r.status} 회사 없음 {r.title[:50]}"); continue
    cs=json.loads(r.companies); f=match_one(cs,(r.keywords or "").split(","),d,miss); g=on_topic(r.title,r.body,f,names)
    assert {x[0] for x in g}==L.get(r.article_id,set()),r.article_id
    a+=len(f);b+=len(g)
    for x in g: CS[x[1]["sentiment"]]+=1
    print(f"#{r.article_id} [{r.press}] {r.status} {r.title[:46]}\n   연결 {[info[x[0]]+('*' if x[1]['is_main'] else '')+'/'+x[1]['sentiment'][:3] for x in g]} 제거 {[info[x[0]] for x in f if x not in g]} LLM {[c['name'] for c in cs][:8]}")
print("규칙 전 연결",a,"후",b,"감성",CS,"요약평균",sum(len(r.summary or '') for r in rows)//len(rows))
print("없는 이름",list(miss))
