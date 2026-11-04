"""코드 규칙 8~11 시험. 저장된 companies 에 적용, DB 쓰기·LLM 없음"""
import json,re,sys
from collections import Counter
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import load_dictionary, match_one, norm
# 규칙값은 보고서 그대로 고정 (40건을 보고 고치지 않음)
GATE=["마감시황","시황","주간","증시 전망","증시전망","산업생산","생산지표","CPI","소비자물가","고용지표"]
EXCEPT=["[특징주]"]
TAIL=["관련기사","이 밖에","이밖에"]
CAP=5; LEAD=200; MAX_MAIN=2
e=get_engine(); dic=load_dictionary(e); names,themes,s=dic
with e.connect() as c:
    info={a:b for a,b in c.execute(text("SELECT stock_code,stock_name FROM stock_info"))}
    al={}
    for code,a in c.execute(text("SELECT stock_code,alias FROM stock_alias WHERE alias_type<>'AMBIGUOUS'")): al.setdefault(code,[]).append(a)
    rows=c.execute(text("SELECT article_id,title,body,keywords,companies FROM article WHERE companies IS NOT NULL ORDER BY article_id")).all()
def forms(code,llm): return {x for x in [llm,info[code],*al.get(code,[])] if len(x)>=2}
scan=sorted({n for n in info.values() if len(n)>=3}|{a for v in al.values() for a in v if len(a)>=3},key=len,reverse=True)
pat=re.compile("|".join(map(re.escape,scan)))
n2c={**{v:k for k,v in info.items()},**{a:k for k,v in al.items() for a in v}}
def cut(b):
    idx=[b.find(t) for t in TAIL if b.find(t)>=0]; return b[:min(idx)] if idx else b
def count(body,fs):
    n=0
    for f in fs:
        for m in re.finditer(re.escape(f),body):
            if "연구원" not in body[m.end():m.end()+15]: n+=1
    return n
out=[];T=Counter()
for r in rows:
    cs=json.loads(r.companies); kw=(r.keywords or "").split(",")
    links=match_one(cs,kw,dic); body=cut(r.body or ""); t=r.title
    uniq={n2c[m.group()] for m in pat.finditer(body)}
    gate=next((g for g in GATE if g in t),None)
    if any(x in t for x in EXCEPT): gate=None
    lst=len(uniq)>CAP
    tn=norm(t); ln=norm((r.body or "")[:LEAD])
    keep=[]
    for code,c,sc,name in links:
        if not c["is_main"]: continue
        fs=forms(code,c["name"])
        pos=any(norm(f) in tn or norm(f) in ln for f in fs); intitle=any(norm(f) in tn for f in fs)
        keep.append((code,count(body,fs),pos,intitle))
    if gate: why=f"유형:{gate}"; mains=[]
    elif lst and not any(k[3] for k in keep): why=f"명단:{len(uniq)}"; mains=[]
    else:
        ok=sorted([k for k in keep if k[2]],key=lambda k:-k[1])[:MAX_MAIN]; mains=[k[0] for k in ok]; why=""
    allc={l[0] for l in links}; oldm={l[0] for l in links if l[1]["is_main"]}
    out.append(dict(id=r.article_id,t=t,uniq=len(uniq),why=why,links=[info[c] for c in allc],old=[info[c] for c in oldm],new=[info[c] for c in mains],notpos=[info[k[0]] for k in keep if not k[2]],cnt={info[k[0]]:k[1] for k in keep}))
for x in out:
    flag="★" if set(x["old"])!=set(x["new"]) else " "
    print(flag,x["id"],f"u{x['uniq']}",x["why"],"|",x["t"][:42],"| 연결",x["links"],"| 주인공",x["old"],"→",x["new"],("| 위치X "+str(x["notpos"])) if x["notpos"] else "")
print("---")
l=sum(len(x["links"]) for x in out); o=sum(len(x["old"]) for x in out); n=sum(len(x["new"]) for x in out)
print("연결",l,"주인공 이전",o,"이후",n,"기사 수 주인공 있음",sum(bool(x["old"]) for x in out),"->",sum(bool(x["new"]) for x in out))
print("주인공만 연결 시 DONE",sum(bool(x["new"]) for x in out),"/ 지금 DONE",sum(bool(x["links"]) for x in out))
print("고유 종목 수 분포",sorted(Counter(x["uniq"] for x in out).items()))
print("유형 걸림",[x["id"] for x in out if x["why"].startswith("유형")],"명단 걸림",[x["id"] for x in out if x["why"].startswith("명단")])
json.dump(out,open(sys.argv[1],"w",encoding="utf-8"),ensure_ascii=False,indent=0)
