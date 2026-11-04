import json,sys
from collections import Counter
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
src=open(sys.argv[1],encoding="utf-8").read(); exec(src[src.index("E={"):src.index("ids=list(E)")])
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import load_dictionary,match_one,on_topic,norm,TYPE_WORDS,LIST_MAX,LIST_TITLED_MAX
e=get_engine(); d=load_dictionary(e); names=d[0]
with e.connect() as c:
    info=dict(c.execute(text("SELECT stock_code,stock_name FROM stock_info")).all())
    rows=c.execute(text("SELECT article_id,title,body,keywords,companies FROM article WHERE companies IS NOT NULL")).all()
G={("t",1):1.0,("t",0):.8,("l",1):.9,("l",0):.7,("r",1):.5,("r",0):.3}
def seen(t,code,name): return norm(name) in t or any(n in t for n,c in names.items() if c==code and len(n)>=2)
out=[];C=Counter()
for r in rows:
    f=match_one(json.loads(r.companies),(r.keywords or "").split(","),d)
    if not f or not r.body: continue
    h,l,w=norm(r.title),norm(r.body[:200]),norm(r.body)
    typ="[특징주]" not in r.title and any(x in r.title for x in TYPE_WORDS)
    st=len({c for n,c in names.items() if len(n)>=3 and n in w})
    mt=any(x[1]["is_main"] and seen(h,x[0],x[3]) for x in f)
    block=typ or st>LIST_TITLED_MAX or (st>LIST_MAX and not mt)
    for x in f:
        p="t" if seen(h,x[0],x[3]) else "l" if seen(l,x[0],x[3]) else "r"
        s=.2 if block else G[(p,int(bool(x[1]["is_main"])))]
        out.append((r.article_id,r.title,info[x[0]],s,"차단" if block else p+("주" if x[1]["is_main"] else "조")))
        C[(s,"차단" if block else p+("주" if x[1]["is_main"] else "조"))]+=1
print("연결 후보",len(out),"기사",len({o[0] for o in out}))
for k,v in sorted(C.items(),reverse=True): print(" ",k,v)
for th in (.9,.7,.5,.3,.2):
    keep={(o[0],o[2]) for o in out if o[3]>=th}; s=[0,0,0]
    for i,v in E.items():
        if not v: continue
        got={n for a,n in keep if a==i}; m,ok=v; s[0]+=len(set(m)&got); s[1]+=len(set(m)-got); s[2]+=len(got-set(m)-set(ok))
    print(f"기준 {th}: 연결 {len(keep)}, 기사 {len({a for a,_ in keep})}, 시험 30건 [맞음,놓침,틀림] {s}")
print("--- 0.5 구간 표본 (뒷부분 주인공)"); [print(" ",o[0],o[1][:40],o[2]) for o in out if o[3]==.5][:0]
for o in [o for o in out if o[3]==.5][:15]: print(" ",o[0],o[1][:40],o[2])
print("--- 0.3 구간 표본 (뒷부분 조연)")
for o in [o for o in out if o[3]==.3][:15]: print(" ",o[0],o[1][:40],o[2])
