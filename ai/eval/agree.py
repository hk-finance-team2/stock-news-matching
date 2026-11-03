"""두 심판 일치율: 같은 기사를 서로 모르는 두 심판이 따로 라벨링했을 때 얼마나 같은가 (정답지를 믿을 근거)

    python -m eval.agree --pick     심판 2가 볼 표본 번호 30개를 고름 → eval/judge2_idx.txt
    python -m eval.agree            eval/gold.jsonl(심판 1) vs eval/gold_judge2.jsonl(심판 2), 숫자만 출력

- 기사 일치: 연결 종목 목록이 완전히 같은 기사 비율 ("연결 없음"끼리도 같음으로 셈)
- 연결 일치: 두 심판의 (기사, 종목) 쌍의 겹침 = 2 × 공통 ÷ (심판1 + 심판2)  (F1 과 같은 식, 한쪽을 정답으로 보지 않음)
- 공통 연결 중 직접/간접·주인공/조연·감성이 같은 비율
"""
import json
import random
import sys
from pathlib import Path

from eval.score import load_gold

HERE = Path(__file__).parent
SEED = 3011
N = 30


def pick():
    keys = json.loads((HERE / "sample.json").read_text(encoding="utf-8"))["url_keys"]
    idx = sorted(random.Random(SEED).sample(range(len(keys)), N))
    (HERE / "judge2_idx.txt").write_text(",".join(map(str, idx)), encoding="utf-8")
    print(f"{N}개 → judge2_idx.txt")


def agree(a, b):
    a = {g["url_key"]: {s["code"]: s for s in g["stocks"]} for g in a}
    b = {g["url_key"]: {s["code"]: s for s in g["stocks"]} for g in b}
    keys = [k for k in b if k in a]
    same_article = sum(set(a[k]) == set(b[k]) for k in keys)
    pa = {(k, c) for k in keys for c in a[k]}
    pb = {(k, c) for k in keys for c in b[k]}
    both = pa & pb
    field = {f: sum(a[k][c][f] == b[k][c][f] for k, c in both) for f in ("type", "main", "sentiment")}
    return {
        "articles": len(keys),
        "article_same": same_article,
        "links_a": len(pa), "links_b": len(pb), "links_both": len(both),
        "link_agree": round(2 * len(both) / (len(pa) + len(pb)), 3) if pa or pb else None,
        **{f"{f}_same": n for f, n in field.items()},
    }


def main():
    r = agree(load_gold(), load_gold(HERE / "gold_judge2.jsonl"))
    print(f"기사 {r['articles']}건: 연결 목록이 완전히 같은 기사 {r['article_same']}건 ({r['article_same'] / r['articles']:.0%})")
    print(f"연결: 심판1 {r['links_a']}개, 심판2 {r['links_b']}개, 공통 {r['links_both']}개 → 연결 일치 {r['link_agree']}")
    n = r["links_both"] or 1
    print(f"공통 연결 중 같음: 직접/간접 {r['type_same']}/{r['links_both']}, 주인공/조연 {r['main_same']}/{r['links_both']} "
          f"({r['main_same'] / n:.0%}), 감성 {r['sentiment_same']}/{r['links_both']} ({r['sentiment_same'] / n:.0%})")


if __name__ == "__main__":
    pick() if "--pick" in sys.argv else main()
