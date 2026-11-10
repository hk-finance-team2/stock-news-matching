"""6단계 (23~25번): 요약에서 LLM 이 뽑은 회사 이름(article.companies)을 종목에 연결 → DONE / NO_STOCK

    from hk_llm.steps.step6_match import match_articles
    match_articles()                                         # SUMMARIZED 기사 매칭
    match_articles(statuses=("SUMMARIZED", "DONE", "NO_STOCK"))  # 규칙을 바꾼 뒤 전부 다시 매칭 (LLM 안 부름, 비용 0)

- 종목 사전: stock_info(종목명) + stock_alias(별칭) + stock_theme(테마), 백엔드가 채움
- 범위: stock_info 전체 (코스피+코스닥, 결정사항 2번)
- 점수 (match_setting 가중치 사용): 이름이 맞으면 기본 통과, 테마가 맞으면 점수만 올림 🧪 (2026-11-02)
  키워드가 테마와 안 맞아도 깎지 않음: 삼성전자 '3분기 실적' 기사가 테마 때문에 탈락하면 안 되므로
- 주제 확인 (on_topic) 🧪 (2026-11-03): 시황·전망·지표 기사와 명단 기사는 연결 안 함, 그 밖에는 제목이나 본문 앞부분에 이름이 있거나 본문에 2번 이상 나와야 연결 (2번 조건 2026-11-03 추가)
- 근거 문장 (evidence, F-06) 🧪 (2026-11-04): 그 종목 이름이 나온 본문 문장 중 LLM 이유와 단어가 가장 많이 겹치는 문장. LLM 비용 0
- 관련도 (relevance) 🧪 (2026-11-03): 제목 0.40 / 첫 부분 0.20 + 주인공 0.25 + 언급 횟수 최대 0.25 + 테마 0.10. 연결 여부와 별개로 화면 순서용
- 결과: article_stock 에 기사 1 : 종목 N. 다시 매칭하면 그 기사의 연결을 지우고 새로 넣음
"""
import json
import re
from collections import Counter
from datetime import datetime

from sqlalchemy import bindparam, text

from hk_llm.core.config import KST
from hk_llm.core.db import get_engine
from hk_llm.core.util import get_logger

log = get_logger(__name__)

TYPE_WORDS = ("산업생산", "생산지표", "CPI", "소비자물가", "고용지표", "[부고]", "[인사]")  # 제목에 있으면 특정 회사 기사가 아님
# 시황 기사 (04-4b, 라벨 기준 v2.1 2.1절): 전부 버리지 않고, 제목에 나오고 그 종목만의 문장(가격·원인)이 본문에 있는 종목만 남김.
# 본문에 등락률로만 나오는 종목은 나열 → 연결 안 함. '코스피'·'코스닥' 이 제목에 있는 기사도 시황으로 봄 (예: "코스피, 장중 5%대 급락")
MARKET_WORDS = ("시황", "주간전망", "증시 전망", "증시전망", "[마켓노트]", "[마켓뷰]")  # 제목만 보는 title_only 는 이것들이면 연결 안 함 (전과 같음)
MARKET_INDEX = ("코스피", "코스닥")
NOT_MARKET = re.compile(r"(코스피|코스닥)\s*(상장|입성|이전)")  # "코스닥 상장사 임직원 송치" 는 시황이 아님
FEATURE_TAGS = ("[특징주]", "[종목+]")  # 한 종목을 다루는 기사 말머리 → 유형 판단에서 뺌
TITLE_PAIRS = {"삼전닉스": "삼성전자SK하이닉스"}  # 두 종목을 합친 제목 말 (norm 한 제목에서 바꿔 읽음)
LEAD_CHARS = 200  # 본문 앞부분
LIST_MAX = 5  # 본문에 나온 종목이 이보다 많으면 명단 기사 🧪
LIST_TITLED_MAX = 9  # 제목에 주인공이 있어도 이보다 많으면 명단·시황 🧪 본문 716건 중 제목에 회사가 있고 10개 이상인 기사는 저PBR 명단 2건·시황 1건뿐
MIN_MENTIONS = 2  # 제목·앞부분에 없어도 본문에 이만큼 나오면 연결 🧪 (2026-11-03 태경)
# 근거: 정답지 밖 기사에서 위치 조건으로 버려진 연결 40개를 읽음. 1번만 나온 것은 대부분 나열(연사·참가사·참석자),
#      2번 이상은 16개 중 14개가 실제 당사자 (4대 금융 NPL 비교, 공급사, 실적 기여 자회사 등)

