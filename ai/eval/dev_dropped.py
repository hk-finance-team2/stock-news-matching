"""개발용 (정답지 밖 기사만): 주제 확인(on_topic)의 '제목·본문 앞부분' 조건 때문에 버려진 연결을 모아 봄

    python -m eval.dev_dropped [개수]     (ai 폴더에서)

정답지 기사는 빼고 본다 → 여기서 규칙을 정해도 정답지 점수가 부풀지 않음
시황 제목·명단 기사로 통째로 막힌 기사는 빼고, '위치' 조건만으로 빠진 연결만:
처음 나온 위치(글자), 본문에 나온 횟수, LLM 이 주인공이라 했나, LLM 이유, 이름 주변 문장
"""
import json
import random
import sys

from sqlalchemy import text

from eval.score import load_gold
from hk_llm.core.db import get_engine
from hk_llm.steps.step6_match import (LEAD_CHARS, LIST_MAX, LIST_TITLED_MAX, TYPE_WORDS, load_dictionary, match_one,
                                      norm, on_topic)


def blocked_whole(title, body, found, names):
    """시황·전망 제목이거나 명단 기사라 기사 전체가 막혔나 (on_topic 의 앞 두 조건)"""
    if "[특징주]" not in title and any(w in title for w in TYPE_WORDS):
        return True
    stocks = len({c for n, c in names.items() if len(n) >= 3 and n in norm(body)})
    head = norm(title)
    main_in_title = any(f[1]["is_main"] and (norm(f[3]) in head) for f in found)
    return stocks > LIST_TITLED_MAX or (stocks > LIST_MAX and not main_in_title)


def main(n=40):
    engine = get_engine()
    gold = {g["url_key"] for g in load_gold()}
    dictionary = load_dictionary(engine)
    names = dictionary[0]
    with engine.connect() as conn:
        rows = conn.execute(text("""SELECT url_key, title, body, keywords, companies FROM article
                                    WHERE status IN ('DONE', 'NO_STOCK') AND channel IN ('RSS', 'SITEMAP')
                                      AND body IS NOT NULL AND companies IS NOT NULL""")).all()
        stock_name = dict(conn.execute(text("SELECT stock_code, stock_name FROM stock_info")).all())
    dev = [r for r in rows if r.url_key not in gold]
    dropped = []
    for r in dev:
        found = match_one(json.loads(r.companies), (r.keywords or "").split(","), dictionary)
        if not found or blocked_whole(r.title, r.body, found, names):
            continue
        kept = {f[0] for f in on_topic(r.title, r.body, found, names)}
        for code, c, sc, name in found:
            if code in kept:
                continue
            words = {c["name"], stock_name[code]}
            hits = [r.body.find(w) for w in words if r.body.find(w) >= 0]
            pos = min(hits) if hits else -1
            cnt = sum(r.body.count(w) for w in words)
            around = r.body[max(0, pos - 60):pos + 90].replace("\n", " ") if pos >= 0 else ""
            dropped.append((r.title, stock_name[code], c["is_main"], pos, cnt, c["reason"], around, bool(kept)))
    print(f"정답지 밖 기사 {len(dev)}건에서 위치 조건으로 버려진 연결 {len(dropped)}개")
    print(f"  LLM 이 주인공이라 한 것 {sum(d[2] for d in dropped)}개, 본문 2번 이상 {sum(d[4] >= 2 for d in dropped)}개, "
          f"처음 위치 500자 안 {sum(0 <= d[3] < 500 for d in dropped)}개")
    random.Random(7).shuffle(dropped)
    for t, name, main, pos, cnt, reason, around, other in dropped[:n]:
        print(f"\n- [{name}] {'주인공' if main else '조연'} · 처음 {pos}자 · {cnt}번 · 같은 기사 다른 종목 연결 {other}"
              f"\n  제목: {t}\n  LLM 이유: {reason}\n  …{around}…")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 40)
