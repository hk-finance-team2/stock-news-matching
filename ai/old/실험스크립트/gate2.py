"""새 프롬프트 응답(new.json, 10건 x 3회)에 같은 규칙을 재적용. DB 쓰기·LLM 없음"""
import json,re,sys
from sqlalchemy import text,bindparam
sys.stdout.reconfigure(encoding="utf-8")
src=open(sys.argv[2],encoding="utf-8").read().split("out=[];T=Counter()")[0]
sys.argv=[sys.argv[0],sys.argv[1]]
exec(src)
res=json.load(open(sys.argv[1],encoding="utf-8"))
with e.connect() as c:
    B={r.article_id:r for r in c.execute(text("SELECT article_id,title,body FROM article WHERE article_id IN :i").bindparams(bindparam("i",expanding=True)),{"i":sorted({x["id"] for x in res})})}
ol=nl=om=nm=0
for x in sorted(res,key=lambda v:(v["id"],v["run"])):
    r=B[x["id"]]; links=match_one(x["companies"],x["keywords"],dic); body=cut(r.body or ""); t=r.title
    uniq={n2c[m.group()] for m in pat.finditer(body)}
    gate=next((g for g in GATE if g in t),None)
    if any(k in t for k in EXCEPT): gate=None
    tn=norm(t); ln=norm((r.body or "")[:LEAD]); keep=[]
    for code,c,sc,name in links:
        if not c["is_main"]: continue
        fs=forms(code,c["name"]); keep.append((code,count(body,fs),any(norm(f) in tn or norm(f) in ln for f in fs),any(norm(f) in tn for f in fs)))
    if gate: why="유형:"+gate; mains=[]
    elif len(uniq)>CAP and not any(k[3] for k in keep): why=f"명단:{len(uniq)}"; mains=[]
    else: why=""; mains=[k[0] for k in sorted([k for k in keep if k[2]],key=lambda k:-k[1])[:MAX_MAIN]]
    old=[l[0] for l in links if l[1]["is_main"]]
    ol+=len(links); nl+=len(mains); om+=len(old); nm+=len(mains)
    print(x["id"],f"r{x['run']}",why or "-","| 연결",[info[l[0]] for l in links],"| 주인공",[info[c] for c in old],"→",[info[c] for c in mains])
print("연결",ol,"주인공",om,"→",nm)