# 관련도 (화면 % · 관련도순 정렬용) 🧪 (2026-11-03 태경). 연결 여부는 score·on_topic 이 정하고, 이 값은 "기사 안에서 얼마나 중심인가"
# 예전: 주인공 1.00 / 조연 0.83 두 값뿐이라 연결의 77% 가 1.00 → 같은 종목 기사끼리 순서를 못 가림
REL_TITLE = 0.40  # 제목에 나옴
REL_LEAD = 0.20  # 제목엔 없고 본문 앞부분에 나옴
REL_MAIN = 0.25  # LLM 이 주인공이라 함
REL_MENTION = 0.25  # 본문에 나온 횟수 (REL_MENTION_FULL 번 이상이면 만점)
REL_MENTION_FULL = 4
REL_THEME = 0.10  # 기사 키워드가 그 종목 테마와 맞음
REL_MIN = 0.10  # 연결된 이상 최소값


def norm(name):
    """비교용 이름: (주)·㈜·주식회사·(종목코드)·공백·하이픈 제거, 영문 대문자"""
    return re.sub(r"\(주\)|㈜|주식회사|\(\w{6}\)|[\s\-‐–]", "", name).upper()


def load_dictionary(engine):
    """{비교용 이름: 종목코드}, {종목코드: 테마 set}, 설정값 dict"""
    with engine.connect() as conn:
        names = {norm(n): c for c, n in conn.execute(text("SELECT stock_code, stock_name FROM stock_info"))}
        for c, a in conn.execute(text("SELECT stock_code, alias FROM stock_alias WHERE alias_type <> 'AMBIGUOUS'")):
            names.setdefault(norm(a), c)  # 정식 종목명이 별칭보다 우선
        themes = {}
        for c, t in conn.execute(text("SELECT stock_code, theme FROM stock_theme")):
            themes.setdefault(c, set()).add(t)
        settings = {k: float(v) for k, v in conn.execute(text("SELECT setting_key, setting_value FROM match_setting"))}
    return names, themes, settings


def score(is_main, code, keywords, themes, s):
    """이름이 일치한 종목의 관련도 0~1. 문맥 = 주인공 1 / 조연 0.5. 테마가 키워드에 들어 있으면 그만큼 더함"""
    context = 1.0 if is_main else 0.5
    base = (s["name_weight"] + s["context_weight"] * context) / (s["name_weight"] + s["context_weight"])
    hit = any(t in k for t in themes.get(code, ()) for k in keywords)
    return round(min(1.0, base + (s["theme_weight"] if hit else 0.0)), 2)


def reason_text(c):
    """화면에 나가는 이유. sentiment 는 그날 기준이고 장기 판단은 이유 뒤에 붙인다 (이전 요약에는 long_term 없음)"""
    long_term = {"POSITIVE": "호재", "NEGATIVE": "악재", "NEUTRAL": "중립"}.get(c.get("long_term"))
    return f"{c['reason']} (장기: {long_term})" if long_term else c["reason"]


PAREN = re.compile(r"^(.+?)\s*\((.+)\)$")
DIVISION = re.compile(r"^(.+?)\s+\S*(?:부문|사업부)$")  # "한화 건설부문", "삼성물산 패션부문", "삼성전자 DS부문" (05-2a)


