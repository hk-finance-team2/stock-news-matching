"""6단계 (23~25번): 요약에서 LLM 이 뽑은 회사 이름(article.companies)을 종목에 연결 → DONE / NO_STOCK

    from hk_llm.steps.step6_match import match_articles
    match_articles()                                         # SUMMARIZED 기사 매칭
    match_articles(statuses=("SUMMARIZED", "DONE", "NO_STOCK"))  # 규칙을 바꾼 뒤 전부 다시 매칭 (LLM 안 부름, 비용 0)

- 종목 사전: stock_info(종목명) + stock_alias(별칭) + stock_theme(테마), 백엔드가 채움
- 범위: stock_info 전체 (코스피+코스닥, 결정사항 2번)
- 점수 (match_setting 가중치 사용): 이름이 맞으면 기본 통과, 테마가 맞으면 점수만 올림 🧪 (2026-11-02)
  키워드가 테마와 안 맞아도 깎지 않음: 삼성전자 '3분기 실적' 기사가 테마 때문에 탈락하면 안 되므로
- 주제 확인 (on_topic) 🧪 (2026-11-03): 시황·전망·지표 기사와 명단 기사는 연결 안 함, 그 밖에는 제목이나 본문 앞부분에 이름이 있거나 본문에 2번 이상 나와야 연결 (2번 조건 2026-11-03 추가)
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
        return norm(name) in text_ or any(n in text_ for n, c in names.items() if c == code and len(n) >= 2)

    head, lead, whole = norm(title), norm(body[:LEAD_CHARS]), norm(body)
    # ponytail: 부분 문자열 비교라 '이닉스' 가 SK하이닉스에도 걸림. 명단 판단에만 쓰므로 둠, 오판이 나오면 최장 일치로
    stocks = len({c for n, c in names.items() if len(n) >= 3 and n in whole})
    if stocks > LIST_TITLED_MAX or (stocks > LIST_MAX and not any(f[1]["is_main"] and seen(head, f[0], f[3]) for f in found)):
        return []
    return [f for f in found if seen(head, f[0], f[3]) or seen(lead, f[0], f[3]) or mentions(whole, f[0], f[3], names) >= MIN_MENTIONS]


def mentions(text_, code, name, names):
    """본문에 그 종목이 나온 횟수: LLM 이 쓴 이름과 사전 이름(3글자 이상) 중 가장 많이 나온 것 (겹쳐 세지 않게 최댓값)"""
    words = {norm(name)} | {n for n, c in names.items() if c == code and len(n) >= 3}
    return max(text_.count(w) for w in words if w)


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
        found = match_one(json.loads(r.companies), (r.keywords or "").split(","), dictionary, missing)
        found = on_topic(r.title, r.body, found, dictionary[0])
        with engine.begin() as conn:  # 한 기사의 연결 지우기·넣기·상태 바꾸기를 한 번에
            conn.execute(text("DELETE FROM article_stock WHERE article_id = :id"), {"id": r.article_id})
            for code, c, sc, name in found:
                conn.execute(text("""INSERT INTO article_stock (article_id, stock_code, is_main, sentiment, reason,
                                         match_type, relevance, matched_keywords)
                                     VALUES (:id, :code, :main, :sent, :reason, 'DIRECT', :rel, :kw)"""),
                             {"id": r.article_id, "code": code, "main": c["is_main"], "sent": c["sentiment"],
                              "reason": reason_text(c)[:500], "rel": sc, "kw": name[:300]})
            conn.execute(text("UPDATE article SET status = :st WHERE article_id = :id"),
                         {"st": "DONE" if found else "NO_STOCK", "id": r.article_id})
        done, no_stock = done + bool(found), no_stock + (not found)
    log.info("종목 매칭: %d건 중 DONE %d, NO_STOCK %d", len(rows), done, no_stock)
    if missing:
        log.info("사전에 없는 회사: %s", ", ".join(f"{n}({k})" for n, k in missing.most_common(50)))
    return done
