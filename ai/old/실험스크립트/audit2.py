import json,re,sys
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import norm
with get_engine().connect() as c:
    rows=c.execute(text("SELECT article_id,title,body,summary,keywords,companies,summarized_at FROM article WHERE companies IS NOT NULL")).all()
    print("녹십자",c.execute(text("SELECT stock_code,stock_name FROM stock_info WHERE stock_name LIKE '%녹십자%'")).all(),c.execute(text("SELECT alias,alias_type FROM stock_alias WHERE alias LIKE '%녹십자%'")).all())
    print("삼성증권",c.execute(text("SELECT stock_code FROM stock_info WHERE stock_name='삼성증권'")).all())
new=[r for r in rows if str(r.summarized_at)>="2026-11-03 10:40"]
old=[r for r in rows if str(r.summarized_at)<"2026-11-03 10:40"]
for nm,g in (("새 프롬프트(오늘 10:40 이후)",new),("이전",old)):
    kw=[k for r in g for k in (r.keywords or "").split(",")]; rs=[x["reason"] for r in g for x in json.loads(r.companies)]; s=[x["sentiment"] for r in g for x in json.loads(r.companies)]
    print(nm,len(g),"키워드 숫자",sum(bool(re.search(r"\d",k)) for k in kw),"/",len(kw),"이유초과",sum(len(x)>40 for x in rs),"/",len(rs),"회사감성 POS",s.count("POSITIVE"),"NEG",s.count("NEGATIVE"),"NEU",s.count("NEUTRAL"))
for i,nums in ((222,["11"]),(223,["1.5","1,000"]),(230,["1,634"]),(260,["6000"])):
    r=next(x for x in rows if x.article_id==i); cs=json.loads(r.companies)
    print("--",i,r.title[:45]); print(" 요약:",r.summary[:170]); print(" 이유:",[x["reason"] for x in cs if any(n in x["reason"] for n in nums)][:2])
    for n in nums:
        m=re.search(re.escape(n.replace(",","")[:2]),r.body.replace(",",""))
        print(" 본문 근처",n,":",r.body.replace(",","")[max(0,m.start()-30):m.end()+30].replace("\n"," ") if m else "없음")
