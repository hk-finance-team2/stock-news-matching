import json,re,sys
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import match_articles
e=get_engine()
def snap():
    with e.connect() as c:
        return set(tuple(r) for r in c.execute(text("SELECT s.article_id,i.stock_name FROM article_stock s JOIN stock_info i ON i.stock_code=s.stock_code JOIN article a ON a.article_id=s.article_id WHERE a.companies IS NOT NULL")))
b=snap(); match_articles(e,statuses=("SUMMARIZED","DONE","NO_STOCK")); a=snap()
print("연결",len(b),"->",len(a),"추가",sorted(a-b),"빠짐",sorted(b-a))
with e.connect() as c:
    print("상태",c.execute(text("SELECT status,COUNT(*) FROM article WHERE companies IS NOT NULL GROUP BY status")).all())
    rows=c.execute(text("SELECT article_id,title,body,summary,companies FROM article WHERE companies IS NOT NULL")).all()
    gb=c.execute(text("SELECT article_id,title,status FROM article WHERE title LIKE '[게시판]%' AND companies IS NOT NULL")).all()
print("요약된 게시판 기사",[(r.article_id,r.status,r.title[:30]) for r in gb])
num=re.compile(r"\d[\d,.]*\d|\d"); n=lambda s:s.replace(",","")
for r in rows:
    src=n(r.title+" "+r.body)
    for t in [r.summary]+[c["reason"] for c in json.loads(r.companies)]:
        for m in num.findall(t):
            if n(m).rstrip(".") not in src:
                print(f"\n#{r.article_id} {r.title[:40]} | 숫자 {m}\n  답: ...{t[max(0,t.find(m)-35):t.find(m)+30]}...")
ctx={222:["모친","별세","발인","31일","2일"],223:["개월","달","1천만","1000만","천만","뮤즈"],230:["기관","순매수","억원"],260:["매출","6천","억","2028"]}
for i,ws in ctx.items():
    r=next(x for x in rows if x.article_id==i); print("\n== 원문",i)
    seen=set()
    for w in ws:
        for m in list(re.finditer(re.escape(w),r.body))[:2]:
            s=max(0,m.start()-45)
            if any(abs(s-z)<40 for z in seen): continue
            seen.add(s); print("  ",r.body[s:m.end()+45].replace("\n"," "))
