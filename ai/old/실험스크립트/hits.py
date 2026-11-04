import sys
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import load_dictionary
e=get_engine(); names,themes,s=load_dictionary(e)
print({k:s[k] for k in ("name_weight","context_weight","theme_weight","min_score")})
with e.connect() as c:
    rows=c.execute(text("SELECT a.article_id,a.keywords,s.stock_code,s.is_main,i.stock_name FROM article a JOIN article_stock s ON s.article_id=a.article_id JOIN stock_info i ON i.stock_code=s.stock_code WHERE a.companies IS NOT NULL")).all()
m=[0,0];t=[0,0];no=0
for r in rows:
    h=[(x,k) for x in themes.get(r.stock_code,()) for k in (r.keywords or "").split(",") if x in k]
    i=0 if r.is_main else 1; m[i]+=1; t[i]+=bool(h); no+=not themes.get(r.stock_code)
    if h: print(r.article_id,r.stock_name,"주인공" if r.is_main else "조연",h)
print("주인공 연결",m[0],"테마 적중",t[0],"/ 조연 연결",m[1],"테마 적중",t[1],"/ 테마 없는 종목 연결",no)
