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

from sqlalchemy import bindparam, text

from hk_llm.core.db import get_engine
from hk_llm.core.util import get_logger

log = get_logger(__name__)

TYPE_WORDS = ("시황", "주간전망", "증시 전망", "증시전망", "산업생산", "생산지표", "CPI", "소비자물가", "고용지표",
              "[마켓노트]", "[마켓뷰]", "[부고]", "[인사]")  # 제목에 있으면 특정 회사 기사가 아님
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


def match_one(companies, keywords, dictionary, missing=None):
    """[(종목코드, 회사 dict, 점수, 일치한 이름)] — 최소 점수 이상, 종목당 1개 (점수 높은 쪽)"""
    names, themes, s = dictionary
    best = {}
    for c in companies:
        code = names.get(norm(c["name"]))
        if not code:
            if missing is not None:
                missing[c["name"]] += 1
            continue
        sc = score(c["is_main"], code, keywords, themes, s)
        if sc >= s["min_score"] and (code not in best or sc > best[code][2]):
            best[code] = (code, c, sc, c["name"])
    return list(best.values())


def on_topic(title, body, found, names):
    """match_one 결과에서 기사 주제와 맞는 연결만 남긴다. LLM 답이 실행마다 흔들려도 결과가 같아지게 코드로 거름"""
    if "[특징주]" not in title and any(w in title for w in TYPE_WORDS):
        return []
    if not body:  # 7일 지나 본문이 지워진 기사는 위치를 볼 수 없어 그대로 둠
        return found

    def seen(text_, code, name):
        return _seen(text_, code, name, names)

    head, lead, whole = norm(title), norm(body[:LEAD_CHARS]), norm(body)
    # ponytail: 부분 문자열 비교라 '이닉스' 가 SK하이닉스에도 걸림. 명단 판단에만 쓰므로 둠, 오판이 나오면 최장 일치로
    stocks = len({c for n, c in names.items() if len(n) >= 3 and n in whole})
    if stocks > LIST_TITLED_MAX or (stocks > LIST_MAX and not any(f[1]["is_main"] and seen(head, f[0], f[3]) for f in found)):
        return []
    return [f for f in found if seen(head, f[0], f[3]) or seen(lead, f[0], f[3]) or mentions(whole, f[0], f[3], names) >= MIN_MENTIONS]


def _seen(text_, code, name, names):
    """비교용 글(norm 한 것)에 그 종목 이름이 있나: LLM 이 쓴 이름 또는 사전 이름·별칭(2글자 이상)"""
    return norm(name) in text_ or any(n in text_ for n, c in names.items() if c == code and len(n) >= 2)


def relevance(title, body, found_item, keywords, dictionary):
    """기사 안에서 그 종목이 얼마나 중심인가 0.10~1.00: 제목·첫 부분·주인공·언급 횟수·테마 (위 REL_* 참고)
    본문이 지워진 옛 기사는 위치를 볼 수 없어 예전 점수(score)를 그대로 씀"""
    code, c, sc, name = found_item
    names, themes, _ = dictionary
    if not body:
        return sc
    head, lead, whole = norm(title), norm(body[:LEAD_CHARS]), norm(body)
    r = REL_TITLE if _seen(head, code, name, names) else REL_LEAD if _seen(lead, code, name, names) else 0.0
    r += REL_MAIN if c["is_main"] else 0.0
    r += REL_MENTION * min(mentions(whole, code, name, names), REL_MENTION_FULL) / REL_MENTION_FULL
    r += REL_THEME if any(t in k for t in themes.get(code, ()) for k in keywords) else 0.0
    return round(min(1.0, max(REL_MIN, r)), 2)


def mentions(text_, code, name, names):
    """본문에 그 종목이 나온 횟수: LLM 이 쓴 이름과 사전 이름(3글자 이상) 중 가장 많이 나온 것 (겹쳐 세지 않게 최댓값)"""
    words = {norm(name)} | {n for n, c in names.items() if c == code and len(n) >= 3}
    return max(text_.count(w) for w in words if w)


EVIDENCE_MAX = 300  # 근거 문장 최대 글자


def sentences(body):
    """본문 → 문장 목록 (마침표·물음표·느낌표 뒤 공백, 또는 줄바꿈에서 나눔)"""
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", body or "") if len(s.strip()) >= 10]


def evidence(body, item, names):
    """근거 문장 (F-06): 그 종목 이름이 나온 문장 중 LLM 이유와 단어가 가장 많이 겹치는 문장 (같으면 앞 문장). LLM 비용 0
    이름이 나온 문장이 없으면 None"""
    code, c, _, name = item
    words = {norm(name)} | {n for n, cc in names.items() if cc == code and len(n) >= 2}
    reason = set(re.findall(r"[가-힣A-Za-z0-9]{2,}", c.get("reason", "")))
    best, best_score = None, -1
    for s in sentences(body):
        if not any(w in norm(s) for w in words):
            continue
        overlap = sum(1 for w in reason if w in s)
        if overlap > best_score:
            best, best_score = s, overlap
    return best[:EVIDENCE_MAX] if best else None


def match_articles(engine=None, statuses=("SUMMARIZED",)):
    engine = engine or get_engine()
    dictionary = load_dictionary(engine)
    sql = text("SELECT article_id, title, body, keywords, companies FROM article WHERE status IN :st AND companies IS NOT NULL"
               ).bindparams(bindparam("st", expanding=True))
    with engine.connect() as conn:
        rows = conn.execute(sql, {"st": list(statuses)}).all()
    done = no_stock = 0
    missing = Counter()  # 사전에 없는 회사 이름 → 별칭 추가 후보
    for r in rows:
        keywords = (r.keywords or "").split(",")
        found = match_one(json.loads(r.companies), keywords, dictionary, missing)
        found = on_topic(r.title, r.body, found, dictionary[0])
        with engine.begin() as conn:  # 한 기사의 연결 지우기·넣기·상태 바꾸기를 한 번에
            # 본문이 7일 지나 지워진 기사는 근거를 다시 뽑을 수 없으므로 예전 근거를 이어 씀
            old = dict(conn.execute(text("SELECT stock_code, evidence FROM article_stock WHERE article_id = :id"),
                                    {"id": r.article_id}).all())
            conn.execute(text("DELETE FROM article_stock WHERE article_id = :id"), {"id": r.article_id})
            for item in found:
                code, c, sc, name = item
                conn.execute(text("""INSERT INTO article_stock (article_id, stock_code, is_main, sentiment, reason,
                                         match_type, relevance, evidence, matched_keywords)
                                     VALUES (:id, :code, :main, :sent, :reason, 'DIRECT', :rel, :ev, :kw)"""),
                             {"id": r.article_id, "code": code, "main": c["is_main"], "sent": c["sentiment"],
                              "reason": reason_text(c)[:500], "rel": relevance(r.title, r.body, item, keywords, dictionary),
                              "ev": evidence(r.body, item, dictionary[0]) if r.body else old.get(code),
                              "kw": name[:300]})
            conn.execute(text("UPDATE article SET status = :st WHERE article_id = :id"),
                         {"st": "DONE" if found else "NO_STOCK", "id": r.article_id})
        done, no_stock = done + bool(found), no_stock + (not found)
    log.info("종목 매칭: %d건 중 DONE %d, NO_STOCK %d", len(rows), done, no_stock)
    if missing:
        log.info("사전에 없는 회사: %s", ", ".join(f"{n}({k})" for n, k in missing.most_common(50)))
    return done