def lookup(names, name):
    """LLM 이 쓴 회사 이름 → 종목코드. 그대로 없으면 "한국항공우주(KAI)" 처럼 괄호를 붙인 이름의 앞·안을 차례로 찾음
    (2026-11-06 04-1: 정답지 v2 개발용에서 괄호 이름 때문에 주인공 2개를 놓침 — D072 KAI, D095 KGM)"""
    code = names.get(norm(name))
    m = None if code else PAREN.match(name.strip())
    if m:
        code = names.get(norm(m.group(1))) or names.get(norm(m.group(2)))
    d = None if code else DIVISION.match(name.strip())
    if d:  # 사업부 표기: 앞의 회사 이름으로 (05-2a: 개발용 D065 "한화 건설부문" 을 놓침)
        code = names.get(norm(d.group(1)))
    return code


LINK_ROLES = ("SUBJECT", "PARTY", "COMPARISON")  # 연결하는 역할 (라벨 기준 v2.1). LISTED 나열·SOURCE 출처·GROUP 그룹은 연결 안 함
UNCERTAIN_FACTS = ("FORECAST", "RUMOR")  # 근거가 이것뿐이면 감성 판단 보류
FACT_TYPES = ("FACT", "PLAN", "FORECAST", "RUMOR")  # article_stock.fact_type (V14) 에 넣는 값. 그 밖(빈 값·이상한 값)은 NULL


def normalize(c):
    """LLM 회사 답을 매칭이 쓰는 꼴로 (05-1): 새 답은 role 로 is_main 을 정하고, 판단 보류(UNCERTAIN)는 감성 NULL.
    role 이 없는 예전 답(11/06 이전)은 is_main 그대로 → 주인공 SUBJECT, 아니면 PARTY 로 봄"""
    role = c.get("role") or ("SUBJECT" if c.get("is_main") else "PARTY")
    sent = c.get("sentiment")
    # 06-1: 근거 문장이 전망·소문이면 판단 보류 (라벨 기준 v2.1 3절 2번). LLM 은 사실 종류를 FORECAST 라 적고도 감성을 단정함
    #       (개발용 3번 실행: FORECAST 연결 20개 중 감성 맞음 2, 정답이 판단 보류 12)
    if c.get("fact_type") in UNCERTAIN_FACTS:
        sent = "UNCERTAIN"
    return {**c, "role": role, "is_main": role == "SUBJECT", "sentiment": None if sent == "UNCERTAIN" else sent}


def match_one(companies, keywords, dictionary, missing=None):
    """[(종목코드, 회사 dict, 점수, 일치한 이름)] — 최소 점수 이상, 종목당 1개 (점수 높은 쪽). 연결하지 않는 역할은 뺌"""
    names, themes, s = dictionary
    best = {}
    for c in map(normalize, companies):
        if c["role"] not in LINK_ROLES:
            continue
        code = lookup(names, c["name"])
        if not code:
            if missing is not None:
                missing[c["name"]] += 1
            continue
        sc = score(c["is_main"], code, keywords, themes, s)
        if sc >= s["min_score"] and (code not in best or sc > best[code][2]):
            best[code] = (code, c, sc, c["name"])
    return list(best.values())


TAG_LINE = re.compile(r"^관련종목.*(?:\n|$)", re.M)


def article_text(body):
    """매칭에 쓰는 본문: 언론사가 붙인 "관련종목…" 목록 줄은 뺌 (04-4a. 새 기사는 step4 가 저장 전에 빼고, 이미 저장된 기사는 여기서)"""
    return TAG_LINE.sub("", body) if body else body


PAST = re.compile(r"(?<!\d)(20\d\d)년|지난해|지난\s?\d{1,2}월")  # 지난 일. "지난 3일"(최근 날짜)은 안 걸리게 월만
CONTRAST = re.compile(r"^(반면|이와 달리|대조적으로)|[와과]\s?달리")


# 06-2 를 끔 (11/06 봉인 시험): 처음 보는 기사 100건에서 정확도 이득이 없고(P 95.9 vs 96.1) 맞는 연결을 실행마다 약 2개 지움
# (R 81.6 vs 86.8). 개발용 틀림 4개를 보고 만든 규칙이라 과적합이었음 → 함수와 시험은 남기고 적용만 끔
USE_BACKGROUND_PARTY = False


