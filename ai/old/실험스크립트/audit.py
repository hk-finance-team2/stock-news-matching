"""요약된 기사 전수 점검. DB 쓰기·LLM 없음"""
import json,re,sys
from collections import Counter
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import load_dictionary,match_one,on_topic,norm,TYPE_WORDS
e=get_engine(); d=load_dictionary(e); names=d[0]
with e.connect() as c:
    info=dict(c.execute(text("SELECT stock_code,stock_name FROM stock_info")).all())
    rows=c.execute(text("SELECT article_id,press,status,title,body,summary,sentiment,keywords,companies FROM article WHERE companies IS NOT NULL ORDER BY article_id")).all()
    L={}
    for r in c.execute(text("SELECT article_id,stock_code,is_main FROM article_stock")): L.setdefault(r.article_id,set()).add(r.stock_code)
print("대상",len(rows),"본문없음",sum(not r.body for r in rows),"언론사",Counter(r.press for r in rows))
print("상태",Counter(r.status for r in rows),"기사감성",Counter(r.sentiment for r in rows))
# 1 재현성: 규칙 결과 = DB
diff=[r.article_id for r in rows if {x[0] for x in on_topic(r.title,r.body,match_one(json.loads(r.companies),(r.keywords or '').split(','),d),names)}!=L.get(r.article_id,set())]
print("규칙 결과와 DB 불일치",diff)
# 2 품질 검사
num=re.compile(r"\d[\d,.]*\d|\d"); n=lambda s:s.replace(",","")
badnum=[];reasons=[];kw=[];lens=[];ends=[];mains=Counter();csent=Counter();ltm=Counter();nocom=0;notin=[]
for r in rows:
    cs=json.loads(r.companies); src=n(r.title+" "+(r.body or "")); lens.append(len(r.summary)); nocom+=not cs
    if not re.search(r"다\.?\s*$",r.summary): ends.append(r.article_id)
    for t in [r.summary]+[c["reason"] for c in cs]:
        for m in num.findall(t):
            if n(m).rstrip(".") not in src and r.body: badnum.append((r.article_id,m))
    for c in cs:
        reasons.append(len(c["reason"])); csent[c["sentiment"]]+=1; ltm[c.get("long_term")]+=1
    kw+= (r.keywords or "").split(",")
print("요약 평균",sum(lens)//len(lens),"최대",max(lens),"200자 초과",sum(x>200 for x in lens),"문장끝 이상",ends[:15],len(ends))
print("원문에 없는 숫자",len(badnum),badnum[:15])
print("이유 40자 초과",sum(x>40 for x in reasons),"/",len(reasons),"키워드 숫자",sum(bool(re.search(r"\d",k)) for k in kw),"/",len(kw),"회사 빈 기사",nocom)
print("회사별 감성",csent,"장기",ltm)
# 3 연결 전수
print("--- 연결 기사")
for r in rows:
    g=on_topic(r.title,r.body,match_one(json.loads(r.companies),(r.keywords or '').split(','),d),names)
    if g: print(r.article_id,r.title[:40],"→",[info[x[0]]+("*" if x[1]["is_main"] else "")+"/"+x[1]["sentiment"][0] for x in g][:5])
# 4 놓침 후보: 제목에 사전 이름(3자 이상)이 있는데 연결 없음
print("--- 놓침 후보 (제목에 종목명, 연결 없음)")
ns=[(k,c) for k,c in names.items() if len(k)>=3]; cnt=0
for r in rows:
    if L.get(r.article_id): continue
    h=norm(r.title); hit={info[c] for k,c in ns if k in h}
    if hit:
        cnt+=1; gate=next((w for w in TYPE_WORDS if w in r.title),"")
        print(r.article_id,gate,r.title[:44],"제목",sorted(hit)[:3],"LLM",[c["name"] for c in json.loads(r.companies)][:3])
print("놓침 후보",cnt)
