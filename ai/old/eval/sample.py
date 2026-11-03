"""평가 표본 뽑기: DONE 50 + NO_STOCK 20, 언론사를 돌아가며. 파이프라인에서 안 씀. DB 읽기만

    python -m eval.sample   → hk_llm/data/eval/sample.json, review_*.txt (Git 제외)
"""
import json
import random
from collections import Counter
from pathlib import Path

from sqlalchemy import text

from hk_llm.core.db import get_engine

OUT = Path(__file__).resolve().parents[1] / "hk_llm" / "data" / "eval"
SINCE = "2026-11-03 10:40"  # 지금 프롬프트로 요약한 기사만
QUOTA = {"DONE": 50, "NO_STOCK": 20}
BODY_CHARS = 1300  # 사람이 읽을 분량. 뒤쪽 확인이 필요하면 원문을 따로 봄


def pick(rows, n, rng):
    """언론사를 번갈아 하나씩. 언론사 쏠림을 줄임"""
    by = {}
    for r in rows:
        by.setdefault(r.press, []).append(r)
    for v in by.values():
        rng.shuffle(v)
    out = []
    while len(out) < n and any(by.values()):
        for p in sorted(by):
            if by[p] and len(out) < n:
                out.append(by[p].pop())
    return out


def main():
    rng = random.Random(20261103)
    with get_engine().connect() as c:
        info = dict(c.execute(text("SELECT stock_code, stock_name FROM stock_info")).all())
        links = {}
        for r in c.execute(text("SELECT article_id, stock_code, is_main, sentiment FROM article_stock")):
            links.setdefault(r.article_id, []).append({"stock": info[r.stock_code], "is_main": bool(r.is_main), "sentiment": r.sentiment})
        rows = c.execute(text("""SELECT article_id, press, status, title, body, summary, sentiment, companies FROM article
                                 WHERE companies IS NOT NULL AND body IS NOT NULL AND summarized_at >= :s ORDER BY article_id"""),
                         {"s": SINCE}).all()
    chosen = []
    for st, n in QUOTA.items():
        pool = [r for r in rows if r.status == st]
        print(st, "모집단", len(pool), Counter(r.press for r in pool))
        chosen += pick(pool, n, rng)
    print("표본", len(chosen), Counter(r.press for r in chosen), Counter(r.status for r in chosen))
    OUT.mkdir(parents=True, exist_ok=True)
    data = [{"id": r.article_id, "press": r.press, "status": r.status, "title": r.title, "summary": r.summary, "links": links.get(r.article_id, []),
             "companies": [c["name"] for c in json.loads(r.companies)]} for r in chosen]
    (OUT / "sample.json").write_text(json.dumps(data, ensure_ascii=False, indent=0), encoding="utf-8")
    for i in range(0, len(chosen), 18):
        lines = []
        for r, d in zip(chosen[i:i + 18], data[i:i + 18]):
            lines += [f"#### {d['id']} [{d['press']}] {d['status']} {d['title']}", f"요약: {d['summary']}",
                      f"연결: {[(x['stock'], '주' if x['is_main'] else '조', x['sentiment'][:3]) for x in d['links']]} LLM회사: {d['companies'][:8]}",
                      f"본문({len(r.body)}자): {' '.join(r.body[:BODY_CHARS].split())}", ""]
        (OUT / f"review_{i // 18}.txt").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
