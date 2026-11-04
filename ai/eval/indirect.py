"""간접 연결(INDIRECT) 평가: 이슈 기사 30건 정답지로 Precision·Recall — 숫자만 출력

    python -m eval.indirect pick          표본 30건 고르기 → eval/indirect_sample.json (연습용 20건·기존 정답지와 겹치지 않게)
    python -m eval.indirect show 0 10     라벨 다는 쪽: 표본 0~9번 원문 (AI 답은 안 보여 줌)
    python -m eval.indirect predict       시스템(step6b) 답을 eval/indirect_pred.jsonl 에 저장 (LLM, DB 에 안 씀)
    python -m eval.indirect score         심판 1(gold_indirect.jsonl) 기준 P·R, 심판 2(gold_indirect_judge2.jsonl)와 일치율

정답 한 줄 = {"url_key": ..., "stocks": [{"code": "010950", "sentiment": "POSITIVE"}], "note": ""}  ([] = 간접 연결 없음)
비교는 (기사, 종목) 쌍. 방향(호재·악재)이 다르면 틀림으로 셈
"""
import json
import random
import sys
from pathlib import Path

from sqlalchemy import bindparam, text

from eval.score import load_gold
from hk_llm.core.db import get_engine

HERE = Path(__file__).parent
SAMPLE = HERE / "indirect_sample.json"
PRED = HERE / "indirect_pred.jsonl"
N, SEED, TRIAL_SEED = 30, 20261104, 1104


def issue_rows(engine):
    from hk_llm.steps.step6b_indirect import is_issue
    with engine.connect() as conn:
        rows = conn.execute(text("""SELECT url_key, title, summary, body, keywords FROM article
                                    WHERE status = 'NO_STOCK' AND channel IN ('RSS', 'SITEMAP') AND summary IS NOT NULL
                                    ORDER BY url_key""")).all()
    gold = {g["url_key"] for g in load_gold()}
    return [r for r in rows if r.url_key not in gold and is_issue(r.title, r.keywords)]


def pick():
    rows = issue_rows(get_engine())
    trial = {r.url_key for r in random.Random(TRIAL_SEED).sample(rows, min(20, len(rows)))}   # 연습용 20건 (step6b trial 과 같은 뽑기)
    rest = [r for r in rows if r.url_key not in trial]
    keys = [r.url_key for r in random.Random(SEED).sample(rest, min(N, len(rest)))]
    SAMPLE.write_text(json.dumps({"seed": SEED, "url_keys": keys}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"이슈 기사 {len(rows)}건 중 연습용 20건 빼고 {len(keys)}건 → {SAMPLE.name}")


def load_sample():
    return json.loads(SAMPLE.read_text(encoding="utf-8"))["url_keys"]


def fetch(engine, keys):
    sql = text("SELECT url_key, press, published_at, title, summary, body FROM article WHERE url_key IN :k"
               ).bindparams(bindparam("k", expanding=True))
    with engine.connect() as conn:
        return {r.url_key: r for r in conn.execute(sql, {"k": keys})}


def show(start, end):
    keys = load_sample()[start:end]
    rows = fetch(get_engine(), keys)
    for i, k in enumerate(keys, start):
        r = rows[k]
        print(f"===== [{i}] {k}\n{r.press} · {r.published_at:%Y-%m-%d %H:%M}\n제목: {r.title}\n{(r.body or '')[:2500]}\n")


def predict():
    from hk_llm.steps.step6_match import load_dictionary
    from hk_llm.steps.step6b_indirect import candidates, judge
    engine = get_engine()
    cands, names = candidates(engine), load_dictionary(engine)[0]
    rows = fetch(engine, load_sample())
    with PRED.open("w", encoding="utf-8") as f:
        for k in load_sample():
            r = rows[k]
            links, _ = judge(r.title, r.summary, r.body, cands, names=names)
            f.write(json.dumps({"url_key": k, "stocks": [{"code": l.stock_code, "sentiment": l.sentiment} for l in links]},
                               ensure_ascii=False) + "\n")
    print(f"{len(rows)}건 판단 → {PRED.name}")


def load(path):
    return {g["url_key"]: {s["code"]: s["sentiment"] for s in g["stocks"]} for g in load_gold(path)}


def compare(truth, got):
    """(맞음, 틀림, 놓침) — 종목과 방향이 모두 같아야 맞음"""
    tp = fp = fn = 0
    for k, t in truth.items():
        g = got.get(k, {})
        tp += sum(1 for c, s in g.items() if t.get(c) == s)
        fp += sum(1 for c, s in g.items() if t.get(c) != s)
        fn += sum(1 for c, s in t.items() if g.get(c) != s)
    return tp, fp, fn


def score():
    gold, pred = load(HERE / "gold_indirect.jsonl"), load(PRED)
    tp, fp, fn = compare(gold, pred)
    print(f"정답지 {len(gold)}건, 정답 간접 연결 {sum(len(v) for v in gold.values())}개 (없음 {sum(not v for v in gold.values())}건)")
    print(f"시스템: 연결 {tp + fp}개 → Precision {tp / (tp + fp):.3f}" if tp + fp else "시스템: 연결 0개",
          f"/ Recall {tp / (tp + fn):.3f}" if tp + fn else "", f"(맞음 {tp}, 틀림 {fp}, 놓침 {fn})")
    j2 = HERE / "gold_indirect_judge2.jsonl"
    if j2.exists():
        other = load(j2)
        a, b, c = compare(gold, {k: v for k, v in other.items() if k in gold})
        same = sum(1 for k in other if k in gold and gold[k] == other[k])
        print(f"두 심판: 기사 완전 일치 {same}/{len(other)}, 연결 일치도 {2 * a / (2 * a + b + c):.3f}" if a + b + c else "두 심판: 둘 다 연결 없음")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "pick":
        pick()
    elif cmd == "show":
        show(int(sys.argv[2]), int(sys.argv[3]))
    elif cmd == "predict":
        predict()
    elif cmd == "score":
        score()
