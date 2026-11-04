"""조연은 제목·앞 200자에 있을 때만 연결. 유형·명단 기사는 게이트 적용/미적용 둘 다 계산. DB 쓰기·LLM 없음"""
import json,re,sys
from sqlalchemy import text,bindparam
sys.stdout.reconfigure(encoding="utf-8")
src=open(sys.argv[2],encoding="utf-8").read().split("out=[];T=Counter()")[0]
newj=sys.argv[1]; sys.argv=[sys.argv[0],"x"]
exec(src)
def judge(t,bodyraw,companies,kw):
    links=match_one(companies,kw,dic); body=cut(bodyraw or "")
    uniq={n2c[m.group()] for m in pat.finditer(body)}
    gate=next((g for g in GATE if g in t),None)
    if any(k in t for k in EXCEPT): gate=None
    tn=norm(t); ln=norm((bodyraw or "")[:LEAD]); rows=[]
    for code,c,sc,name in links:
        fs=forms(code,c["name"]); rows.append((code,c["is_main"],any(norm(f) in tn for f in fs),any(norm(f) in ln for f in fs)))
    anytitle=any(r[2] for r in rows if r[1])
    blocked=bool(gate) or (len(uniq)>CAP and not anytitle)
    return rows,blocked,gate or (f"명단{len(uniq)}" if blocked else "")
print("=== 저장된 40건")
tot=[0,0,0]; done=[0,0,0]
for r in rows:
    rs,bl,why=judge(r.title,r.body,json.loads(r.companies),(r.keywords or "").split(","))
    posonly=[x for x in rs if x[2] or x[3]]
    final=[] if bl else posonly
    for i,v in enumerate((rs,posonly,final)): tot[i]+=len(v); done[i]+=bool(v)
    side=[x for x in rs if not x[1]]
    if side or (rs and len(final)!=len(rs)):
        print(r.article_id,why or "-",r.title[:34],"| 조연 유지",[info[x[0]]+("(제목)" if x[2] else "(앞)") for x in side if (x[2] or x[3]) and not bl],"| 조연 제거",[info[x[0]] for x in side if bl or not(x[2] or x[3])],"| 주인공 제거",[info[x[0]] for x in rs if x[1] and (bl or not(x[2] or x[3]))])
print("지금 연결",tot[0],"DONE",done[0],"| 위치만",tot[1],"DONE",done[1],"| 위치+게이트",tot[2],"DONE",done[2])
print("=== 새 프롬프트 10건x3회")
res=json.load(open(newj,encoding="utf-8"))
with e.connect() as c:
    B={r.article_id:r for r in c.execute(text("SELECT article_id,title,body FROM article WHERE article_id IN :i").bindparams(bindparam("i",expanding=True)),{"i":sorted({x["id"] for x in res})})}
tot=[0,0]
for x in sorted(res,key=lambda v:(v["id"],v["run"])):
    r=B[x["id"]]; rs,bl,why=judge(r.title,r.body,x["companies"],x["keywords"])
    final=[] if bl else [y for y in rs if y[2] or y[3]]
    tot[0]+=len(rs); tot[1]+=len(final)
    print(x["id"],f"r{x['run']}",why or "-","| 남음",[info[y[0]]+("*" if y[1] else "") for y in final],"| 제거",[info[y[0]] for y in rs if y not in final])
print("연결",tot[0],"→",tot[1])
