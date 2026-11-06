"""언론사별 AI 이용 방침 (2026-11-05 실제 기사 페이지·robots.txt 확인. 조사표 ai/docs/조사/robots_조사.md)

- FULL: 본문을 받아 LLM 으로 요약 (본문은 7일 뒤 삭제, 화면에는 요약 + 원문 링크만)
- TITLE_ONLY: 본문을 받지 않고 LLM 에도 넣지 않음. 제목에서 종목 사전으로 종목만 찾고 감성은 판단하지 않음
  (화면: "요약 없음 · 원문 보기"). 기사 끝에 "AI 학습 및 활용 금지"를 적은 곳

목록에 없는 언론사는 TITLE_ONLY (확인 전에는 보수적으로). 새 언론사를 넣을 때는 기사 끝 고지·robots.txt 를 보고 여기에 적는다
"""
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


def policy(press):
    return POLICY.get(press, (TITLE_ONLY, "방침 미확인"))[0]


def title_only_presses():
    return sorted(p for p, (rule, _) in POLICY.items() if rule == TITLE_ONLY)