def background_party(title, body, item, names, year=None):
    """LLM 이 당사자(PARTY)라 했지만 근거 문장이 지난 일·대비 언급이면 True → 나열로 보고 연결 안 함 (06-2, 라벨 기준 v2.1 2.1절 '배경 언급')
    새 답(근거 번호가 있는 답)에만 씀. 개발용 3번 실행의 당사자 틀림 4개를 다 잡고 맞은 당사자 2개는 안 건드림,
    정답지 밖 120건: 당사자 15개 중 1개("반면 SK하이닉스는…")만 걸렸고 맞게 걸림 — 잡는 양은 적지만 맞는 연결을 버리지 않음"""
    c = item[1]
    if c.get("role") != "PARTY" or "evidence" not in c:
        return False
    ev = evidence(body, item, names, title) or ""
    year = year or datetime.now(KST).year
    past = any(m.group(1) is None or int(m.group(1)) < year for m in PAST.finditer(ev))
    return past or bool(CONTRAST.search(ev))


def on_topic(title, body, found, names, year=None):
    """match_one 결과에서 기사 주제와 맞는 연결만 남긴다. LLM 답이 실행마다 흔들려도 결과가 같아지게 코드로 거름"""
    feature = any(t in title for t in FEATURE_TAGS)
    if not feature and any(w in title for w in TYPE_WORDS):
        return []
    market = not feature and (any(w in title for w in MARKET_WORDS)
                              or (any(w in title for w in MARKET_INDEX) and not NOT_MARKET.search(title)))
    if not body:  # 7일 지나 본문이 지워진 기사는 위치를 볼 수 없어 그대로 둠 (시황은 문장을 볼 수 없으니 예전처럼 버림)
        return [] if market else found
    body = article_text(body)

    def seen(text_, code, name):
        return _seen(text_, code, name, names)

    head, lead, whole = norm(title), norm(body[:LEAD_CHARS]), norm(body)
    for k, v in TITLE_PAIRS.items():
        head = head.replace(k, v)
    if USE_BACKGROUND_PARTY:
        found = [f for f in found if not background_party(title, body, f, names, year)]
    if market:
        return [f for f in found if seen(head, f[0], f[3]) and own_sentence(body, f[0], names)]
    # 04-2 (2026-11-06): 부분 문자열 대신 최장 일치로 셈 → 'SK하이닉스' 안의 '하이닉스'·'SK', 'RISK' 안의 'SK' 를 따로 세지 않음
    stocks = len({c for b, e, c in spans(whole, names) if e - b >= 3})
    if stocks > LIST_TITLED_MAX or (stocks > LIST_MAX and not any(f[1]["is_main"] and seen(head, f[0], f[3]) for f in found)):
        return []
    return [f for f in found if seen(head, f[0], f[3]) or seen(lead, f[0], f[3]) or mentions(whole, f[0], f[3], names) >= MIN_MENTIONS]


def could_link(title, body, names):
    """LLM 을 부르기 전에: 연결될 수 없는 것이 **확실한** 기사만 False (04-6, 감사 A1). False 면 요약(LLM)을 부르지 않음
    - 유형 말머리(부고·인사·지표) 기사 → on_topic 이 항상 []
    - 제목·본문 어디에도 사전 종목 이름(최장 일치)이 없음 → LLM 이 무엇을 답해도 사전에서 못 찾음
    - 시황인데 제목에 종목 이름이 없음 → 시황 규칙(제목 + 자기 문장)을 못 넘음
    on_topic 의 위치·명단·언급 횟수 조건까지 옮기면 14% 를 건너뛰지만, 05 에서 고칠 여러 종목·당사자 기사(정답 있는 개발용 4건)를
    LLM 전에 막아 버림 → 규칙이 바뀌어도 변하지 않는 조건만 씀 (6.5%, 지금 연결 놓침 0, 개발용 정답 기사 0)"""
    feature = any(t in title for t in FEATURE_TAGS)
    if not feature and any(w in title for w in TYPE_WORDS):
        return False
    head = norm(title)
    for k, v in TITLE_PAIRS.items():
        head = head.replace(k, v)
    in_head = bool(spans(head, names))
    market = not feature and (any(w in title for w in MARKET_WORDS)
                              or (any(w in title for w in MARKET_INDEX) and not NOT_MARKET.search(title)))
    if market:
        return in_head
    return in_head or bool(body and spans(norm(article_text(body)), names))


