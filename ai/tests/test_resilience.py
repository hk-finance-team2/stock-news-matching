"""수집 장애 대비 시험 (2026-11-10): Retry-After · 지터 · 차단기 · DART 오류 코드 · robots 429. DB·인터넷 안 씀

가짜 응답으로 장애를 일부러 일으켜 대비책이 실제로 동작하는지 확인 (NIST SP 800-34 §3.5 계획 시험, Google SRE 22장 "Test Until Failure")
"""
import pathlib
import tempfile
from datetime import datetime, timezone
from unittest import mock

import requests


def _response(code, headers=None):
    res = requests.Response()
    res.status_code = code
    res.headers.update(headers or {})
    res.url = "https://example.com/x"
    return res


def _http_error(code, headers=None):
    return requests.HTTPError(response=_response(code, headers))


def _breaker():
    from hk_llm.core.resilience import Breaker

    return Breaker(pathlib.Path(tempfile.mkdtemp()) / "state.json")


def test_retry_after_seconds_and_date():
    from hk_llm.core.resilience import retry_after_seconds

    assert retry_after_seconds(_response(429, {"Retry-After": "120"})) == 120
    now = datetime(2026, 11, 10, 7, 0, 0, tzinfo=timezone.utc)
    assert retry_after_seconds(_response(503, {"Retry-After": "Tue, 10 Nov 2026 07:05:00 GMT"}), now=now) == 300, "HTTP 날짜 형식"
    assert retry_after_seconds(_response(503, {"Retry-After": "Tue, 10 Nov 2026 06:00:00 GMT"}), now=now) == 0, "지난 시각이면 0"
    assert retry_after_seconds(_response(429)) is None
    assert retry_after_seconds(_response(429, {"Retry-After": "곧"})) is None, "못 읽으면 없는 것으로"
    assert retry_after_seconds(None) is None


def test_jitter_wait_range():
    from hk_llm.core.resilience import jitter_wait

    for attempt, top in [(1, 2.0), (2, 4.0), (3, 8.0), (10, 30.0)]:
        waits = [jitter_wait(attempt, base=2.0, cap=30.0) for _ in range(200)]
        assert all(0 <= w <= top for w in waits), "0 ~ min(cap, base·2^(n-1))"
        assert max(waits) - min(waits) > top / 4, "무작위로 흩어짐 (고정 간격 아님)"


def test_retry_follows_retry_after():
    from hk_llm.core import util

    calls = iter([_response(429, {"Retry-After": "3"}), _response(200)])
    with mock.patch.object(util.time, "sleep") as sleep:
        assert util.retry(lambda: next(calls)).status_code == 200
    sleep.assert_called_once_with(3)

    # 30초보다 길게 기다리라고 하면 여기서 안 기다리고 바로 실패 → 차단기가 그 시간만큼 쉼
    calls = iter([_response(429, {"Retry-After": "600"}), _response(200)])
    with mock.patch.object(util.time, "sleep") as sleep:
        try:
            util.retry(lambda: next(calls))
            raise AssertionError("실패해야 함")
        except requests.HTTPError as e:
            assert e.response.status_code == 429
    sleep.assert_not_called()


def test_retry_does_not_retry_403():
    from hk_llm.core import util

    calls = []
    with mock.patch.object(util.time, "sleep"):
        try:
            util.retry(lambda: calls.append(1) or _response(403))
        except requests.HTTPError:
            pass
    assert len(calls) == 1, "403(거부)은 다시 해도 같음 → 재시도 안 함"


