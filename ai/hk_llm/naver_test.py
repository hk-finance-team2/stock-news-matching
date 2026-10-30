"""NAVER API HUB 뉴스 검색 키 확인용. 실행: python naver_test.py 삼성전자"""
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

query = sys.argv[1] if len(sys.argv) > 1 else "삼성전자"
res = requests.get(
    "https://naverapihub.apigw.ntruss.com/search/v1/news",
    params={"query": query, "display": 5, "sort": "date"},
    headers={
        "X-NCP-APIGW-API-KEY-ID": os.environ["NAVER_CLIENT_ID"],
        "X-NCP-APIGW-API-KEY": os.environ["NAVER_CLIENT_SECRET"],
    },
    timeout=10,
)
print(res.status_code)
if not res.ok:
    sys.exit(res.text)

data = res.json()
print("total:", data.get("total"))
for item in data.get("items", []):
    print("-", item["pubDate"], item["title"])
    print(" ", item.get("originallink") or item["link"])
