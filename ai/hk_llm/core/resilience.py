"""수집 장애 대비 (2026-11-10): 재시도 간격 · Retry-After · 출처별 차단기(circuit breaker)

    from hk_llm.core.resilience import breaker
    if not breaker.allow(host):          # 쉬는 중이면 요청하지 않음
        ...
    try:
        res = retry(lambda: requests.get(url, timeout=15))
        breaker.success(host)
    except Exception as e:
        breaker.failure_from(host, e)    # 429·503 이면 바로 쉼, 그 밖은 연속 3번이면 쉼

    python -m hk_llm.core.resilience                  지금 상태 보기
    python -m hk_llm.core.resilience open DART 60 점검  사람이 직접 60분 쉬게 하기
    python -m hk_llm.core.resilience close DART        사람이 직접 다시 열기

왜 (근거, 원문 확인한 것만. 백엔드1 로컬 기록 ai-improve/24):
- 재시도 간격은 무작위 지수 백오프(full jitter). 지터가 없는 지수 백오프가 가장 나쁨 — AWS Architecture Blog
  "Exponential Backoff And Jitter" (Brooker, 2015). 재시도 횟수는 제한 — Google SRE 책 22장 Retries
- 서버가 Retry-After 를 주면 그만큼 기다림. 값은 초 또는 HTTP 날짜 — RFC 6585 §4(429), RFC 9110 §10.2.3, §15.6.4(503)
- 차단기: 실패가 쌓이면 잠시 요청을 끊고(open), 시간이 지나면 1번만 시험(half-open), 성공하면 원래대로(closed)
  — Fowler "CircuitBreaker"(2014), Microsoft Azure Architecture Center "Circuit Breaker pattern".
  같은 문서의 권고대로: 대상마다 따로(언론사 사이트·DART), 429·503 이면 바로 열기, 열리는 시간을 늘려 감, 사람이 직접 열고 닫기
- 최대 쉬는 시간 60분: RSS 는 최근 기사 N개만 담아서, 바쁜 시간에 가장 짧은 곳(연합인포맥스)이 약 1.4시간치 (11/10 실측).
  60분 안에 다시 시험해야 그 사이 기사를 영영 놓치지 않음
- 상태는 LOG_DIR/breaker_state.json (컨테이너를 다시 만들어도 남는 볼륨) → 다시 켜자마자 막힌 곳에 또 요청하지 않음
"""
import json
import random
import sys
import threading
import time
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime

import requests

from hk_llm.core.config import KST, LOG_DIR
from hk_llm.core.util import get_logger

STATE_FILE = LOG_DIR / "breaker_state.json"
FAIL_THRESHOLD = 3  # 연속 실패 이만큼이면 쉼 (잠깐 실패 1~2번으로 쉬지 않게)
BASE_OPEN = 10 * 60  # 처음 쉬는 시간(초) = 수집 2번
MAX_OPEN = 60 * 60  # 가장 긴 쉬는 시간(초). RSS 가 담는 시간(최소 약 1.4시간)보다 짧게
SLOW_DOWN = {429, 503}  # "나중에 다시" 라는 응답 → 연속 실패를 기다리지 않고 바로 쉼 (Azure: accelerated circuit breaking)

log = get_logger(__name__)


def retry_after_seconds(response, now=None):
    """Retry-After 헤더를 초로. 없거나 못 읽으면 None. 초("120") 와 HTTP 날짜("Wed, 21 Oct 2026 07:28:00 GMT") 둘 다"""
    value = response.headers.get("Retry-After") if response is not None else None
    if not value:
        return None
    value = value.strip()
    if value.isdigit():
        return int(value)
    try:
        when = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    now = now or datetime.now(when.tzinfo)
    return max(0, int((when - now).total_seconds()))


def jitter_wait(attempt, base=2.0, cap=30.0):
    """attempt 번째(1부터) 재시도 전 쉬는 시간: 0 ~ min(cap, base·2^(attempt-1)) 사이 무작위 (full jitter)"""
    return random.uniform(0, min(cap, base * 2 ** (attempt - 1)))


def status_of(exc):
    """예외에서 HTTP 상태 번호 (없으면 None)"""
    res = getattr(exc, "response", None)
    return res.status_code if isinstance(res, requests.Response) else None


