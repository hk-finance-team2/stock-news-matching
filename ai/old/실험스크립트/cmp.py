import json,sys
from collections import Counter
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import match_articles, load_dictionary
e=get_engine()
with e.connect() as c:
    print("flyway",c.execute(text("SELECT version FROM flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank DESC LIMIT 1")).scalar())
    for t in ("stock_info","stock_alias","stock_theme","stock_group","stock_alias_context"):
        print(t,c.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar())
    print("테마 수",c.execute(text("SELECT COUNT(DISTINCT theme) FROM stock_theme")).scalar())
match_articles(statuses=("SUMMARIZED","DONE","NO_STOCK"))
import subprocess; subprocess.run([sys.executable,sys.argv[3],sys.argv[2]],check=True); b=json.load(open(sys.argv[1],encoding="utf-8")); a=json.load(open(sys.argv[2],encoding="utf-8"))
key=lambda r:(r["article_id"],r["stock_code"])
B={key(r):r for r in b if r["stock_code"]}; A={key(r):r for r in a if r["stock_code"]}
st=lambda rs:Counter({r["article_id"]:r["status"] for r in rs}.values())
print("status",st(b),"->",st(a)); print("연결",len(B),"->",len(A))
print("추가",[(k,A[k]["stock_name"]) for k in A.keys()-B.keys()]); print("빠짐",[(k,B[k]["stock_name"]) for k in B.keys()-A.keys()])
ch=[(k,A[k]["stock_name"],A[k]["is_main"],B[k]["relevance"],A[k]["relevance"]) for k in A.keys()&B.keys() if A[k]["relevance"]!=B[k]["relevance"]]
print("관련도 변경",len(ch)); [print(" ",x) for x in sorted(ch)]
oth=[k for k in A.keys()&B.keys() if (A[k]["is_main"],A[k]["sentiment"])!=(B[k]["is_main"],B[k]["sentiment"])]
print("주인공·감성 변경",oth)
print("관련도 분포",sorted(Counter(r["relevance"] for r in b if r["stock_code"]).items()),"->",sorted(Counter(r["relevance"] for r in a if r["stock_code"]).items()))
names,themes,s=load_dictionary(e)
with e.connect() as c:
    rows=c.execute(text("SELECT a.article_id,a.title,a.keywords,s.stock_code,i.stock_name FROM article a JOIN article_stock s ON s.article_id=a.article_id JOIN stock_info i ON i.stock_code=s.stock_code")).all()
print("--- 가산점 근거 (관련도 바뀐 것)")
for r in rows:
    if (r.article_id,r.stock_code) in {x[0] for x in ch}:
        kw=(r.keywords or "").split(","); hits=[(t,k) for t in themes.get(r.stock_code,()) for k in kw if t in k]
        print(r.article_id,r.stock_name,hits,"|",r.title[:45])
