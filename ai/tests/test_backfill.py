"""지난 한경 기사 다시 받기 (backfill --refetch) 시험. DB 가 켜져 있어야 함 (docker compose up -d db)
가짜 언론사 이름 + 1999년 날짜로 시험 기사를 넣었다가 지움. 진짜 사이트·LLM 은 부르지 않음 (본문 받기·요약·연결은 가짜)
11/12 에 실제로 돌려 보고서야 안 버그 2개(차단기 오판으로 멈춤, 다시 받은 본문이 7일 지우기에 바로 지워짐)를 다시 안 내려고 만듦"""
from datetime import date, datetime, timedelta
from unittest import mock

PRESS = "시험언론"
DAY = date(1999, 1, 4)
PREFIX = "test://hk_llm/refetch/"


def _setup(engine):
    from sqlalchemy import text

    old = datetime(1999, 1, 4, 9, 0)
    rows = [  # (이름, 상태, 요약, 본문, 오류)
        ("done_no_summary", "DONE", None, None, None),                       # 대상: 제목만 연결된 기사
        ("prefiltered", "NO_STOCK", None, None, "LLM 전 거르기: 사전 종목 이름 없음 (요약 안 함)"),  # 빼기: 다시 받아도 또 걸러짐
        ("failed_no_body", "FAILED", None, None, "'NoneType' object is not subscriptable"),  # 대상: 본문이 지워져 실패
        ("failed_with_body", "FAILED", None, "본문", "LLM 답이 형식에 안 맞음"),   # 빼기: 진짜 요약 실패 (3번 시도함)
        ("paywall", "SKIPPED", None, None, "유료 기사 (본문 안 줌)"),            # 빼기: 유료
        ("summarized", "DONE", "요약 있음", None, None),                       # 빼기: 이미 요약됨
    ]
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM article WHERE url_key LIKE :p"), {"p": PREFIX + "%"})
        for name, status, summary, body, err in rows:
            conn.execute(text("""INSERT INTO article (url_key, url, press, title, published_at, collected_at, status,
                                                      summary, body, last_error, source_type)
                                 VALUES (:k, :k, :press, :t, :at, :at, :s, :sum, :body, :err, 'NEWS')"""),
                         {"k": PREFIX + name, "press": PRESS, "t": name, "at": old, "s": status, "sum": summary,
                          "body": body, "err": err})


def _rows(engine):
    from sqlalchemy import text

    with engine.connect() as conn:
        return {r.title: r for r in conn.execute(
            text("SELECT title, status, collected_at FROM article WHERE url_key LIKE :p"), {"p": PREFIX + "%"})}


def _cleanup(engine):
    from sqlalchemy import text

    with engine.begin() as conn:
        conn.execute(text("DELETE FROM article WHERE url_key LIKE :p"), {"p": PREFIX + "%"})


def _patches(backfill, fetch_results, waits=()):
    """본문 받기 결과를 차례로 주는 가짜, 요약·연결은 아무것도 안 함, 기다리기는 실제로 안 기다림"""
    from hk_llm.steps import step4_body

    results = iter(fetch_results)
    wait_values = iter(waits)
    sleep = mock.Mock()
    return sleep, [
        mock.patch.object(backfill, "REFETCH_PRESSES", (PRESS,)),
        mock.patch.object(step4_body, "fetch_bodies", side_effect=lambda *a, **k: next(results, {"FETCHED": 0})),
        mock.patch.object(backfill, "summarize_articles", return_value=0),
        mock.patch.object(backfill, "match_articles", return_value=None),
        mock.patch.object(backfill, "_breaker_wait", side_effect=lambda host: next(wait_values, 0)),
        mock.patch.object(backfill.time, "sleep", sleep),
    ]


def _run(backfill, engine, fetch_results, waits=()):
    sleep, patches = _patches(backfill, fetch_results, waits)
    for p in patches:
        p.start()
    try:
        return backfill._refetch_day(engine, DAY, False, 10), sleep
    finally:
        for p in reversed(patches):
            p.stop()