def test_breaker_opens_after_three_failures_then_half_open():
    from hk_llm.core.resilience import BASE_OPEN

    b, t = _breaker(), 1_000_000.0
    for i in range(2):
        b.failure("site", "HTTP 403", now=t)
        assert b.allow("site", now=t), "1~2번 실패로는 안 쉼"
    b.failure("site", "HTTP 403", now=t)
    assert not b.allow("site", now=t), "연속 3번이면 쉼 (open)"
    assert not b.allow("site", now=t + BASE_OPEN - 1)
    assert b.issues(now=t) and "site" in b.issues(now=t)[0], "알림 문장"

    assert b.allow("site", now=t + BASE_OPEN), "시간이 지나면 1번 시험 (half-open)"
    assert not b.allow("site", now=t + BASE_OPEN), "시험은 1번만"
    b.failure("site", "HTTP 403", now=t + BASE_OPEN)
    assert not b.allow("site", now=t + BASE_OPEN * 2), "시험 실패 → 다시 쉼, 이번엔 2배"
    assert b.allow("site", now=t + BASE_OPEN + BASE_OPEN * 2)
    b.success("site")
    assert b.allow("site", now=t + BASE_OPEN * 3) and not b.issues(), "성공하면 원래대로 (closed)"


def test_breaker_success_resets_failure_count():
    b, t = _breaker(), 1_000_000.0
    b.failure("site", "Timeout", now=t)
    b.failure("site", "Timeout", now=t)
    b.success("site")
    b.failure("site", "Timeout", now=t)
    assert b.allow("site", now=t), "연속 실패만 셈"


def test_breaker_429_opens_immediately_with_retry_after_and_cap():
    from hk_llm.core.resilience import BASE_OPEN, MAX_OPEN

    b, t = _breaker(), 1_000_000.0
    b.failure_from("site", _http_error(429, {"Retry-After": "1800"}), now=t)
    assert not b.allow("site", now=t + BASE_OPEN), "429 는 1번에 쉼, 서버가 말한 30분을 따름"
    assert b.allow("site", now=t + 1800)

    b2 = _breaker()
    b2.failure_from("site", _http_error(503, {"Retry-After": "86400"}), now=t)
    assert b2.allow("site", now=t + MAX_OPEN), "하루를 말해도 최대 60분 뒤엔 시험 (RSS 가 담는 시간 안에)"

    b3 = _breaker()
    for _ in range(10):  # 계속 실패해도 쉬는 시간은 최대 60분
        b3.failure("site", "x", now=t, immediate=True)
    assert b3.allow("site", now=t + MAX_OPEN)


def test_breaker_state_survives_restart_and_manual_override():
    from hk_llm.core.resilience import Breaker

    path = pathlib.Path(tempfile.mkdtemp()) / "state.json"
    t = 1_000_000.0
    Breaker(path).open_until("DART", t + 3600, "사람이 직접 멈춤")
    assert not Breaker(path).allow("DART", now=t + 10), "다시 켜도 기억 (파일)"
    Breaker(path).success("DART")
    assert Breaker(path).allow("DART", now=t + 10), "사람이 직접 다시 열기"


def test_breaker_broken_state_file_does_not_stop_collection():
    from hk_llm.core.resilience import Breaker

    path = pathlib.Path(tempfile.mkdtemp()) / "state.json"
    path.write_text("{깨진 파일", encoding="utf-8")
    assert Breaker(path).allow("site"), "상태 파일이 깨져도 수집은 계속"


def test_dart_error_codes():
    from hk_llm.core.config import KST
    from hk_llm.steps import dart

    b = _breaker()
    t = datetime(2026, 11, 10, 14, 0, tzinfo=KST).timestamp()
    with mock.patch.object(dart, "breaker", b), mock.patch.object(dart, "next_midnight_kst",
                                                                  return_value=datetime(2026, 11, 11, tzinfo=KST).timestamp()):
        dart.record_dart_failure(dart.DartError("020", "요청 제한을 초과하였습니다."), now=t)
        assert not b.allow("DART", now=datetime(2026, 11, 10, 23, 59, tzinfo=KST).timestamp()), "한도 초과 → 오늘은 안 부름"
        assert b.allow("DART", now=datetime(2026, 11, 11, 0, 0, tzinfo=KST).timestamp()), "다음 날 0시에 다시"

        b.success("DART")
        dart.record_dart_failure(dart.DartError("011", "사용할 수 없는 키입니다."), now=t)
        assert not b.allow("DART", now=t + 3 * 3600) and "사람이 확인" in b.issues(now=t)[0], "키 문제 → 오래 쉬고 사람에게 알림"

        b.success("DART")
        dart.record_dart_failure(dart.DartError("800", "시스템 점검"), now=t)
        assert not b.allow("DART", now=t + 60), "점검 → 바로 쉼"

        b.success("DART")
        dart.record_dart_failure(RuntimeError("DART 요청 실패 (Timeout)"), now=t)
        assert b.allow("DART", now=t), "네트워크 실패 1번으로는 안 쉼"


