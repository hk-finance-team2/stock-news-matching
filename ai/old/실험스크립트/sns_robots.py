"""후보 사이트 robots.txt 와 RSS 만 확인 (글 본문 수집 안 함, 키 안 씀)"""
import re
import sys
import urllib.robotparser as rp

import requests

from hk_llm.core.config import USER_AGENT

sys.stdout.reconfigure(encoding="utf-8")
SITES = {
    "뽐뿌 증권": ("https://www.ppomppu.co.kr", "/zboard/zboard.php?id=stock"),
    "뽐뿌 RSS": ("https://www.ppomppu.co.kr", "/rss.php?id=stock"),
    "클리앙 주식": ("https://www.clien.net", "/service/board/cm_stock"),
    "더쿠": ("https://theqoo.net", "/hot"),
    "텔레그램 공개 미리보기": ("https://t.me", "/s/durov"),
    "토스증권 커뮤니티": ("https://www.tossinvest.com", "/stocks/A005930/community"),
    "스톡플러스": ("https://stockplus.com", "/m/stocks/KOREA-A005930"),
    "알파스퀘어": ("https://alphasquare.co.kr", "/home/stock-information"),
    "인베스팅닷컴 영문": ("https://www.investing.com", "/equities/samsung-electronics-co-ltd-commentary"),
    "네이버 프리미엄 콘텐츠": ("https://contents.premium.naver.com", "/"),
    "유튜브 영상 페이지": ("https://www.youtube.com", "/watch?v=x"),
    "Threads": ("https://www.threads.net", "/search?q=x"),
    "Bluesky 공개 API": ("https://public.api.bsky.app", "/xrpc/app.bsky.feed.searchPosts"),
    "Mastodon": ("https://mastodon.social", "/tags/x"),
}
for name, (host, path) in SITES.items():
    try:
        r = requests.get(host + "/robots.txt", headers={"User-Agent": USER_AGENT}, timeout=15)
        if r.status_code >= 400:
            print(f"{name}: robots HTTP {r.status_code}")
            continue
        p = rp.RobotFileParser()
        p.parse(r.text.splitlines())
        ai = re.findall(r"(?im)^user-agent:\s*(gptbot|claudebot|ccbot|anthropic-ai)", r.text)
        print(f"{name}: 우리 봇 허용={p.can_fetch(USER_AGENT, host + path)} AI봇 항목={sorted(set(a.lower() for a in ai))}")
    except Exception as e:
        print(f"{name}: 실패 {type(e).__name__}")
for url in ("https://www.ppomppu.co.kr/rss.php?id=stock",
            "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90&limit=3"):
    try:
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=15)
        print(url[:60], "HTTP", r.status_code, r.headers.get("content-type"), r.text[:200].replace("\n", " "))
    except Exception as e:
        print(url[:60], "실패", type(e).__name__)
