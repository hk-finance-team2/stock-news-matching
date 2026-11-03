"""놓침·틀림이 매칭의 어느 단계에서 생겼나 — 개수만 출력 (개선하는 쪽이 정답 내용을 보지 않게)

    python -m eval.why          (ai 폴더에서)

매칭 단계 (step6): LLM 이 뽑은 회사 이름(article.companies) → 사전에서 종목코드 → 점수 → 주제 확인(on_topic) → 연결
놓친 연결(정답에 있는데 AI 가 안 함)마다 처음 빠진 단계를 셈:
  A1 LLM 회사 목록에 그 회사가 없음
  A2 목록에 있지만 사전에 없는 표기 (예: '현대자동차그룹', 공백·영문 표기 차이)
  B  점수가 최소 점수 미만
  C1 주제 확인: 제목이 시황·전망 유형        C2 주제 확인: 명단 기사로 판단
  C3 주제 확인: 제목·본문 앞부분에 이름이 없음
  D  기사가 요약·매칭 전이거나 본문 없음
"""
import json
from collections import Counter

from sqlalchemy import bindparam, text

from eval.score import load_gold, predictions
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import (LEAD_CHARS, LIST_MAX, LIST_TITLED_MAX, TYPE_WORDS, load_dictionary, norm,
                                      on_topic, score)


def names_of(code, names):
    return [n for n, c in names.items() if c == code]


def stage(code, art, dictionary):
    names, themes, s = dictionary
    if not art.companies or not art.body:
        return "D"
    companies = json.loads(art.companies)
    mapped = [c for c in companies if names.get(norm(c["name"])) == code]
    if not mapped:
        mine = [n for n in names_of(code, names) if len(n) >= 2]
        loose = any(any(n in norm(c["name"]) or norm(c["name"]) in n for n in mine)
                    for c in companies if norm(c["name"]) not in names)
        return "A2" if loose else "A1"
    c = max(mapped, key=lambda x: x["is_main"])
    sc = score(c["is_main"], code, (art.keywords or "").split(","), themes, s)
    if sc < s["min_score"]:
        return "B"
    found = [(code, c, sc, c["name"])]
    if on_topic(art.title, art.body, found, names):
        return "OK?"  # 규칙상 연결돼야 하는데 DB 에는 없음 (다시 매칭 전)
    if "[특징주]" not in art.title and any(w in art.title for w in TYPE_WORDS):
        return "C1"
    whole = norm(art.body)
    stocks = len({cc for n, cc in names.items() if len(n) >= 3 and n in whole})
    head, lead = norm(art.title), norm(art.body[:LEAD_CHARS])
    in_head = any(n in head for n in names_of(code, names) + [norm(c["name"])])
    if stocks > LIST_TITLED_MAX or (stocks > LIST_MAX and not (c["is_main"] and in_head)):
        return "C2"
    return "C3"


def main():
    engine = get_engine()
    gold = load_gold()
    keys = [g["url_key"] for g in gold]
    pred = predictions(engine, keys)
    dictionary = load_dictionary(engine)
    sql = text("SELECT url_key, title, body, keywords, companies FROM article WHERE url_key IN :k"
               ).bindparams(bindparam("k", expanding=True))
    with engine.connect() as conn:
        arts = {r.url_key: r for r in conn.execute(sql, {"k": keys})}
    miss, wrong = Counter(), Counter()
    for g in gold:
        truth = {s["code"]: s for s in g["stocks"]}
        got = pred[g["url_key"]]
        for code in truth:
            if code not in got:
                miss[stage(code, arts[g["url_key"]], dictionary)] += 1
        for code in got:
            if code not in truth:
                wrong["정답에 연결 없는 기사" if not truth else "다른 종목은 맞는 기사"] += 1
    print("놓침", sum(miss.values()), "개 — 처음 빠진 단계:")
    for k in ("A1", "A2", "B", "C1", "C2", "C3", "D", "OK?"):
        if miss[k]:
            print(f"  {k:3} {miss[k]}")
    print("틀린 연결", sum(wrong.values()), "개:", dict(wrong))


if __name__ == "__main__":
    main()
