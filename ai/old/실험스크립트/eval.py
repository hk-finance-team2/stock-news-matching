import json, re, sys
from collections import Counter
from difflib import SequenceMatcher
from sqlalchemy import text
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import load_dictionary, norm
e = get_engine()
names, themes, s = load_dictionary(e)
code2name = {}
with e.connect() as c:
    code2name = {a: b for a, b in c.execute(text("SELECT stock_code, stock_name FROM stock_info"))}
    rows = c.execute(text("SELECT article_id, status, title, companies, body, keywords FROM article WHERE companies IS NOT NULL")).all()
    print("summarized", len(rows), Counter(r.status for r in rows))
    all_body = c.execute(text("SELECT CHAR_LENGTH(body) FROM article WHERE body IS NOT NULL")).all()
missing = Counter(); hit = 0
nostock_art = 0
for r in rows:
    cs = json.loads(r.companies)
    for x in cs:
        if norm(x["name"]) in names: hit += 1
        else: missing[x["name"]] += 1
print("exact hit", hit, "miss mentions", sum(missing.values()), "unique", len(missing))
print("--- 유사도 Top1 (difflib ratio x100)")
for n, k in missing.most_common():
    q = norm(n)
    best = max(names, key=lambda m: SequenceMatcher(None, q, m).ratio())
    sc = SequenceMatcher(None, q, best).ratio()
    pre = [m for m in names if len(m) >= 2 and (q.startswith(m) or m.startswith(q))]
    print(f"{n}\t{k}\t{sc*100:.0f}\t{best}\t{code2name[names[best]]}\tprefix={pre[:4]}")
L = sorted(a[0] for a in all_body)
if L:
    over = sum(x > 3000 for x in L)
    print("bodies", len(L), "median", L[len(L)//2], "over3000", over, f"{over/len(L):.1%}")
pat = re.compile("컨센서스|시장 ?전망치|시장 ?기대|예상치|어닝 ?쇼크|어닝 ?서프라이즈|하회|상회")
with e.connect() as c:
    b = c.execute(text("SELECT article_id, body FROM article WHERE body IS NOT NULL")).all()
m = [x for x in b if pat.search(x.body)]
print("consensus-word bodies", len(m), "/", len(b))
in40 = [r for r in rows if r.body and pat.search(r.body)]
print("in summarized", len(in40), [r.article_id for r in in40])