def own_sentence(body, code, names):
    """본문에 그 종목만 나오는 문장이 있나 (시황 기사 규칙, 04-4b). "삼성전자는 7000원(3.06%) 내린 22만2000원" 은 있음,
    "삼성SDI(-4.28%), 두산에너빌리티(-4.49%) 등이 약세" 처럼 여러 종목을 나열한 문장뿐이면 없음"""
    return any({c for _, _, c in spans(norm(s), names)} == {code} for s in sentences(body))


_SPANS = {}  # (사전 id, 글) → spans 결과. 한 기사에서 같은 글을 여러 번 훑지 않게
SPAN_MIN = 2


def _ascii_alnum(ch):
    return ch.isascii() and ch.isalnum()


def spans(text_, names):
    """비교용 글(norm 한 것)에서 사전 이름(2글자 이상)이 나온 자리 [(시작, 끝, 종목코드)] — 최장 일치, 겹치지 않게 (04-2)
    - 같은 자리에 겹치는 이름이 여럿이면 가장 긴 것 하나 ('SK하이닉스' 를 잡으면 그 안의 'SK'·'하이닉스' 는 안 셈)
    - 영문으로 시작·끝나는 이름은 앞·뒤 글자가 영문·숫자면 낱말 일부로 보고 뺌 ('RISK' 의 'SK', 'LGES' 의 'LG')"""
    key = (id(names), text_)
    if key in _SPANS:
        return _SPANS[key]
    hits = []
    for n, c in names.items():
        if len(n) < SPAN_MIN:
            continue
        p = text_.find(n)
        while p >= 0:
            e = p + len(n)
            if not ((_ascii_alnum(n[0]) and p and _ascii_alnum(text_[p - 1]))
                    or (_ascii_alnum(n[-1]) and e < len(text_) and _ascii_alnum(text_[e]))):
                hits.append((p, e, c))
            p = text_.find(n, p + 1)
    taken = []
    for b, e, c in sorted(hits, key=lambda h: (h[0] - h[1], h[0])):  # 긴 것부터, 같으면 앞 자리부터
        if not any(b < te and e > tb for tb, te, _ in taken):
            taken.append((b, e, c))
    if len(_SPANS) > 256:
        _SPANS.clear()
    _SPANS[key] = taken
    return taken


def _seen(text_, code, name, names):
    """비교용 글(norm 한 것)에 그 종목 이름이 있나: LLM 이 쓴 이름(사전에 없는 표기일 때) 또는 사전 이름·별칭의 최장 일치"""
    n = norm(name)
    return (n not in names and n in text_) or any(c == code for _, _, c in spans(text_, names))


def relevance(title, body, found_item, keywords, dictionary):
    """기사 안에서 그 종목이 얼마나 중심인가 0.10~1.00: 제목·첫 부분·주인공·언급 횟수·테마 (위 REL_* 참고)
    본문이 지워진 옛 기사는 위치를 볼 수 없어 예전 점수(score)를 그대로 씀"""
    code, c, sc, name = found_item
    names, themes, _ = dictionary
    if not body:
        return sc
    body = article_text(body)
    head, lead, whole = norm(title), norm(body[:LEAD_CHARS]), norm(body)
    r = REL_TITLE if _seen(head, code, name, names) else REL_LEAD if _seen(lead, code, name, names) else 0.0
    r += REL_MAIN if c["is_main"] else 0.0
    r += REL_MENTION * min(mentions(whole, code, name, names), REL_MENTION_FULL) / REL_MENTION_FULL
    r += REL_THEME if any(t in k for t in themes.get(code, ()) for k in keywords) else 0.0
    return round(min(1.0, max(REL_MIN, r)), 2)