def test_refetch_db():
    from hk_llm.core.db import get_engine
    from hk_llm.steps import backfill

    engine = get_engine()
    _setup(engine)
    try:
        # 1) 대상 고르기: 제목만 연결(DONE) + 본문이 지워진 실패(FAILED) 2건만
        with mock.patch.object(backfill, "REFETCH_PRESSES", (PRESS,)):
            n, _ = backfill._refetch_day(engine, DAY, True, 10)
        assert n == 2, f"대상은 2건이어야 함 (걸러진 기사·진짜 실패·유료·요약된 기사 빼고): {n}"

        # 2) 되돌리기: 대상만 LISTED, 수집 시각은 지금 (7일 지우기가 바로 지우지 않게)
        # 본문 받기 결과에 참고 칸(tables_dropped)이 있어도 처리 수가 0 이면 끝나야 함 (11/12 끝나지 않던 버그)
        (n, got), _ = _run(backfill, engine, [{"FETCHED": 0, "SKIPPED": 0, "RETRY": 0, "FAILED": 0,
                                              "tables_dropped": {"x": 1}}])
        assert (n, got) == (2, 0)
        rows = _rows(engine)
        now = datetime.now()
        for name in ("done_no_summary", "failed_no_body"):
            assert rows[name].status == "LISTED", name
            assert now - rows[name].collected_at < timedelta(minutes=5), f"{name}: 수집 시각을 지금으로 바꿔야 함"
        for name, status in (("prefiltered", "NO_STOCK"), ("failed_with_body", "FAILED"), ("paywall", "SKIPPED"),
                             ("summarized", "DONE")):
            assert rows[name].status == status, f"{name} 는 건드리면 안 됨"
            assert rows[name].collected_at.year == 1999, f"{name} 의 수집 시각도 그대로"
    finally:
        _cleanup(engine)


def test_refetch_waits_for_connection_breaker():
    from hk_llm.core.db import get_engine
    from hk_llm.steps import backfill

    engine = get_engine()
    bad = {"FETCHED": 0, "SKIPPED": 0, "RETRY": 3, "FAILED": 0}
    _setup(engine)
    try:
        # 인터넷이 끊겨 차단기가 '연결 오류'로 쉬는 중 → 기다렸다 계속 (멈추지 않음)
        (n, got), sleep = _run(backfill, engine, [bad, {"FETCHED": 2}], waits=[30])
        assert got == 2, "기다린 뒤 계속 받아야 함"
        assert mock.call(30) in sleep.call_args_list, "차단기가 쉬는 시간만큼 기다림"

        # 진짜 막힘(403·429)이면 기다리지 않고 두 번째에 멈춤 → -1
        _setup(engine)
        (n, got), _ = _run(backfill, engine, [bad, bad, {"FETCHED": 5}], waits=[0, 0])
        assert got == -1, "막힘 신호가 두 번이면 멈춤"
    finally:
        _cleanup(engine)


def test_breaker_wait_reasons():
    # 연결 오류로 쉬는 중이면 기다릴 초, 403·429 막힘이면 0 (DB 필요 없음)
    import time

    from hk_llm.steps import backfill

    with mock.patch("hk_llm.core.resilience.breaker._load",
                    return_value={"h": {"until": time.time() + 100, "reason": "ConnectionError: 연결 끊김"}}):
        assert 100 <= backfill._breaker_wait("h") <= 106
    with mock.patch("hk_llm.core.resilience.breaker._load",
                    return_value={"h": {"until": time.time() + 100, "reason": "HTTPError: 403 Forbidden"}}):
        assert backfill._breaker_wait("h") == 0, "막힘 신호면 기다리지 않음"
    with mock.patch("hk_llm.core.resilience.breaker._load",
                    return_value={"h": {"until": time.time() + 99999, "reason": "ConnectionError"}}):
        assert backfill._breaker_wait("h") <= backfill.MAX_WAIT_SECONDS, "아무리 길어도 20분까지"
    with mock.patch("hk_llm.core.resilience.breaker._load", return_value={}):
        assert backfill._breaker_wait("h") == 0
