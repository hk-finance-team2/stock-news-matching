"""언론사의 AI 이용 거부 표시를 자동으로 찾기 (2026-11-10)

    from hk_llm.steps.rights import page_reservation, site_reservation
    why = page_reservation(html, headers)   # 기사 페이지 하나: 이유 문장 또는 None
    why = site_reservation(url)             # 사이트 전체 (하루 1번 캐시): 이유 문장 또는 None
    python -m hk_llm.steps.rights           본문을 쓰는 언론사의 지금 상태 확인 (요청: 사이트마다 robots.txt·tdmrep.json·기사 1건)

찾으면 press_policy.restrict(언론사, TITLE_ONLY, 이유) → 다음 실행부터 본문·LLM 안 씀, 예전 AI 결과는 title_only 가 지움, Slack 알림

왜 (원문 확인. 백엔드1 로컬 기록 ai-improve/24):
- 11/05 까지 연합뉴스·서울경제·연합인포맥스 기사 끝 "AI 학습 및 활용 금지"를 사람이 놓쳐 본문을 요약했음 (ai-improve/02)
  → 사람 눈에만 기대던 유일한 곳. 언론사가 방침을 바꿔도 하루 안에 안전한 쪽으로 바뀌게
- 찾는 표시 (기계가 읽는 권리 유보):
  · W3C TDMRep (Community Group 보고서 2024-05-10): 사이트 /.well-known/tdmrep.json, HTTP 헤더·HTML meta 'tdm-reservation: 1'
    = "TDM rights are reserved" (§5.1, §6.1~6.3). W3C 정식 표준은 아님
  · Cloudflare Content Signals (2025-09): robots.txt 'Content-Signal: ai-input=no' = AI 입력(요약·RAG 등)에 쓰지 말 것.
    우리 LLM 요약은 ai-input 에 해당한다고 봄 (해석). ai-train=no(학습만 거부)는 요약을 막지 않음 → 비즈워치는 그대로
  · 기사 끝 저작권 고지의 "AI 학습·활용 금지" (국내 언론사 방식). EU DSM 지침 2019/790 4조 3항·전문 18: 이용약관 등
    적절한 방식의 유보도 유보로 봄 → 우리도 따름
- 자동으로는 **더 조심스러운 쪽으로만** 바꿈 (본문 요약 → 제목만). 다시 푸는 것은 사람이 확인하고 press_policy.py 를 고침
- 헛걸림 방지 두 겹: ① 저작권 고지 표시(ⓒ·(c)·저작권자·무단 전재) 바로 뒤에 있을 때만
  ② 기사 페이지 고지는 **서로 다른 기사 2건**에서 보여야 언론사 전체를 바꿈 (진짜 고지는 모든 기사 끝에 붙음. 그 1건은 바로 제목만 처리)
  사이트 전체 표시(robots Content-Signal, tdmrep.json)는 사이트가 직접 밝힌 것이라 1번에 바꿈
"""
import json
import re
from datetime import date
from functools import lru_cache
from urllib.parse import urlsplit

import requests

from hk_llm.core.config import USER_AGENT
from hk_llm.core.util import get_logger

log = get_logger(__name__)

# 저작권 고지 표시(ⓒ·©·(c)·저작권자·무단 전재) 뒤 60자 안에 "AI 학습/활용 … 금지"
# "무단"·"저작권" 만으로는 안 됨: 기사 본문의 "무단으로 AI 학습에 쓰는 것을 금지하는 법안" 같은 문장이 걸림
NOTICE = re.compile(r"(?:ⓒ|©|\(c\)|저작권자|무단\s*전재)[^\n<>]{0,60}?AI\s*(?:학습|활용)[^\n<>]{0,15}?(?:금지|불가)", re.I)
META = re.compile(r"""<meta[^>]+name\s*=\s*["']tdm-reservation["'][^>]*content\s*=\s*["']\s*1\s*["']"""
                  r"""|<meta[^>]+content\s*=\s*["']\s*1\s*["'][^>]*name\s*=\s*["']tdm-reservation["']""", re.I)
SIGNAL = re.compile(r"^\s*content-signal\s*:\s*(.+)$", re.I | re.M)


HOLDER = re.compile(r"(?:저작권자\s*(?:\(c\)|ⓒ|©)?|ⓒ|©|\(c\))\s*([가-힣A-Za-z0-9]{2,20})", re.I)