def mentions(text_, code, name, names):
    """본문에 그 종목이 나온 횟수: 사전 이름(3글자 이상)의 최장 일치 자리 수 (04-2).
    LLM 이 쓴 이름이 사전에 없는 표기면 그 이름이 나온 횟수와 큰 쪽"""
    n = norm(name)
    # 이름이 전부 2글자인 종목(SK·LG 등)은 2글자 자리도 셈. 최장 일치·영문 경계 덕에 'SK하이닉스'·'RISK' 안의 SK 는 이미 빠짐
    short_only = not any(len(k) >= 3 for k, c in names.items() if c == code)
    dict_count = sum(1 for b, e, c in spans(text_, names) if c == code and (e - b >= 3 or short_only))
    return max(dict_count, text_.count(n) if n and n not in names else 0)


EVIDENCE_MAX = 300  # 근거 문장 최대 글자


def sentences(body):
    """본문 → 문장 목록 (마침표·물음표·느낌표 뒤 공백, 또는 줄바꿈에서 나눔)"""
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", body or "") if len(s.strip()) >= 10]


LLM_CHARS = 3000  # LLM 에 보여 주는 본문 앞부분 (step5_summary.MAX_CHARS 와 같음)


def numbered(title, body, limit=LLM_CHARS):
    """LLM 에 번호를 붙여 보여 주는 문장 목록 (05-1): 0 = 제목, 1~ = 본문 앞 limit 자의 문장. 근거 번호를 다시 문장으로 바꿀 때도 씀"""
    return [title] + sentences(article_text(body or "")[:limit])


def _named(text_, code, name, names):
    """그 종목 이름이 글에 있나. LLM 이 "KG모빌리티(KGM)" 처럼 괄호를 붙여 쓰면 앞·안을 따로 봄
    (13: 개발용 D095 제목 "KGM, 3분기 적자전환…" 을 이름 없음으로 보고 버렸음)"""
    p = PAREN.match(name.strip())
    return any(_seen(text_, code, n, names) for n in [name] + ([p.group(1), p.group(2)] if p else []))


def evidence(body, item, names, title=None):
    """근거 문장 (F-06). LLM 이 근거 문장 번호를 골랐으면(05-1) 그 문장, 아니면(예전 답·번호 잘못) 예전 방식:
    그 종목 이름이 나온 문장 중 LLM 이유와 단어가 가장 많이 겹치는 문장. 이름이 나온 문장이 없으면 None"""
    code, c, _, name = item
    i = c.get("evidence")
    picked = None
    if isinstance(i, int) and not isinstance(i, bool) and title is not None:
        sents = numbered(title, body)
        if 0 <= i < len(sents):
            picked = sents[i][:EVIDENCE_MAX]
            # 06-3: 화면에 "이 종목의 근거"로 나가므로 그 종목 이름이 있어야 함. 없으면(개발용 152개 중 14%) 아래 방식으로 이름이 있는 문장
            # 13: "앞 문장에 이어지는 문장(주어 생략)도 살리기"를 시험했지만 가린 판정에서 나아지지 않아 뺌 — 화면엔 문장 하나만 보여
            #     이름 없는 문장은 누구 이야기인지 모름 (06-3 의 이유가 맞음). 괄호 이름만 고침
            if _named(norm(picked), code, name, names):
                return picked
    words = {norm(name)} | {n for n, cc in names.items() if cc == code and len(n) >= 2}
    reason = set(re.findall(r"[가-힣A-Za-z0-9]{2,}", c.get("reason", "")))
    best, best_score = None, -1
    for s in sentences(article_text(body)):
        if not any(w in norm(s) for w in words):
            continue
        overlap = sum(1 for w in reason if w in s)
        if overlap > best_score:
            best, best_score = s, overlap
    return best[:EVIDENCE_MAX] if best else picked  # 이름 있는 문장이 하나도 없으면 LLM 이 고른 문장이라도


