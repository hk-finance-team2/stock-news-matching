"""라벨 다는 사람용: 표본 기사 원문 보기·종목 찾기. AI 답(요약·키워드·회사·연결)은 보여 주지 않음 (라벨 기준 7번)

    python -m eval.show 0 10          표본 0~9번 기사: 주소·언론사·시각·제목·본문 앞부분
    python -m eval.show --idx 3,7,12  표본에서 그 번호들만
    python -m eval.show --stock 녹십자  종목 사전에서 이름·별칭으로 종목코드 찾기
"""
import json
import sys
from pathlib import Path

from sqlalchemy import bindparam, text

from hk_llm.core.db import get_engine

SAMPLE = Path(__file__).parent / "sample.json"
BODY_CHARS = 2500


def show(indexes):
    all_keys = json.loads(SAMPLE.read_text(encoding="utf-8"))["url_keys"]
    keys = [all_keys[i] for i in indexes]
    sql = text("SELECT url_key, press, published_at, title, body FROM article WHERE url_key IN :k"
               ).bindparams(bindparam("k", expanding=True))
    with get_engine().connect() as conn:
        rows = {r.url_key: r for r in conn.execute(sql, {"k": keys})}
    for i, k in zip(indexes, keys):
        r = rows[k]
        print(f"===== [{i}] {k}\n{r.press} · {r.published_at:%Y-%m-%d %H:%M}\n제목: {r.title}\n{(r.body or '')[:BODY_CHARS]}\n")


def find_stock(q):
    like = f"%{q}%"
    sql = text("""SELECT i.stock_code, i.stock_name, i.market, GROUP_CONCAT(a.alias SEPARATOR ', ') AS aliases
                  FROM stock_info i LEFT JOIN stock_alias a USING (stock_code)
                  WHERE i.stock_name LIKE :q OR a.alias LIKE :q GROUP BY i.stock_code LIMIT 20""")
    with get_engine().connect() as conn:
        for r in conn.execute(sql, {"q": like}):
            print(r.stock_code, r.stock_name, r.market, "| 별칭:", r.aliases or "-")


if __name__ == "__main__":
    if sys.argv[1] == "--stock":
        find_stock(sys.argv[2])
    elif sys.argv[1] == "--idx":
        show([int(x) for x in sys.argv[2].split(",")])
    else:
        show(range(int(sys.argv[1]), int(sys.argv[2])))
