"""수집 점검 (2026-11-06): 실행마다 "조용히 빠지는 것"을 찾아 경고로 남김. LLM 비용 0

    from hk_llm.steps.health import check
    issues = check(engine)          # ["수집 공백 25분 (…)", "피드 12번 연속 실패: …", …]. 문제가 없으면 []
    python -m hk_llm.steps.health   # 지금 상태를 바로 출력 (사람이 확인할 때)

왜 만들었나: 11/06 점검에서 기록은 있는데 아무도 몰랐던 일 3개를 찾음
  - AI 수집이 11/05 15:20 부터 멈춤 (컨테이너가 꺼짐)
  - 전자신문 RSS 피드가 11/04 오전부터 실행 287번에서 실패 (실패 이유는 로그에만 있어 사라짐)
  - 전자신문 기사 50건이 본문을 한 번도 못 받고 멈춤 (robots.txt 확인 실패는 실패로 세지 않음)
  그 전에도 파이낸셜뉴스 본문 62% 가 글자 깨짐인 채 LLM 에 들어갔지만 경보가 없었음 (11/05 발견)

점검 5가지 (기준값은 아래 상수. 처음 정한 값이라 운영하며 조정):
  1. 수집 공백: 직전 성공 수집과의 간격이 GAP_MIN 분 넘음 → 실행 시작 때 재면 "꺼져 있던 시간"이 잡힘
  2. 피드 연속 실패: 최근 FEED_STREAK 번 실행에서 같은 피드가 계속 실패 (5분 주기 → 12번 = 1시간)
  3. 멈춘 기사: 본문을 받아야 하는데 STUCK_MIN 분 넘게 LISTED 인 기사 (언론사별 수, 멈춘 이유)
  4. 수집량 급감: 언론사별 최근 24시간에 작성된 기사 수가 지난 7일 하루 평균의 DROP_RATIO 아래 (평균이 DROP_MIN_AVG 이상일 때만)
  5. 글자 깨짐: 최근 24시간 본문 글자 깨짐으로 막은 기사 (step4 가 LLM 에 안 넣고 FAILED 로 둠)
결과는 run.py 가 로그와 collect_run.error 에 "점검: …" 으로 남김 → 화면 데이터 상태(/api/status)와 같이 보면 됨
"""
from datetime import timedelta

from sqlalchemy import bindparam, text

from hk_llm.core.config import KST
from hk_llm.core.db import get_engine, to_db
from hk_llm.core.press_policy import title_only_presses
from hk_llm.core.util import get_logger

GAP_MIN = 15
FEED_STREAK = 12
STUCK_MIN = 60
DROP_RATIO = 0.5
DROP_MIN_AVG = 10
BROKEN_MARK = "글자 깨짐"  # step4 가 남기는 last_error 앞부분

log = get_logger(__name__)


def gap_issue(last_success, now):
    """직전 성공 시각과 지금 사이 공백이 길면 경고 한 줄 (처음 실행이면 None)"""
    if last_success is None:
        return None
    minutes = int((now - last_success).total_seconds() // 60)
    if minutes > GAP_MIN:
        return f"수집 공백 {minutes}분 (마지막 성공 {last_success:%m/%d %H:%M})"
    return None


def feed_issues(recent_errors, feeds):
    """recent_errors: 최근 실행의 error 칸 (새 것부터). 최근 FEED_STREAK 번 모두에서 실패한 피드"""
    window = recent_errors[:FEED_STREAK]
    if len(window) < FEED_STREAK:
        return []
    return [f"피드 {FEED_STREAK}번 연속 실패: {url}" for url in feeds if all(url in (e or "") for e in window)]


def volume_issues(recent, daily_avg):
    """recent: {언론사: 최근 24시간 수}, daily_avg: {언론사: 지난 7일 하루 평균}"""
    out = []
    for press, avg in sorted(daily_avg.items()):
        n = recent.get(press, 0)
        if avg >= DROP_MIN_AVG and n < avg * DROP_RATIO:
            out.append(f"수집량 급감 {press}: 최근 24시간 {n}건 (지난 7일 하루 평균 {avg:.0f}건)")
    return out


def check(engine=None, now=None):
    from datetime import datetime

    from hk_llm.steps.step1_rss import FEEDS

    engine = engine or get_engine()
    now = to_db(now or datetime.now(KST))
    issues = []
    with engine.connect() as conn:
        last = conn.execute(text("SELECT MAX(finished_at) FROM collect_run WHERE status = 'SUCCESS' AND finished_at <= :now"),
                            {"now": now}).scalar()
        issues.append(gap_issue(last, now))

        errors = [e for (e,) in conn.execute(text("""SELECT error FROM collect_run WHERE status <> 'RUNNING' AND started_at <= :now
                                                     ORDER BY run_id DESC LIMIT :n"""), {"n": FEED_STREAK, "now": now})]
        issues += feed_issues(errors, [u for urls in FEEDS.values() for u in urls])

        stuck = conn.execute(text("""SELECT press, COUNT(*) n, MIN(collected_at) since, MAX(last_error) why FROM article
                                     WHERE status = 'LISTED' AND source_type = 'NEWS' AND channel = 'RSS' AND press NOT IN :skip
                                       AND published_at >= :day AND collected_at < :old
                                     GROUP BY press ORDER BY n DESC""").bindparams(bindparam("skip", expanding=True)),
                             {"skip": title_only_presses(), "day": now.replace(hour=0, minute=0, second=0) - timedelta(days=1),
                              "old": now - timedelta(minutes=STUCK_MIN)}).all()
        issues += [f"멈춘 기사 {r.press} {r.n}건 ({r.since:%m/%d %H:%M} 부터, 이유: {r.why or '기록 없음'})" for r in stuck]

        # 작성 시각 기준으로 셈: 처음 수집한 날 옛 기사가 한꺼번에 들어오면(비즈워치 387건) 수집 시각 기준 평균이 부풀어 헛경보
        recent = dict(conn.execute(text("""SELECT press, COUNT(*) FROM article WHERE source_type = 'NEWS' AND channel = 'RSS'
                                           AND published_at >= :t AND published_at < :now GROUP BY press"""),
                                   {"t": now - timedelta(days=1), "now": now}).all())
        week = dict(conn.execute(text("""SELECT press, COUNT(*) FROM article WHERE source_type = 'NEWS' AND channel = 'RSS'
                                         AND published_at >= :a AND published_at < :b GROUP BY press"""),
                                 {"a": now - timedelta(days=8), "b": now - timedelta(days=1)}).all())
        days = conn.execute(text("""SELECT COUNT(DISTINCT DATE(published_at)) FROM article WHERE source_type = 'NEWS' AND channel = 'RSS'
                                    AND published_at >= :a AND published_at < :b"""),
                            {"a": now - timedelta(days=8), "b": now - timedelta(days=1)}).scalar() or 0
        if days:
            issues += volume_issues(recent, {p: n / days for p, n in week.items()})

        broken = conn.execute(text("""SELECT COUNT(*) FROM article WHERE status = 'FAILED' AND last_error LIKE :m
                                      AND collected_at >= :t"""), {"m": BROKEN_MARK + "%", "t": now - timedelta(days=1)}).scalar()
        if broken:
            issues.append(f"글자 깨짐으로 막은 본문 {broken}건 (최근 24시간)")
    return [i for i in issues if i]


if __name__ == "__main__":
    found = check()
    print("\n".join(found) if found else "문제 없음")
