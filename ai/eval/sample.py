"""정답지 표본 고르기 (라벨 기준 5번): DONE 70 + NO_STOCK 30, 언론사를 번갈아, 난수 씨앗 고정

    python -m eval.sample          (ai 폴더에서) → eval/sample.json

- AI 결과와 상관없이 고르려고 상태(DONE/NO_STOCK)별로 정해진 수만큼만 뽑고, 파일에는 기사 주소(url_key)만 남김
  (상태를 적어 두면 라벨 다는 쪽이 "AI 가 뭔가 찾았구나"를 알게 됨)
- 본문이 있는 뉴스만 (공시는 DART 가 종목을 직접 줘서 매칭 평가 대상이 아님)
- article_id 는 PC 마다 달라서 url_key 로 구분
"""
import json
import random
from pathlib import Path

from sqlalchemy import text

from hk_llm.core.db import get_engine

SEED = 20261103
WANT = {"DONE": 70, "NO_STOCK": 30}
OUT = Path(__file__).parent / "sample.json"


def pick(rows, n, rng):
    """언론사를 번갈아 n건: 언론사마다 섞은 줄을 차례로 하나씩"""
    by = {}
    for r in rows:
        by.setdefault(r.press, []).append(r)
    for items in by.values():
        rng.shuffle(items)
    out, presses = [], sorted(by)
    while len(out) < n and any(by.values()):
        for p in presses:
            if by[p] and len(out) < n:
                out.append(by[p].pop())
    return out


def main():
    rng = random.Random(SEED)
    with get_engine().connect() as conn:
        rows = conn.execute(text("""SELECT url_key, press, status FROM article
                                    WHERE channel IN ('RSS', 'SITEMAP') AND status IN ('DONE', 'NO_STOCK') AND body IS NOT NULL
                                    ORDER BY url_key""")).all()
    chosen = []
    for status, n in WANT.items():
        chosen += pick([r for r in rows if r.status == status], n, rng)
    rng.shuffle(chosen)  # 상태 순서가 드러나지 않게
    OUT.write_text(json.dumps({"seed": SEED, "url_keys": [r.url_key for r in chosen]}, ensure_ascii=False, indent=1),
                   encoding="utf-8")
    print(f"{len(chosen)}건 → {OUT.name}")


if __name__ == "__main__":
    main()
