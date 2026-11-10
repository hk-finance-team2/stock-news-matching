"""언론사별 AI 이용 방침 (2026-11-05 실제 기사 페이지·robots.txt 확인. 조사표 ai/docs/조사/robots_조사.md)

- FULL: 본문을 받아 LLM 으로 요약 (본문은 7일 뒤 삭제, 화면에는 요약 + 원문 링크만)
- TITLE_ONLY: 본문을 받지 않고 LLM 에도 넣지 않음. 제목에서 종목 사전으로 종목만 찾고 감성은 판단하지 않음
  (화면: "요약 없음 · 원문 보기"). 기사 끝에 "AI 학습 및 활용 금지"를 적은 곳

목록에 없는 언론사는 TITLE_ONLY (확인 전에는 보수적으로). 새 언론사를 넣을 때는 기사 끝 고지·robots.txt 를 보고 여기에 적는다
"""
import json
from datetime import datetime

from hk_llm.core.config import KST, LOG_DIR
from hk_llm.core.util import get_logger

FULL = "FULL"
TITLE_ONLY = "TITLE_ONLY"

POLICY = {
    # 언론사: (방침, 근거 — 확인한 문구 그대로)
    "연합뉴스": (TITLE_ONLY, "기사 끝 '<저작권자(c) 연합뉴스, 무단 전재-재배포, AI 학습 및 활용 금지>'"),
    "서울경제": (TITLE_ONLY, "기사 끝 'ⓒ 서울경제신문, 무단 전재-재배포, AI 학습 및 활용 금지'"),
    "연합인포맥스": (TITLE_ONLY, "기사 끝 '<저작권자 (c) 연합인포맥스, 무단전재 및 재배포 금지, AI 학습 및 활용 금지>'"),
    "비즈워치": (FULL, "기사 끝 고지 없음. robots.txt 'Content-Signal: search=yes,ai-train=no' — 학습만 금지, AI 입력 표시 없음"),
    "한국경제": (FULL, "AI 봇 규칙·기사 끝 AI 금지 고지 없음"),
    "파이낸셜뉴스": (FULL, "AI 봇 규칙·기사 끝 AI 금지 고지 없음"),
    "전자신문": (FULL, "robots.txt 'Allow: /', AI 봇 규칙은 주석 처리. 기사 끝 AI 금지 고지 없음"),
}



# ---- 2026-11-10 수집 장애 대비: 자동 바꿈과 "제외" 단계 (근거·설명은 steps/rights.py, 로컬 기록 ai-improve/24) ----
# EXCLUDED: RSS 도 받지 않음 (권리자가 요청하거나 팀이 빼기로 할 때. 예: 연합뉴스 규약 "비영리 정보서비스도 서면 허가")
# 자동으로는 더 조심스러운 쪽으로만: FULL → TITLE_ONLY → EXCLUDED. 다시 푸는 것은 사람이 확인하고 위 POLICY 를 고침
# 자동·사람이 바꾼 것은 LOG_DIR/press_override.json (컨테이너를 다시 만들어도 남는 볼륨), Slack 수집 점검 알림으로 계속 알림
EXCLUDED = "EXCLUDED"
STRICT = {FULL: 0, TITLE_ONLY: 1, EXCLUDED: 2}
PAGE_HITS = 2  # 기사 페이지 고지는 서로 다른 기사 이만큼에서 보여야 언론사 전체를 바꿈 (헛걸림 방지)
OVERRIDE_FILE = LOG_DIR / "press_override.json"

log = get_logger(__name__)


def _load():
    try:
        return json.loads(OVERRIDE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _save(data):
    try:
        OVERRIDE_FILE.parent.mkdir(parents=True, exist_ok=True)
        OVERRIDE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    except OSError:
        log.exception("언론사 방침 바꿈 저장 실패")


def policy(press):
    base = POLICY.get(press, (TITLE_ONLY, "방침 미확인"))[0]
    over = _load().get("override", {}).get(press, {}).get("rule")
    return over if over and STRICT[over] > STRICT[base] else base  # 더 조심스러운 쪽만


def restrict(press, rule, reason):
    """press 를 rule 로 (지금보다 조심스러울 때만). 바꿨으면 True"""
    if STRICT[rule] <= STRICT[policy(press)]:
        return False
    data = _load()
    data.setdefault("override", {})[press] = {"rule": rule, "reason": reason[:200],
                                              "at": datetime.now(KST).strftime("%Y-%m-%d %H:%M")}
    data.get("hits", {}).pop(press, None)
    _save(data)
    log.warning("언론사 방침 바꿈 %s → %s (%s)", press, rule, reason)
    return True


def report_page_notice(press, article_id, reason):
    """기사 페이지에서 AI 금지 고지를 봄. 서로 다른 기사 PAGE_HITS 건이면 TITLE_ONLY 로 바꾸고 True"""
    data = _load()
    hits = data.setdefault("hits", {}).setdefault(press, [])
    if article_id not in hits:
        hits.append(article_id)
    _save(data)
    return len(hits) >= PAGE_HITS and restrict(press, TITLE_ONLY, reason)


def reset(press):
    """사람이 확인하고 자동 바꿈을 지움 (기본 방침 POLICY 로 돌아감)"""
    data = _load()
    data.get("override", {}).pop(press, None)
    data.get("hits", {}).pop(press, None)
    _save(data)


def issues():
    """수집 점검·Slack 알림용: 기본 방침과 다르게 바뀐 언론사. 사람이 POLICY 를 고치거나 reset 할 때까지 계속 알림"""
    out = []
    for press, o in sorted(_load().get("override", {}).items()):
        if STRICT[o["rule"]] > STRICT[POLICY.get(press, (TITLE_ONLY, ""))[0]]:
            out.append(f"언론사 방침 바뀜 {press} → {o['rule']} ({o['reason']}) — 확인 후 press_policy.py POLICY 에 반영")
    return out


def title_only_presses():
    """본문을 받지 않고 LLM 에 넣지 않는 언론사 (TITLE_ONLY + EXCLUDED, 자동 바꿈 포함)"""
    names = set(POLICY) | set(_load().get("override", {}))
    return sorted(p for p in names if policy(p) != FULL)


def excluded_presses():
    """RSS 도 받지 않는 언론사"""
    names = set(POLICY) | set(_load().get("override", {}))
    return sorted(p for p in names if policy(p) == EXCLUDED)


if __name__ == "__main__":
    import sys

    args = sys.argv[1:]
    if args[:1] == ["exclude"] and len(args) >= 2:  # python -m hk_llm.core.press_policy exclude 연합뉴스 권리자 요청
        restrict(args[1], EXCLUDED, " ".join(args[2:]) or "사람이 직접 제외")
    elif args[:1] == ["title-only"] and len(args) >= 2:
        restrict(args[1], TITLE_ONLY, " ".join(args[2:]) or "사람이 직접 제목만")
    elif args[:1] == ["reset"] and len(args) == 2:
        reset(args[1])
    for p in sorted(set(POLICY) | set(_load().get("override", {}))):
        print(f"{p}: {policy(p)}")
    for line in issues():
        print(line)
