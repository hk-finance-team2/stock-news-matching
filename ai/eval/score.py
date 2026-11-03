"""정답지로 지금 AI 종목 연결 채점 (라벨 기준 6번). 숫자만 출력 → 개선하는 쪽이 정답 내용을 보지 않게

    python -m eval.score           (ai 폴더에서) 전체·직접·간접 Precision / Recall, 감성 일치율

정답지 eval/gold.jsonl 한 줄 = 기사 1건:
    {"url_key": "...", "stocks": [{"code": "005930", "type": "DIRECT", "main": true, "sentiment": "POSITIVE"}], "note": ""}
    stocks 가 [] 이면 "연결 없음"이 정답
AI 답: article_stock (지금 DB). 매칭 규칙을 바꾸고 step6 을 다시 돌린 뒤 이 스크립트로 다시 잼 (LLM 비용 0)
"""
import json
from pathlib import Path

from sqlalchemy import bindparam, text

from hk_llm.core.db import get_engine

GOLD = Path(__file__).parent / "gold.jsonl"


def load_gold(path=GOLD):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def predictions(engine, keys):
    """{url_key: {code: (match_type, sentiment)}} — AI 가 연결한 것"""
    sql = text("""SELECT a.url_key, s.stock_code, s.match_type, s.sentiment FROM article a
                  JOIN article_stock s USING (article_id) WHERE a.url_key IN :k""").bindparams(bindparam("k", expanding=True))
    out = {k: {} for k in keys}
    with engine.connect() as conn:
        for r in conn.execute(sql, {"k": list(keys)}):
            out[r.url_key][r.stock_code] = (r.match_type or "DIRECT", r.sentiment)
    return out


def score(gold, pred):
    """{묶음: {tp, fp, fn, precision, recall}}, 감성 일치 (맞은 연결끼리)"""
    res = {k: {"tp": 0, "fp": 0, "fn": 0} for k in ("ALL", "DIRECT", "INDIRECT")}
    same = both = 0
    for g in gold:
        truth = {s["code"]: s for s in g["stocks"]}
        got = pred.get(g["url_key"], {})
        for code, (mtype, sent) in got.items():
            if code in truth:
                kind = truth[code]["type"]
                res["ALL"]["tp"] += 1
                res[kind]["tp"] += 1
                both += 1
                same += sent == truth[code]["sentiment"]
            else:
                res["ALL"]["fp"] += 1
                res[mtype]["fp"] += 1
        for code, s in truth.items():
            if code not in got:
                res["ALL"]["fn"] += 1
                res[s["type"]]["fn"] += 1
    for r in res.values():
        r["precision"] = round(r["tp"] / (r["tp"] + r["fp"]), 3) if r["tp"] + r["fp"] else None
        r["recall"] = round(r["tp"] / (r["tp"] + r["fn"]), 3) if r["tp"] + r["fn"] else None
    return res, {"same": same, "both": both, "rate": round(same / both, 3) if both else None}


def main():
    gold = load_gold()
    res, senti = score(gold, predictions(get_engine(), [g["url_key"] for g in gold]))
    print(f"정답지 {len(gold)}건, 정답 연결 {sum(len(g['stocks']) for g in gold)}개 (연결 없음 {sum(not g['stocks'] for g in gold)}건)")
    for k, r in res.items():
        print(f"{k:8} P {r['precision']}  R {r['recall']}  (맞음 {r['tp']}, 틀림 {r['fp']}, 놓침 {r['fn']})")
    print(f"감성 일치 {senti['same']}/{senti['both']} = {senti['rate']}")


if __name__ == "__main__":
    main()
