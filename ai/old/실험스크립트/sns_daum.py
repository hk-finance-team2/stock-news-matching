"""다음 카페 검색 시험. DB·LLM 없음. 네이버 카페 표본과 같은 규칙으로 비교. 키는 출력하지 않음"""
import json
import os
import pathlib
import sys
from collections import Counter
from datetime import datetime

import requests

import hk_llm.core.config  # .env 읽기
from hk_llm.steps.sns import AD, BRIEF, FIN_CAFE, WORD, clean

sys.stdout.reconfigure(encoding="utf-8")
STOCKS = ["삼성전자", "에코프로", "카카오페이", "한화오션", "HLB"]
OUT = pathlib.Path("hk_llm/data/sns_sample")
key = os.environ.get("KAKAO_REST_API_KEY", "").strip()
print("키 있음:", bool(key), "길이:", len(key))
if not key:
    sys.exit(1)


def stats(name, title, text, cafe, c):
    c["n"] += 1
    c["제목에 이름"] += name in title
    c["주식 단어"] += bool(WORD.search(title + " " + text))
    c["광고"] += bool(AD.search(title + " " + text))
    c["모음"] += bool(BRIEF.search(title))
    c["금융 카페"] += bool(FIN_CAFE.search(cafe or ""))
    good = name in title and WORD.search(title + " " + text) and not AD.search(title + " " + text) and not BRIEF.search(title) and FIN_CAFE.search(cafe or "")
    c["통과"] += bool(good)
    return bool(good)


daum, cafes, sample, ages = Counter(), Counter(), [], []
for name in STOCKS:
    r = requests.get("https://dapi.kakao.com/v2/search/cafe", headers={"Authorization": f"KakaoAK {key}"},
                     params={"query": f"{name} 주가", "sort": "recency", "size": 50}, timeout=20)
    print(name, "HTTP", r.status_code, r.text[:150] if r.status_code != 200 else "")
    if r.status_code != 200:
        continue
    d = r.json()
    docs = d["documents"]
    print("  전체", d["meta"]["total_count"], "노출 가능", d["meta"]["pageable_count"], "받음", len(docs), "칸", sorted(docs[0]) if docs else None)
    (OUT / f"daum_{name}_주가.json").write_text(json.dumps(docs, ensure_ascii=False, indent=0), encoding="utf-8")
    for x in docs:
        t, c = clean(x["title"]), clean(x["contents"])
        cafes[x["cafename"]] += 1
        ages.append(x["datetime"])
        if stats(name, t, c, x["cafename"], daum):
            sample.append((x["datetime"][:16], x["cafename"][:18], t[:42], c[:70]))

naver = Counter()
for name in STOCKS:
    for x in json.loads((OUT / f"cafearticle_{name}_주가.json").read_text(encoding="utf-8")):
        stats(name, clean(x["title"]), clean(x["description"]), x["cafename"], naver)

print("\n다음 ", dict(daum))
print("네이버", dict(naver))
if ages:
    print("다음 글 시각 범위", min(ages)[:16], "~", max(ages)[:16], "/ 지금", datetime.now().isoformat()[:16])
print("\n많이 나온 다음 카페", cafes.most_common(12))
print("\n통과한 글")
for s in sample[:15]:
    print("-", " | ".join(s))
