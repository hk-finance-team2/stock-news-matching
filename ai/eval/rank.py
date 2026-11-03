"""관련도(relevance)가 순서를 잘 매기나 — 숫자만 출력

    python -m eval.rank          (ai 폴더에서)

- 순위 정확도(AUC): 정답지에서 '주인공'인 연결과 '조연'인 연결을 하나씩 짝지었을 때 주인공의 관련도가 더 높은 비율
  (같으면 0.5 로 셈). 0.5 = 동전 던지기, 1.0 = 항상 주인공이 위
- 분포: 지금 DB 의 모든 연결(공시 제외)에서 관련도 값이 몇 가지로 퍼져 있나
"""
from collections import Counter

from sqlalchemy import bindparam, text

from eval.score import load_gold
from hk_llm.core.db import get_engine


def auc(pos, neg):
    if not pos or not neg:
        return None
    wins = sum(1.0 if p > n else 0.5 if p == n else 0.0 for p in pos for n in neg)
    return round(wins / (len(pos) * len(neg)), 3)


def main():
    engine = get_engine()
    gold = load_gold()
    sql = text("""SELECT a.url_key, s.stock_code, s.relevance FROM article a JOIN article_stock s USING (article_id)
                  WHERE a.url_key IN :k""").bindparams(bindparam("k", expanding=True))
    with engine.connect() as conn:
        rel = {(r.url_key, r.stock_code): float(r.relevance) for r in conn.execute(sql, {"k": [g["url_key"] for g in gold]})}
        dist = Counter(float(r[0]) for r in conn.execute(text(
            "SELECT s.relevance FROM article_stock s JOIN article a USING (article_id) WHERE a.channel <> 'DART' AND s.relevance IS NOT NULL")))
    main_r, side_r = [], []
    for g in gold:
        for s in g["stocks"]:
            v = rel.get((g["url_key"], s["code"]))
            if v is not None:
                (main_r if s["main"] else side_r).append(v)
    print(f"정답지의 맞은 연결: 주인공 {len(main_r)}개, 조연 {len(side_r)}개")
    print(f"평균 관련도: 주인공 {sum(main_r) / len(main_r):.2f}, 조연 {sum(side_r) / len(side_r):.2f}")
    print(f"순위 정확도(AUC) {auc(main_r, side_r)}")
    print(f"전체 연결 {sum(dist.values())}개, 관련도 값 {len(dist)}가지, 많은 순: {dist.most_common(5)}")


if __name__ == "__main__":
    main()
