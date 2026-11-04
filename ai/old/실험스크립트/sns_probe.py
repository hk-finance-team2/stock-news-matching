"""SNS 수집처 확인: 네이버 API HUB 검색. DB·LLM 없음. 결과는 hk_llm/data/sns_sample (Git 제외). 키는 출력하지 않음"""
import json
import os
import pathlib
import re
import sys
import time

import requests

import hk_llm.core.config  # .env 읽기

sys.stdout.reconfigure(encoding="utf-8")
BASE = "https://naverapihub.apigw.ntruss.com/search/v1/"
HEAD = {"X-NCP-APIGW-API-KEY-ID": os.environ["NAVER_CLIENT_ID"], "X-NCP-APIGW-API-KEY": os.environ["NAVER_CLIENT_SECRET"]}
STOCKS = ["삼성전자", "에코프로", "카카오페이", "한화오션", "HLB"]
OUT = pathlib.Path("hk_llm/data/sns_sample")
OUT.mkdir(parents=True, exist_ok=True)
clean = lambda t: re.sub(r"<[^>]+>", "", t or "")

for kind in ("cafearticle", "blog"):
    for q in STOCKS:
        r = requests.get(BASE + kind, headers=HEAD, params={"query": q, "display": 20, "sort": "date"}, timeout=20)
        print(f"\n=== {kind} {q}: HTTP {r.status_code}")
        if r.status_code != 200:
            print(r.text[:300])
            continue
        d = r.json()
        items = d.get("items", [])
        print("total", d.get("total"), "받은", len(items), "칸", sorted(items[0]) if items else None)
        (OUT / f"{kind}_{q}.json").write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
        for it in items[:4]:
            print("-", it.get("postdate") or "(날짜칸없음)", "|", it.get("cafename") or it.get("bloggername"), "|", clean(it["title"])[:45], "|", clean(it["description"])[:70])
        time.sleep(0.2)
