import re,json,sys,subprocess
from collections import Counter
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import load_dictionary, norm, match_one
e=get_engine()
with e.connect() as c:
    print("로컬 DB flyway 최고버전:",c.execute(text("SELECT version FROM flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank DESC LIMIT 1")).scalar())
    print("로컬 alias/theme 줄:",c.execute(text("SELECT COUNT(*) FROM stock_alias")).scalar(),c.execute(text("SELECT COUNT(*) FROM stock_theme")).scalar())
    print("stock_group 존재:",c.execute(text("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='stock_group'")).scalar())
    info={a:b for a,b in c.execute(text("SELECT stock_code,stock_name FROM stock_info"))}
    rows=c.execute(text("SELECT article_id,title,status,keywords,companies FROM article WHERE companies IS NOT NULL")).all()
names,themes,s=load_dictionary(e)
new=dict(names)
sql=subprocess.run(["git","show","origin/main:backend/src/main/resources/db/migration/R__stock_alias.sql"],capture_output=True,cwd="..").stdout.decode("utf-8")
rows_a=re.findall(r"\('(\d{6})',\s*'((?:[^']|'')+)',\s*'(\w+)'\)",sql)
print("main 별칭 줄:",len(rows_a),Counter(t for _,_,t in rows_a))
miss=[(c,a) for c,a,t in rows_a if c not in info]
print("로컬 stock_info 에 없는 코드:",len(miss),miss[:5])
collide=[]
for c,a,t in rows_a:
    if t=="AMBIGUOUS": continue
    k=norm(a)
    if k in new and new[k]!=c: collide.append((a,c,new[k]))
    new.setdefault(k,c)
print("정규화 충돌:",len(collide),collide[:10])
old_d=(names,themes,s); new_d=(new,themes,s)
d=n=0; old_links=new_links=0
print("--- 달라지는 기사")
for r in rows:
    cs=json.loads(r.companies); kw=(r.keywords or "").split(",")
    o=match_one(cs,kw,old_d); m=Counter(); x=match_one(cs,kw,new_d,m)
    old_links+=len(o); new_links+=len(x); d+=bool(o); n+=bool(x)
    os_={a[0] for a in o}; xs={a[0] for a in x}
    if os_!=xs: print(r.article_id,r.title[:40],"| 추가:",[(info.get(k),k) for k in xs-os_],"| 빠짐:",[info.get(k) for k in os_-xs])
print("DONE",d,"->",n,"/ 40, 연결",old_links,"->",new_links)
m=Counter()
for r in rows: match_one(json.loads(r.companies),(r.keywords or "").split(","),new_d,m)
print("여전히 없는 이름",len(m),list(m))
print("주요 이름:",{k:(new.get(norm(k)),info.get(new.get(norm(k)))) for k in ["LG CNS","LIG D&A","현대차그룹","포스코","포스코이앤씨","KB국민카드","하나은행","DL케미칼","HL클레무브"]})