class Breaker:
    """출처(키)마다 따로 쉬게 하는 차단기. 키는 사이트 주소(www.yna.co.kr)나 'DART'"""

    def __init__(self, path=STATE_FILE):
        self.path = path
        self._lock = threading.Lock()

    # 상태 파일: {키: {"fails": 연속 실패, "opens": 연속으로 연 횟수, "until": 다시 시험할 시각(epoch), "reason": 이유, "probing": 시험 중}}
    def _load(self):
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

    def _save(self, state):
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
        except OSError:
            log.exception("차단기 상태 저장 실패 (수집은 계속)")

    def allow(self, key, now=None):
        """요청해도 되나. 쉬는 시간이 지났으면 1번만 시험으로 허용 (half-open)"""
        now = now or time.time()
        with self._lock:
            state = self._load()
            s = state.get(key)
            if not s or not s.get("until"):
                return True  # closed
            if now < s["until"] or s.get("probing"):
                return False  # open, 또는 이미 시험 요청이 나감
            s["probing"] = True  # half-open: 이 1번의 결과로 닫거나 다시 엶
            self._save(state)
            log.info("차단기 시험 요청 %s (%s 뒤)", key, s.get("reason"))
            return True

    def success(self, key):
        with self._lock:
            state = self._load()
            if key in state:
                if state[key].get("until"):
                    log.warning("차단기 닫힘 %s: 다시 정상", key)
                del state[key]
                self._save(state)

    def failure(self, key, reason, now=None, immediate=False, wait=None):
        """실패 1번. 연속 FAIL_THRESHOLD 번이거나 immediate(429·503)거나 시험 요청이 실패하면 쉼.
        쉬는 시간 = max(서버가 알려 준 시간, BASE_OPEN·2^(연속으로 연 횟수)), 최대 MAX_OPEN"""
        now = now or time.time()
        with self._lock:
            state = self._load()
            s = state.setdefault(key, {"fails": 0, "opens": 0})
            s["fails"] = s.get("fails", 0) + 1
            if immediate or s.get("probing") or s["fails"] >= FAIL_THRESHOLD:
                seconds = min(MAX_OPEN, max(wait or 0, BASE_OPEN * 2 ** s.get("opens", 0)))
                s.update(until=now + seconds, opens=s.get("opens", 0) + 1, fails=0, probing=False, reason=reason)
                log.warning("차단기 열림 %s: %d분 쉼 (%s)", key, seconds // 60, reason)
            self._save(state)

    def failure_from(self, key, exc, now=None):
        """예외를 보고 failure. 429·503 은 바로 쉬고, Retry-After 가 있으면 그만큼 (최대 MAX_OPEN)"""
        code = status_of(exc)
        wait = retry_after_seconds(getattr(exc, "response", None)) if code in SLOW_DOWN else None
        reason = f"HTTP {code}" if code else type(exc).__name__
        self.failure(key, reason, now=now, immediate=code in SLOW_DOWN, wait=wait)

    def open_until(self, key, until, reason):
        """정해진 시각까지 쉼 (DART 하루 한도 → 다음 날 0시, 사람이 직접 끄기)"""
        with self._lock:
            state = self._load()
            s = state.setdefault(key, {"fails": 0, "opens": 0})
            s.update(until=until, fails=0, probing=False, reason=reason)
            self._save(state)
        log.warning("차단기 열림 %s: %s 까지 (%s)", key, datetime.fromtimestamp(until, KST).strftime("%m/%d %H:%M"), reason)

    def issues(self, now=None):
        """수집 점검·Slack 알림용 문장. 쉬고 있는 출처마다 한 줄"""
        now = now or time.time()
        out = []
        for key, s in sorted(self._load().items()):
            if s.get("until") and (now < s["until"] or s.get("probing")):
                when = datetime.fromtimestamp(s["until"], KST).strftime("%m/%d %H:%M")
                out.append(f"수집 쉬는 중 {key} ({s.get('reason')}, {when} 이후 다시 시험)")
        return out


breaker = Breaker()


def next_midnight_kst(now=None):
    """다음 한국 시간 0시 (epoch). DART 하루 한도는 날짜 단위"""
    now = now or datetime.now(KST)
    return (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0).timestamp()


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["open"] and len(args) >= 3:
        breaker.open_until(args[1], time.time() + int(args[2]) * 60, " ".join(args[3:]) or "사람이 직접 멈춤")
    elif args[:1] == ["close"] and len(args) == 2:
        breaker.success(args[1])
    print(json.dumps(breaker._load(), ensure_ascii=False, indent=1) if breaker._load() else "쉬는 출처 없음")
    for line in breaker.issues():
        print(line)
