"""수집 점검 결과를 Slack 알림 채널로 보냄 (2026-11-06). 웹훅이 없으면 아무것도 안 함

    from hk_llm.core.notify import report_health
    report_health(issues)   # health.check() 결과. 바뀐 것만 보냄

- 보내는 곳: .env 의 SLACK_WEBHOOK_URL (Slack 앱 "Collection Notification Bot" 의 Incoming Webhook, 알림 전용 채널 하나)
  주소만 있으면 누구나 그 채널에 글을 쓸 수 있으므로 .env 에만 두고 커밋·출력하지 않음
- 시끄럽지 않게 (경보 피로 방지):
    새로 생긴 문제 → 🔴 한 번,  사라진 문제 → ✅ 한 번,  계속되는 문제 → REMIND_HOURS 마다 한 번만 다시
  같은 문제인지는 숫자를 지운 글자로 판단 ("수집 공백 25분" 과 "수집 공백 30분" 은 같은 문제)
- 상태(마지막으로 알린 문제와 시각)는 LOG_DIR/health_state.json (컨테이너를 다시 만들어도 남는 볼륨)
- 보내기가 실패해도 수집은 계속 (예외를 밖으로 안 던짐)
"""
import json
import os
import re
import time

import requests

from hk_llm.core.config import LOG_DIR
from hk_llm.core.util import get_logger

STATE_FILE = LOG_DIR / "health_state.json"
REMIND_HOURS = 12
TITLE = "[AI 수집 점검]"

log = get_logger(__name__)


def key(issue):
    """같은 문제인지 가리는 열쇠: 괄호 앞까지, 숫자는 # 로"""
    return re.sub(r"\d[\d,.]*", "#", issue.split(" (")[0]).strip()


def plan(issues, state, now):
    """(보낼 글 줄 목록, 새 상태). state = {열쇠: {"t": 마지막으로 알린 시각, "text": 그때 문장}}"""
    current = {key(i): i for i in issues}
    lines, new_state = [], {}
    for k, text in current.items():
        last = state.get(k)
        if last is None:
            lines.append(f"🔴 {text}")
            new_state[k] = {"t": now, "text": text}
        elif now - last["t"] >= REMIND_HOURS * 3600:
            lines.append(f"🟠 아직 계속됨: {text}")
            new_state[k] = {"t": now, "text": text}
        else:
            new_state[k] = last
    lines += [f"✅ 해결됨: {v['text']}" for k, v in state.items() if k not in current]
    return lines, new_state


def send(text, url=None):
    """Slack 웹훅으로 글 하나. 보냈으면 True. 주소가 없거나 실패하면 False (예외 없음)"""
    url = url or os.environ.get("SLACK_WEBHOOK_URL")
    if not url:
        return False
    try:
        res = requests.post(url, json={"text": text}, timeout=10)
        if res.status_code != 200:
            log.warning("Slack 알림 실패: HTTP %s", res.status_code)  # 주소는 로그에 안 남김
            return False
        return True
    except requests.RequestException as e:
        log.warning("Slack 알림 실패: %s", type(e).__name__)
        return False


def _load():
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def report_health(issues, now=None):
    """바뀐 것이 있을 때만 보냄. 보낸 줄 수를 돌려줌 (웹훅이 없으면 상태도 안 바꿈 → 나중에 켜면 그때 새 문제로 알림)"""
    if not os.environ.get("SLACK_WEBHOOK_URL"):
        return 0
    now = now or time.time()
    lines, new_state = plan(issues, _load(), now)
    if not lines:
        return 0
    if send(TITLE + "\n" + "\n".join(lines)):
        try:
            LOG_DIR.mkdir(exist_ok=True)
            STATE_FILE.write_text(json.dumps(new_state, ensure_ascii=False), encoding="utf-8")
        except OSError as e:
            log.warning("알림 상태 저장 실패: %s", e)
        return len(lines)
    return 0  # 못 보냈으면 상태를 안 바꿔서 다음 실행에서 다시 시도
