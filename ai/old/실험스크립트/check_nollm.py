"""LLM 없이 확인: DB 상태, 잠금, 공시 원문 추출, 묶음 저장 (임시 칸은 시험 뒤 지움)"""
import os
from datetime import datetime, timedelta
from unittest import mock

from sqlalchemy import text

from hk_llm import run as run_mod
from hk_llm.core.config import KST
from hk_llm.core.db import get_engine
from hk_llm.steps import dart, step7_group

e = get_engine()
today = datetime.now(KST).date()
with e.connect() as c:
    print("상태", [tuple(r) for r in c.execute(text("SELECT status, COUNT(*) FROM article WHERE channel='RSS' GROUP BY status"))])
    print("어제 이후 FETCHED", c.execute(text("SELECT COUNT(*) FROM article WHERE status='FETCHED' AND published_at >= :d"), {"d": today - timedelta(days=1)}).scalar())
    print("어제 이후 LISTED", c.execute(text("SELECT COUNT(*) FROM article WHERE status='LISTED' AND published_at >= :d"), {"d": today - timedelta(days=1)}).scalar())
    print("오늘 DONE 종목 2건+", c.execute(text("""SELECT COUNT(*) FROM (SELECT s.stock_code FROM article_stock s JOIN article a USING(article_id)
        WHERE a.status='DONE' AND a.channel<>'DART' AND a.published_at >= :d GROUP BY s.stock_code HAVING COUNT(*)>1) x"""), {"d": today}).scalar())
    print("공시 미요약(어제 이후)", c.execute(text("SELECT COUNT(*) FROM article WHERE channel='DART' AND summarized_at IS NULL AND published_at >= :d"), {"d": today - timedelta(days=1)}).scalar())
    print("RUNNING", c.execute(text("SELECT COUNT(*) FROM collect_run WHERE status='RUNNING'")).scalar())

# 1. 잠금: 다른 연결이 잡고 있으면 건너뜀, 풀리면 실행
with e.connect() as other:
    other.execute(text("SELECT GET_LOCK('hk_llm_run', 0)"))
    with mock.patch.object(run_mod, "_run") as fake:
        assert run_mod.run(e) is False and not fake.called
    other.execute(text("SELECT RELEASE_LOCK('hk_llm_run')"))
with mock.patch.object(run_mod, "_run") as fake:
    assert run_mod.run(e) is True and fake.called
with e.connect() as c:
    assert c.execute(text("SELECT IS_FREE_LOCK('hk_llm_run')")).scalar() == 1, "실행 뒤 잠금이 풀려야 함"
print("ok 잠금")

# 2. 공시 원문: 제목별 3건, 앞부분만 출력
with e.connect() as c:
    rows = c.execute(text("SELECT article_id, title, url FROM article WHERE channel='DART' ORDER BY article_id DESC LIMIT 200")).all()
seen = set()
key = os.environ["DART_API_KEY"]
for r in rows:
    kind = r.title.split()[-1][:6]
    if kind in seen or len(seen) >= 4:
        continue
    seen.add(kind)
    try:
        t = dart.fetch_document(key, r.url.split("rcpNo=")[1])
        print(f"[{r.article_id}] {r.title} / 길이 {len(t)}\n   {t[:420]}")
    except Exception as err:
        print("실패", r.article_id, r.title, err)

# 3. 묶음: 칸 없으면 0, 임시 칸으로 저장 확인 후 지움
assert step7_group.save_groups(e) == 0
with e.begin() as c:
    c.execute(text("ALTER TABLE article_stock ADD COLUMN group_article_id BIGINT NULL"))
try:
    rows = step7_group.load_rows(e, datetime.now(KST).replace(tzinfo=None) - step7_group.RECENT)
    n = step7_group.save_groups(e)
    with e.connect() as c:
        filled = c.execute(text("SELECT COUNT(*), COUNT(DISTINCT group_article_id) FROM article_stock WHERE group_article_id IS NOT NULL")).first()
    expected = step7_group.group_articles(rows)
    print("묶음", n, "대상 연결", len(rows), "채운 줄/대표 수", tuple(filled))
    assert n == len(expected) and filled[0] == sum(len(g["article_ids"]) for g in expected)
    assert step7_group.save_groups(e) == n, "다시 돌려도 같음"
    print("ok 묶음 저장")
finally:
    with e.begin() as c:
        c.execute(text("ALTER TABLE article_stock DROP COLUMN group_article_id"))
    print("임시 칸 지움, has_column =", step7_group.has_column(e))