def notice_holder(html):
    """기사 끝 AI 금지 고지에 적힌 저작권자 이름 (예: '<저작권자(c) 연합뉴스, …>' → '연합뉴스'). 고지가 없거나 이름이 없으면 None"""
    text = html.decode("utf-8", "replace") if isinstance(html, bytes) else (html or "")
    m = NOTICE.search(text)
    h = HOLDER.search(m.group(0)) if m else None
    return h.group(1) if h else None


def is_wire(press, holder):
    """고지의 저작권자가 그 언론사가 아니면 다른 곳 기사를 그대로 실은 것(전재, 예: 파이낸셜뉴스에 실린 연합뉴스 기사).
    그 기사만 건너뛰고 언론사 전체 방침에는 세지 않음 (2026-11-11: 파이낸셜뉴스 지난 기사 10건 중 3건이 연합 전재였음).
    '서울경제' ↔ '서울경제신문' 처럼 한쪽이 다른 쪽을 품으면 같은 곳으로 봄"""
    if not press or not holder:
        return False
    p, h = press.replace(" ", ""), holder.replace(" ", "")
    return p not in h and h not in p


def page_reservation(html, headers=None):
    """기사 페이지 한 건에서 AI 이용 거부 표시를 찾음. 이유 문장 또는 None"""
    headers = headers or {}
    if str(headers.get("tdm-reservation", "")).strip() == "1":
        return "HTTP 헤더 tdm-reservation: 1 (W3C TDMRep)"
    text = html.decode("utf-8", "replace") if isinstance(html, bytes) else (html or "")
    if META.search(text):
        return "HTML meta tdm-reservation=1 (W3C TDMRep)"
    m = NOTICE.search(text)
    if m:
        return f"기사 끝 고지 '{m.group(0)[-40:].strip()}'"
    return None


def content_signals(robots_txt):
    """robots.txt 의 Content-Signal 줄 → {'search': 'yes', 'ai-input': 'no', ...}. 여러 줄이면 '거부(no)'를 우선"""
    out = {}
    for line in SIGNAL.findall(robots_txt or ""):
        for part in line.split(","):
            if "=" in part:
                k, v = (x.strip().lower() for x in part.split("=", 1))
                if out.get(k) != "no":
                    out[k] = v
    return out


def tdmrep_reserved(data):
    """/.well-known/tdmrep.json 내용(목록)에 tdm-reservation 1 인 항목이 있나. 어느 경로든 있으면 조심스럽게 '있음'"""
    items = data if isinstance(data, list) else [data] if isinstance(data, dict) else []
    return any(isinstance(x, dict) and str(x.get("tdm-reservation")).strip() == "1" for x in items)


def _get(url):
    return requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=10)


@lru_cache(maxsize=64)  # 사이트·날짜별 → 하루 1번만 요청
def _site(origin, day):
    try:
        res = _get(f"{origin}/robots.txt")
        if res.ok and content_signals(res.text).get("ai-input") == "no":
            return "robots.txt Content-Signal ai-input=no (AI 입력 거부)"
    except requests.RequestException:
        pass  # robots.txt 자체는 robots.py 가 따로 지킴
    try:
        res = _get(f"{origin}/.well-known/tdmrep.json")
        if res.ok and tdmrep_reserved(res.json()):
            return "/.well-known/tdmrep.json tdm-reservation: 1 (W3C TDMRep)"
    except (requests.RequestException, ValueError):
        pass  # 파일이 없거나(대부분) JSON 이 아니면 표시 없음
    return None


def site_reservation(url):
    p = urlsplit(url)
    return _site(f"{p.scheme}://{p.netloc}", date.today())


if __name__ == "__main__":
    import time

    from sqlalchemy import text

    from hk_llm.core.db import get_engine
    from hk_llm.core.press_policy import FULL, POLICY
    from hk_llm.steps.robots import allowed

    engine = get_engine()
    for press, (rule, _) in POLICY.items():
        if rule != FULL:
            continue  # 이미 제목만인 언론사는 기사 페이지를 요청하지 않음 (수집기와 같은 원칙)
        with engine.connect() as c:
            url = c.execute(text("SELECT url FROM article WHERE press = :p AND channel = 'RSS' ORDER BY article_id DESC LIMIT 1"),
                            {"p": press}).scalar()
        if not url:
            print(press, "기사 없음")
            continue
        site = site_reservation(url)
        page = None
        if allowed(url):
            time.sleep(2)
            res = _get(url)
            page = page_reservation(res.content, res.headers)
        robots = content_signals(_get(f"{urlsplit(url).scheme}://{urlsplit(url).netloc}/robots.txt").text)
        print(f"{press}: 사이트 {site or '표시 없음'} / 기사 {page or '표시 없음'} / Content-Signal {robots or '없음'}")
