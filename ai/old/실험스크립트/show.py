import re,sys
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
pat = re.compile("컨센서스|시장 ?전망치|시장 ?기대|예상치|어닝 ?쇼크|어닝 ?서프라이즈|하회|상회")
with get_engine().connect() as c:
    for i in (6,20,440,1005,1123):
        r=c.execute(text("SELECT title,body,sentiment,companies FROM article WHERE article_id=:i"),{"i":i}).one()
        print("==",i,r.title,"|",r.sentiment,"| len",len(r.body))
        print("  회사:",r.companies[:400])
        for m in list(pat.finditer(r.body))[:3]:
            print("  ...",r.body[max(0,m.start()-70):m.end()+50].replace("\n"," "), "(pos",m.start(),")")
