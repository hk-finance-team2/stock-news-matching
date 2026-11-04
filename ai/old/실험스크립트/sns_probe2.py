"""검색어별 품질 비교 + 팍스넷 목록. DB·LLM 없음. 결과는 hk_llm/data/sns_sample. 닉네임은 저장 안 함"""
import html
import json
import os
import pathlib
import re
import sys
import time

import lxml.html
import requests

import hk_llm.core.config
from hk_llm.core.config import USER_AGENT
from hk_llm.steps.robots import allowed

sys.stdout.reconfigure(encoding="utf-8")
BASE = "https://naverapihub.apigw.ntruss.com/search/v1/"
HEAD = {"X-NCP-APIGW-API-KEY-ID": os.environ["NAVER_CLIENT_ID"], "X-NCP-APIGW-API-KEY": os.environ["NAVER_CLIENT_SECRET"]}
STOCKS = {"삼성전자": "005930", "에코프로": "086520", "카카오페이": "377300", "한화오션": "042660", "HLB": "028300"}
VARIANTS = ["{}", "{} 주가", "{} 주식 전망"]
OUT = pathlib.Path("hk_llm/data/sns_sample")
OUT.mkdir(parents=True, exist_ok=True)
clean = lambda t: html.unescape(re.sub(r"<[^>]+>", "", t or ""))
STOCK_WORDS = re.compile("주가|주식|매수|매도|종목|증시|코스피|코스닥|실적|상승|하락|목표가|배당|급등|급락|투자")
AD = re.compile("리딩|무료 ?추천|문의|카톡|오픈채팅|텔레그램|https?://|모집|수익 ?인증|상담|010[- ]?\\d")
BRIEF = re.compile("마감|시황|브리핑|뉴스|상한가|\\[일간|\\[검색|정리|일정|TOP")

print("경로 | 건수 | 제목에 이름 | 주식 단어 | 광고 의심 | 시황·모음 | 카페/블로그 수 | 글 수 중복")
rows = {}
for kind in ("cafearticle", "blog"):
    for v in VARIANTS:
        tot = dict(n=0, title=0, word=0, ad=0, brief=0)
        names, titles = set(), []
        for name in STOCKS:
            q = v.format(name)
            r = requests.get(BASE + kind, headers=HEAD, params={"query": q, "display": 50, "sort": "date"}, timeout=20)
            r.raise_for_status()
            items = r.json()["items"]
            (OUT / f"{kind}_{q.replace(' ', '_')}.json").write_text(json.dumps(items, ensure_ascii=False, indent=0), encoding="utf-8")
            rows[(kind, q)] = items
            for it in items:
                t, d = clean(it["title"]), clean(it["description"])
                tot["n"] += 1
                tot["title"] += name in t
                tot["word"] += bool(STOCK_WORDS.search(t + d))
                tot["ad"] += bool(AD.search(t + d))
                tot["brief"] += bool(BRIEF.search(t))
                names.add(it.get("cafename") or it.get("bloggername"))
                titles.append(t)
            time.sleep(0.15)
        print(kind, repr(v), tot, "출처", len(names), "중복제목", len(titles) - len(set(titles)))

print("\n--- 제목에 이름 + 주식 단어 + 광고·시황 아닌 글 (후보) 표본")
for (kind, q), items in rows.items():
    name = q.split()[0]
    if " " not in q:
        continue
    good = [it for it in items if name in clean(it["title"]) and STOCK_WORDS.search(clean(it["title"] + it["description"]))
            and not AD.search(clean(it["title"] + it["description"])) and not BRIEF.search(clean(it["title"]))]
    print(f"{kind} {q}: {len(good)}/{len(items)}")
    for it in good[:2]:
        print("  -", it.get("postdate", "날짜없음"), "|", clean(it["title"])[:45], "|", clean(it["description"])[:80])

print("\n--- 팍스넷 종목토론 (목록만)")
for name, code in STOCKS.items():
    url = f"https://www.paxnet.co.kr/tbbs/list?tbbsType=L&id={code}"
    if not allowed(url):
        print(name, "robots 금지")
        continue
    t0 = time.time()
    r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    tree = lxml.html.fromstring(r.text)
    links = [(" ".join(a.text_content().split()), a.get("href")) for a in tree.xpath("//a[contains(@href,'tbbs/view') or contains(@href,'seq=')]")]
    links = [x for x in links if x[0]]
    print(name, "HTTP", r.status_code, f"{time.time() - t0:.1f}초", "글", len(links))
    (OUT / f"paxnet_{code}.json").write_text(json.dumps([x[0] for x in links], ensure_ascii=False, indent=0), encoding="utf-8")
    for title, _ in links[:5]:
        print("  -", title[:70])
    time.sleep(1.5)
