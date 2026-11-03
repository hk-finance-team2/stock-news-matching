"""7단계 (17번): 같은 사건을 다룬 비슷한 기사 묶기 → article_stock.group_article_id

    from hk_llm.steps.step7_group import group_articles, save_groups
    groups = group_articles(rows)   # rows: article_id, stock_code, stock_name, title, published_at
    save_groups()                   # 최근 기사를 묶어 저장. 칸이 아직 없으면 아무것도 안 함 (팀공유 6번)

묶는 조건: 같은 종목 + 비슷한 제목 + 가까운 시각. 기사를 버리지 않는다.
제목 유사도: 괄호·기호·공백과 종목명을 뺀 뒤 글자 2개씩 자른 조각의 겹침 비율 (Jaccard)
🧪 SIMILAR·WINDOW 는 임시값. 실제 기사가 쌓이면 다시 본다
"""
import re
from datetime import datetime, timedelta

from sqlalchemy import bindparam, text

from hk_llm.core.config import KST
from hk_llm.core.db import get_engine, to_db
from hk_llm.core.util import get_logger

log = get_logger(__name__)

SIMILAR = 0.10  # 실제 기사 실험으로 정함: 0.10 에서 틀린 합침 없음, 0.10 아래로는 다른 소식이 섞임. 틀려도 기사는 안 지워짐
WINDOW = timedelta(hours=24)
RECENT = timedelta(hours=72)  # ponytail: 최근 72시간만 다시 묶음. 더 오래된 묶음은 그대로 둠, 사슬이 3일을 넘는 사건은 나뉠 수 있음


def _bigrams(title, stock_name=""):
    t = re.sub(r"\[[^\]]*\]|\([^)]*\)", "", title)
    t = re.sub(r"[^0-9A-Za-z가-힣]", "", t.replace(stock_name, "")).upper()
    return {t[i:i + 2] for i in range(len(t) - 1)}


def similarity(a, b, stock_name=""):
    x, y = _bigrams(a, stock_name), _bigrams(b, stock_name)
    return len(x & y) / len(x | y) if x and y else 0.0


def group_articles(rows, similar=SIMILAR, window=WINDOW):
    """[{stock_code, stock_name, article_ids}] — 2건 이상인 묶음만. 한 기사가 여러 종목 묶음에 들어갈 수 있음"""
    by_stock = {}
    for r in rows:
        by_stock.setdefault(r["stock_code"], []).append(r)
    groups = []
    for code, items in by_stock.items():
        parent = {r["article_id"]: r["article_id"] for r in items}

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        for i, a in enumerate(items):  # ponytail: 종목 안에서 모든 쌍 비교. 하루치 기준이라 충분, 많아지면 시각순으로 자르기
            for b in items[i + 1:]:
                near = abs(a["published_at"] - b["published_at"]) <= window
                if near and similarity(a["title"], b["title"], a["stock_name"]) >= similar:
                    parent[find(a["article_id"])] = find(b["article_id"])
        found = {}
        for r in items:
            found.setdefault(find(r["article_id"]), []).append(r["article_id"])
        groups += [{"stock_code": code, "stock_name": items[0]["stock_name"], "article_ids": sorted(ids)}
                   for ids in found.values() if len(ids) > 1]
    return groups


def load_rows(engine, since=None):
    sql = text("""SELECT a.article_id, s.stock_code, i.stock_name, a.title, a.published_at
                  FROM article a JOIN article_stock s USING (article_id) JOIN stock_info i USING (stock_code)
                  WHERE a.status = 'DONE' AND a.channel = 'RSS' AND (:since IS NULL OR a.published_at >= :since)""")
    with engine.connect() as conn:
        return [dict(r._mapping) for r in conn.execute(sql, {"since": since})]


def has_column(engine):
    sql = text("""SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
                  AND table_name = 'article_stock' AND column_name = 'group_article_id'""")
    with engine.connect() as conn:
        return bool(conn.execute(sql).scalar())


def save_groups(engine=None):
    """저장한 묶음 수. 대표 기사 = 묶음에서 가장 먼저 저장된 기사. 칸이 없으면 0"""
    engine = engine or get_engine()
    if not has_column(engine):
        log.info("group_article_id 칸이 아직 없어 기사 묶음 저장을 건너뜀")
        return 0
    rows = load_rows(engine, to_db(datetime.now(KST) - RECENT))
    if not rows:
        return 0
    groups = group_articles(rows)
    clear = text("UPDATE article_stock SET group_article_id = NULL WHERE article_id IN :ids"
                 ).bindparams(bindparam("ids", expanding=True))
    put = text("UPDATE article_stock SET group_article_id = :rep WHERE stock_code = :code AND article_id IN :ids"
               ).bindparams(bindparam("ids", expanding=True))
    with engine.begin() as conn:  # 지우고 넣기를 한 번에 → 화면이 빈 묶음을 보지 않음
        conn.execute(clear, {"ids": sorted({r["article_id"] for r in rows})})
        for g in groups:
            conn.execute(put, {"rep": g["article_ids"][0], "code": g["stock_code"], "ids": g["article_ids"]})
    log.info("기사 묶음 저장: %d개", len(groups))
    return len(groups)


if __name__ == "__main__":
    # 실제 샘플 (읽기만, DB 켜져 있어야 함)
    rows = load_rows(get_engine())
    title = {r["article_id"]: r["title"] for r in rows}
    found = group_articles(rows)
    print(f"실제 샘플: 연결 {len(rows)}줄, 묶음 {len(found)}개")
    for g in found:
        print(" ", g["stock_name"], [(i, title[i][:30]) for i in g["article_ids"]])
    assert any(set(g["article_ids"]) >= {9, 1097} for g in found), "영광 상장 첫날 두 기사는 묶여야 함"
    print("ok")
