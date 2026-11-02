"""6단계 (23~25번): 요약에서 LLM 이 뽑은 회사 이름(article.companies)을 종목에 연결 → DONE / NO_STOCK

    from hk_llm.step6_match import match_articles
    match_articles()                                         # SUMMARIZED 기사 매칭
    match_articles(statuses=("SUMMARIZED", "DONE", "NO_STOCK"))  # 규칙을 바꾼 뒤 전부 다시 매칭 (LLM 안 부름, 비용 0)

- 종목 사전: stock_info(종목명) + stock_alias(별칭) + stock_theme(테마), 백엔드가 채움
- 범위: stock_info 전체 (코스피+코스닥, 결정사항 2번)
- 점수 (match_setting): 종목명 0.4 · 테마 0.4 · 문맥 0.2, 최소 0.7
  🧪 시험 가정: 그 종목에 등록된 테마가 없으면 테마를 빼고 나머지 가중치끼리 비율로 계산
- 결과: article_stock 에 기사 1 : 종목 N. 다시 매칭하면 그 기사의 연결을 지우고 새로 넣음
"""
import json
import re

from sqlalchemy import bindparam, text

from hk_llm.db import get_engine
from hk_llm.util import get_logger

log = get_logger(__name__)


def norm(name):
    """비교용 이름: (주)·㈜·주식회사·공백 제거, 영문 대문자"""
    return re.sub(r"\(주\)|㈜|주식회사|\s", "", name).upper()


def load_dictionary(engine):
    """{비교용 이름: 종목코드}, {종목코드: 테마 set}, 설정값 dict"""
    with engine.connect() as conn:
        names = {norm(n): c for c, n in conn.execute(text("SELECT stock_code, stock_name FROM stock_info"))}
        for c, a in conn.execute(text("SELECT stock_code, alias FROM stock_alias")):
            names.setdefault(norm(a), c)  # 정식 종목명이 별칭보다 우선
        themes = {}
        for c, t in conn.execute(text("SELECT stock_code, theme FROM stock_theme")):
            themes.setdefault(c, set()).add(t)
        settings = {k: float(v) for k, v in conn.execute(text("SELECT setting_key, setting_value FROM match_setting"))}
    return names, themes, settings


def score(is_main, code, keywords, themes, s):
    """이름이 일치한 종목의 관련도 0~1. 이름 일치 = 1, 테마 = 키워드가 그 종목 테마에 있으면 1, 문맥 = 주인공 1 / 조연 0.5"""
    parts = {"name_weight": 1.0, "context_weight": 1.0 if is_main else 0.5}
    if themes.get(code):  # 🧪 테마가 등록된 종목만 테마 점수를 셈
        parts["theme_weight"] = 1.0 if themes[code] & set(keywords) else 0.0
    total_w = sum(s[k] for k in parts)
    return round(sum(s[k] * v for k, v in parts.items()) / total_w, 2)


def reason_text(c):
    """화면에 나가는 이유. sentiment 는 그날 기준이고 장기 판단은 이유 뒤에 붙인다 (이전 요약에는 long_term 없음)"""
    long_term = {"POSITIVE": "호재", "NEGATIVE": "악재", "NEUTRAL": "중립"}.get(c.get("long_term"))
    return f"{c['reason']} (장기: {long_term})" if long_term else c["reason"]


def match_one(companies, keywords, dictionary):
    """[(종목코드, 회사 dict, 점수, 일치한 이름)] — 최소 점수 이상, 종목당 1개 (점수 높은 쪽)"""
    names, themes, s = dictionary
    best = {}
    for c in companies:
        code = names.get(norm(c["name"]))
        if not code:
            continue
        sc = score(c["is_main"], code, keywords, themes, s)
        if sc >= s["min_score"] and (code not in best or sc > best[code][2]):
            best[code] = (code, c, sc, c["name"])
    return list(best.values())


def match_articles(engine=None, statuses=("SUMMARIZED",)):
    engine = engine or get_engine()
    dictionary = load_dictionary(engine)
    sql = text("SELECT article_id, keywords, companies FROM article WHERE status IN :st AND companies IS NOT NULL"
               ).bindparams(bindparam("st", expanding=True))
    with engine.connect() as conn:
        rows = conn.execute(sql, {"st": list(statuses)}).all()
    done = no_stock = 0
    for r in rows:
        found = match_one(json.loads(r.companies), (r.keywords or "").split(","), dictionary)
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
    return done


if __name__ == "__main__":
    # 점수·매칭 규칙 시험 (DB 없이)
    s = {"name_weight": 0.4, "theme_weight": 0.4, "context_weight": 0.2, "min_score": 0.7}
    assert norm("(주) LG 씨엔에스") == "LG씨엔에스" and norm("hl만도") == "HL만도"
    assert score(True, "A", [], {}, s) == 1.0  # 테마 없음: (0.4 + 0.2) / 0.6
    assert score(False, "A", [], {}, s) == 0.83  # 조연: (0.4 + 0.1) / 0.6
    assert score(True, "A", ["HBM"], {"A": {"HBM"}}, s) == 1.0
    assert score(False, "A", ["금리"], {"A": {"HBM"}}, s) == 0.5  # 테마 불일치 조연: 0.4 + 0 + 0.1 → 탈락
    d = ({"HL만도": "204320", "샘표": "007540"}, {}, s)
    got = match_one([{"name": "HL만도", "is_main": True, "sentiment": "NEGATIVE", "reason": "r"},
                     {"name": "샘표", "is_main": True, "sentiment": "POSITIVE", "reason": "r"},
                     {"name": "바이낸스", "is_main": False, "sentiment": "NEUTRAL", "reason": "r"}], [], d)
    assert [g[0] for g in got] == ["204320", "007540"], got  # 사전에 없는 바이낸스는 빠짐
    assert reason_text({"reason": "수주", "long_term": "POSITIVE"}) == "수주 (장기: 호재)"
    assert reason_text({"reason": "수주"}) == "수주"
    print("ok")
