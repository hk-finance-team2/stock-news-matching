"""유입 많은 커뮤니티 robots.txt 원문 규칙 확인 (글 수집 안 함)"""
import re
import sys
import urllib.robotparser as rp

import requests

from hk_llm.core.config import USER_AGENT

sys.stdout.reconfigure(encoding="utf-8")
SITES = {
    "디시 주식갤": ("https://gall.dcinside.com", "/board/lists/?id=neostock"),
    "디시 미니갤": ("https://gall.dcinside.com", "/mgallery/board/lists/?id=krstock"),
    "아카라이브 주식": ("https://arca.live", "/b/stock"),
    "에펨코리아 주식": ("https://www.fmkorea.com", "/stock"),
    "루리웹": ("https://bbs.ruliweb.com", "/community/board/300143"),
    "인벤": ("https://www.inven.co.kr", "/board/webzine/2097"),
    "보배드림": ("https://www.bobaedream.co.kr", "/list?code=freeb"),
    "블라인드 주식": ("https://www.teamblind.com", "/kr/topics/주식·투자"),
    "네이버 종토방": ("https://finance.naver.com", "/item/board.naver?code=005930"),
    "다음 금융 토론": ("https://finance.daum.net", "/quotes/A005930"),
    "뽐뿌": ("https://www.ppomppu.co.kr", "/rss.php?id=stock"),
}
AI = re.compile(r"gptbot|claudebot|ccbot|anthropic-ai|google-extended|ai", re.I)
for name, (host, path) in SITES.items():
    try:
        r = requests.get(host + "/robots.txt", headers={"User-Agent": USER_AGENT}, timeout=15)
    except Exception as e:
        print(f"\n## {name}: 실패 {type(e).__name__}")
        continue
    print(f"\n## {name}: robots HTTP {r.status_code}", end="")
    if r.status_code >= 400:
        print()
        continue
    p = rp.RobotFileParser()
    p.parse(r.text.splitlines())
    print(" 우리 봇 허용 =", p.can_fetch(USER_AGENT, host + path))
    # 묶음별로: AI 봇 묶음과 * 묶음의 규칙만
    for block in re.split(r"\n\s*\n", r.text.replace("\r", "")):
        agents = re.findall(r"(?im)^user-agent:\s*(.+)$", block)
        if any(a.strip() == "*" or re.search("gptbot|claudebot|ccbot|anthropic", a, re.I) for a in agents):
            rules = re.findall(r"(?im)^(allow|disallow):\s*(.*)$", block)
            print("  ", agents[:6], [f"{a[0]} {b}" for a, b in rules][:6], f"(총 {len(rules)}줄)")
    if re.search(r"(?i)content-signal|ai-train|ai-input", r.text):
        print("   신호:", re.findall(r"(?im)^.*(?:content-signal|ai-train|ai-input).*$", r.text)[:2])