def has_fact_type(engine):
    """article_stock.fact_type 칸(V14)이 있나. 백엔드보다 AI 가 먼저 켜진 PC 에서도 매칭이 실패하지 않게 (없으면 빼고 넣음)"""
    sql = text("""SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
                  AND table_name = 'article_stock' AND column_name = 'fact_type'""")
    with engine.connect() as conn:
        return bool(conn.execute(sql).scalar())


def match_articles(engine=None, statuses=("SUMMARIZED",)):
    engine = engine or get_engine()
    dictionary = load_dictionary(engine)
    fact_col = has_fact_type(engine)  # V14: 근거 문장의 사실 종류(FACT/PLAN/FORECAST/RUMOR)를 화면에 보여 주려고 저장
    # 이미 매칭한 기사(DONE·NO_STOCK)를 규칙을 바꾼 뒤 다시 매칭할 때, 본문이 7일 지나 지워진 기사는 빼고 예전 결과를 그대로 둠.
    # 본문이 없으면 on_topic 의 본문 검사(앞 200자·2번 이상 등장)를 못 해서 예전에 걸러진 종목이 되살아남
    # (2026-11-10 지승현 지적. 로컬 DB 로 재 보니 본문을 지운 채 다시 매칭하면 연결 +423개, NO_STOCK 131건이 화면에 다시 나옴)
    sql = text("""SELECT article_id, title, body, keywords, companies, published_at FROM article
                  WHERE status IN :st AND companies IS NOT NULL
                    AND (status = 'SUMMARIZED' OR (body IS NOT NULL AND body <> ''))"""
               ).bindparams(bindparam("st", expanding=True))
    with engine.connect() as conn:
        rows = conn.execute(sql, {"st": list(statuses)}).all()
    done = no_stock = 0
    missing = Counter()  # 사전에 없는 회사 이름 → 별칭 추가 후보
    for r in rows:
        keywords = (r.keywords or "").split(",")
        found = match_one(json.loads(r.companies), keywords, dictionary, missing)
        found = on_topic(r.title, r.body, found, dictionary[0], r.published_at.year if r.published_at else None)
        with engine.begin() as conn:  # 한 기사의 연결 지우기·넣기·상태 바꾸기를 한 번에
            # 본문이 7일 지나 지워진 기사는 근거를 다시 뽑을 수 없으므로 예전 근거를 이어 씀
            old = dict(conn.execute(text("SELECT stock_code, evidence FROM article_stock WHERE article_id = :id"),
                                    {"id": r.article_id}).all())
            conn.execute(text("DELETE FROM article_stock WHERE article_id = :id"), {"id": r.article_id})
            for item in found:
                code, c, sc, name = item
                fact = c.get("fact_type") if c.get("fact_type") in FACT_TYPES else None
                conn.execute(text(f"""INSERT INTO article_stock (article_id, stock_code, is_main, sentiment, reason,
                                         match_type, relevance, evidence, matched_keywords{', fact_type' if fact_col else ''})
                                     VALUES (:id, :code, :main, :sent, :reason, 'DIRECT', :rel, :ev, :kw{', :fact' if fact_col else ''})"""),
                             {"id": r.article_id, "code": code, "main": c["is_main"], "sent": c["sentiment"],
                              "reason": reason_text(c)[:500], "rel": relevance(r.title, r.body, item, keywords, dictionary),
                              "ev": evidence(r.body, item, dictionary[0], r.title) if r.body else old.get(code),
                              "kw": name[:300], "fact": fact})
            conn.execute(text("UPDATE article SET status = :st WHERE article_id = :id"),
                         {"st": "DONE" if found else "NO_STOCK", "id": r.article_id})
        done, no_stock = done + bool(found), no_stock + (not found)
    log.info("종목 매칭: %d건 중 DONE %d, NO_STOCK %d", len(rows), done, no_stock)
    if missing:
        log.info("사전에 없는 회사: %s", ", ".join(f"{n}({k})" for n, k in missing.most_common(50)))
    return done