def test_dart_page_raises_coded_error():
    from hk_llm.steps import dart

    res = mock.Mock(status_code=200)
    res.json.return_value = {"status": "020", "message": "요청 제한을 초과하였습니다."}
    with mock.patch.object(dart.requests, "get", return_value=res):
        try:
            dart._get_page("키", "Y", "20261109", "20261110", 1)
            raise AssertionError("실패해야 함")
        except dart.DartError as e:
            assert e.code == "020" and "키" not in str(e), "코드를 남기고, 키는 오류 문구에 안 남김"


def test_collect_disclosures_skips_when_paused():
    from hk_llm.steps import dart

    b = _breaker()
    b.open_until("DART", 4_000_000_000, "하루 요청 한도 초과(020)")
    with mock.patch.object(dart, "breaker", b), mock.patch.object(dart, "fetch_disclosures") as fetch:
        assert dart.collect_disclosures(engine=mock.Mock(), key="키") == 0
    fetch.assert_not_called()


def test_robots_429_is_not_allow_all():
    from hk_llm.steps import robots

    robots._parser.cache_clear()
    with mock.patch.object(robots.requests, "get", return_value=_response(429)):
        try:
            robots._parser("https://example.com", "2026-11-10")
            raise AssertionError("429 는 '확인 못 함'이어야 함")
        except robots.RobotsUnavailable:
            pass
    with mock.patch.object(robots.requests, "get", return_value=_response(404)):
        assert robots._parser("https://example.org", "2026-11-10").can_fetch("bot", "https://example.org/a"), \
            "404 는 robots.txt 없음 = 제한 없음 (RFC 9309 §2.3.1.3)"
    robots._parser.cache_clear()


def test_body_fetch_pauses_site_after_repeated_failures():
    """본문 수집 중 사이트가 403 을 계속 주면: 3번째 실패에서 쉬고, 그 뒤 기사는 요청하지 않고 LISTED 로 둠 (재시도 횟수 안 올림)"""
    from hk_llm.steps import step4_body as s4

    rows = [mock.Mock(article_id=i, url=f"https://www.hankyung.com/article/{i}", retry_count=0) for i in range(5)]
    engine = mock.MagicMock()
    engine.connect.return_value.__enter__.return_value.execute.return_value.all.return_value = rows
    b = _breaker()
    updates = []
    with mock.patch.object(s4, "breaker", b), mock.patch.object(s4, "reachable", return_value=True), \
            mock.patch.object(s4, "allowed", return_value=True), mock.patch.object(s4, "crawl_delay", return_value=0), \
            mock.patch.object(s4, "title_only_presses", return_value=[]), \
            mock.patch.object(s4, "_get", side_effect=_http_error(403)) as get, \
            mock.patch.object(s4, "_update", side_effect=lambda *a, **k: updates.append(k)):
        s4.fetch_bodies(engine)
    assert get.call_count == 3, "3번 실패 뒤엔 그 사이트에 요청 안 함"
    assert [u.get("tries") for u in updates[3:]] == [None, None], "쉬는 동안의 기사는 재시도 횟수를 안 올림"
    assert all("차단기" in u["error"] for u in updates[3:])
    assert not b.allow("www.hankyung.com")
