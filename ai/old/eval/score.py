"""라벨로 점수 계산. 파이프라인에서 안 씀. 입력은 eval.sample 표본과 labels.json, DB 안 씀

    python -m eval.score
"""
import json
from collections import Counter
from math import sqrt
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "hk_llm" / "data" / "eval"
SENT = ("POSITIVE", "NEGATIVE", "NEUTRAL")


def wilson(k, n, z=1.96):
    """95% 구간 (소표본에서 정규 근사보다 안전)"""
    if not n:
        return (0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return max(0.0, c - h), min(1.0, c + h)


def rate(name, k, n):
    lo, hi = wilson(k, n)
    print(f"{name}: {k}/{n} = {k / n:.1%} (95% {lo:.0%}~{hi:.0%})" if n else f"{name}: 없음")


def macro_f1(pairs):
    """pairs: [(정답, 예측)]. 클래스별 F1 과 평균"""
    scores = {}
    for c in SENT:
        tp = sum(g == c and p == c for g, p in pairs)
        fp = sum(g != c and p == c for g, p in pairs)
        fn = sum(g == c and p != c for g, p in pairs)
        scores[c] = 2 * tp / (2 * tp + fp + fn) if tp else 0.0
    return sum(scores.values()) / len(SENT), scores


def main():
    sample = json.loads((OUT / "sample.json").read_text(encoding="utf-8"))
    labels = json.loads((OUT / "labels.json").read_text(encoding="utf-8"))
    assert {str(d["id"]) for d in sample} == set(labels), "표본과 라벨이 다름"
    right = linked = hit = must = 0
    pairs, wrong, missed, diff = [], [], [], []
    f_t = f_o = k_t = k_h = 0
    for d in sample:
        lab = labels[str(d["id"])]
        got = {x["stock"]: x["sentiment"] for x in d["links"]}
        for s in got:
            linked += 1
            if s in lab["must"] or s in lab["ok"]:
                right += 1
            else:
                wrong.append((d["id"], s))
        for s in lab["must"]:
            must += 1
            if s in got:
                hit += 1
            else:
                missed.append((d["id"], s))
        for s, gold in lab["sent"].items():
            if s in got:
                pairs.append((gold, got[s]))
                if gold != got[s]:
                    diff.append((d["id"], s, gold[:3], got[s][:3]))
        f_t, f_o = f_t + lab["f"][0], f_o + lab["f"][1]
        k_t, k_h = k_t + lab["k"][0], k_h + lab["k"][1]
    print("표본", len(sample), Counter(d["status"] for d in sample))
    rate("연결 Precision", right, linked)
    rate("연결 Recall", hit, must)
    p, r = right / linked, hit / must
    print(f"연결 F1: {2 * p * r / (p + r):.1%}")
    print("틀린 연결", wrong, "\n놓친 연결", missed)
    macro, per = macro_f1(pairs)
    print(f"\n감성 Macro-F1: {macro:.3f}", {k[:3]: round(v, 3) for k, v in per.items()}, "표본", len(pairs))
    rate("감성 일치(참고)", sum(g == q for g, q in pairs), len(pairs))
    print("정답 분포", Counter(g[:3] for g, _ in pairs), "예측 분포", Counter(q[:3] for _, q in pairs))
    print("혼동표(정답→예측)", sorted(Counter((g[:3], q[:3]) for g, q in pairs).items()))
    print("다른 건", diff)
    print()
    rate("요약 문장 근거 비율", f_o, f_t)
    rate("요약 핵심 사실 포함률", k_h, k_t)
    print("메모", [(i, v["note"]) for i, v in labels.items() if v.get("note")])
    print("재확인 대상", [(i, v["recheck"]) for i, v in labels.items() if v.get("recheck")])


if __name__ == "__main__":
    main()
