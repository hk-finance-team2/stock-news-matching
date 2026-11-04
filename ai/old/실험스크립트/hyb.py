import json,re,sys
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
src=open(sys.argv[2],encoding="utf-8").read()
exec(src[src.index("E={"):src.index("ids=list(E)")])
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import load_dictionary,norm
e=get_engine(); names=load_dictionary(e)[0]
res=json.load(open(sys.argv[1],encoding="utf-8"))
with e.connect() as c:
    B={r.article_id:r for r in c.execute(text("SELECT article_id,title,body FROM article WHERE article_id IN (%s)"%",".join(str(x["id"]) for x in res)))}
    code={b:a for a,b in c.execute(text("SELECT stock_code,stock_name FROM stock_info"))}
def seen(t,n):
    k=code[n]; return any(m in t for m,c2 in names.items() if c2==k and len(m)>=2)
HARD={"명단","부고·인사·게시판"}; SOFT={"시황","지표·정책"}
def score(fn):
    s=[0,0,0];w=[]
    for x in res:
        r=B[x["id"]]; got=set(fn(x,r))
        if E[x["id"]]:
            m,o=E[x["id"]]; s[0]+=len(set(m)&got); s[1]+=len(set(m)-got); w_=sorted(got-set(m)-set(o)); s[2]+=len(w_)
            if w_ or set(m)-got: w.append((x["id"],"틀림",w_,"놓침",sorted(set(m)-got)))
    return s,w
def picked(x,roles=("주인공","관련")):
    return [c["stock"] for c in x["llm"] if c["role"] in roles and c["stock"] in code]
def A(x,r):  # 후보+유형+역할, 위치 조건 추가
    if x["type"] in HARD|SOFT: return []
    t,l=norm(r.title),norm(r.body[:200]); return [n for n in picked(x) if seen(t,n) or seen(l,n)]
def B2(x,r):  # 시황·지표여도 제목에 있는 주인공은 살림, 관련은 위치 조건
    t,l=norm(r.title),norm(r.body[:200])
    if x["type"] in HARD: return []
    if x["type"] in SOFT: return [n for n in picked(x,("주인공",)) if seen(t,n)]
    return [n for n in picked(x) if seen(t,n) or seen(l,n)]
for nm,f in (("A 후보+유형+위치",A),("B 제목 주인공 살림",B2)):
    s,w=score(f); print(nm,s); [print("  ",y) for y in w]
