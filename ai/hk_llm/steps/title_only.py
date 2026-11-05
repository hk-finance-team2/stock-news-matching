"""본문을 쓰지 않는 언론사(press_policy TITLE_ONLY) 기사: 제목만으로 종목 연결. LLM·본문 안 씀 → 비용 0

    from hk_llm.steps.title_only import link_title_only
    link_title_only()   # 1) 그 언론사 기사에 남은 본문·AI 결과를 지움  2) 아직 안 한 기사를 제목으로 연결
    python -m hk_llm.steps.title_only --redo   규칙을 바꾼 뒤 전부 다시 연결

- 왜: 연합뉴스·서울경제·연합인포맥스는 기사 끝에 "AI 학습 및 활용 금지"를 적음 → 본문을 LLM 에 넣는 요약은 그 "활용"
- 화면: 제목 + 원문 링크 + 연결 종목. 요약·키워드·감성은 비움 (감성 비율 집계에서도 빠짐, sentiment NULL)
- 제목은 짧고 문맥이 없어서 **보수적으로**: 띄어쓰기·문장부호로 자른 낱말이 사전 이름과 딱 맞을 때만 (조사 하나는 떼고 봄).
  부분 일치는 안 함 ("태양광"에서 '태양', "RISK"에서 'SK' 를 찾지 않게).
  헷갈리는 이름(AMBIGUOUS 별칭과 같은 글자), 일반 단어 종목명(sns.COMMON_NAMES), 그룹 이름과 같은 지주사(SK·LG·한화…)는 뺌
  → "잘못 연결 < 못 찾음" (팀 원칙)
"""
import re

from sqlalchemy import bindparam, text

from hk_llm.core.db import get_engine
from hk_llm.core.press_policy import title_only_presses
from hk_llm.core.util import get_logger
from hk_llm.steps.sns import COMMON_NAMES
from hk_llm.steps.step6_match import TYPE_WORDS, load_dictionary, norm

log = get_logger(__name__)

SEP = re.compile(r"[\s·ㆍ,，、.…\"'“”‘’\[\]()<>〈〉《》「」『』|/!?:;~=+&↑↓→▲▼]+")  # 마침표: "결렬에...대우건설"
JOSA = ("에서", "으로", "에게", "까지", "부터", "이", "가", "은", "는", "을", "를", "의", "에", "와", "과", "도", "로", "만")
MAX_STOCKS = 3  # 제목에 이보다 많은 종목이 나오면 명단·시황 제목으로 보고 연결 안 함
REL_MAIN, REL_SIDE = 0.65, 0.40  # 기존 관련도 척도(제목 0.40 + 주인공 0.25)와 맞춤. 종목 1~2개면 주인공으로 봄
REASON = "제목에 종목 이름이 나옴 (언론사가 AI 활용을 금지해 본문·AI 분석 없이 제목만 사용)"
# 제목에서 일반 낱말로 더 자주 쓰이는 종목명 (11/05 제목만 연결 표본 110건을 읽고 고름. ponytail: 손으로 고른 목록, 잘못 걸리면 추가)
#   상보: 연합뉴스 "(상보)" = 상세 보도 표시 (표본 50건 중 2건 잘못 연결)
#   미래산업: "K콘텐츠·바이오 등 미래산업 기반" (표본 60건 중 1건), 우리기술: "우리기술로 만든 …" 같은 쓰임
NEWS_TAG_NAMES = {"상보", "미래산업", "우리기술"}
# 의견을 낸 증권사는 주인공이 아니라 출처: "키움증권, 해성DS 목표가↓" (11/05 표본에서 발견)
BROKER = re.compile(r"증권$")
SOURCE_HINT = ("목표가", "투자의견", "리포트")


def blocked_names(engine):
    """제목만으로는 연결하지 않는 이름 (norm 한 글자)"""
    with engine.connect() as conn:
        ambiguous = {norm(a) for (a,) in conn.execute(text("SELECT alias FROM stock_alias WHERE alias_type = 'AMBIGUOUS'"))}
        # 그룹 이름과 같은 두 글자 지주사(SK·LG·한화·두산…): 제목의 "SK"가 그룹인지 지주사인지 못 가림.
        # 세 글자 이상(현대차·KB금융)은 그 회사 자체를 가리키는 경우가 대부분이라 막지 않음 (정답지에서 현대차 4건 놓침 → 2026-11-05)
        groups = {g for g in (norm(re.sub(r"그룹$", "", g)) for (g,) in conn.execute(text("SELECT DISTINCT group_name FROM stock_group")))
                  if len(g) <= 2}
    return ambiguous | groups | {norm(n) for n in COMMON_NAMES} | {norm(n) for n in NEWS_TAG_NAMES}


def title_stocks(title, names, blocked):
    """{종목코드: 제목에 쓰인 이름}. 낱말 단위로 정확히 맞는 것만, 앞에 나온 순서대로"""
    found = {}
    for word in SEP.split(title):
        if not word:
            continue
        cands = [word] + [word[:-len(j)] for j in JOSA if word.endswith(j) and len(word) > len(j) + 1]
        for cand in cands:
            key = norm(cand)
            if key in names and key not in blocked:
                found.setdefault(names[key], cand)
                break
    return found


def decide(title, names, blocked):
    """[(종목코드, 이름, is_main, 관련도)]. 시황·명단 제목이면 []"""
    if "[특징주]" not in title and any(w in title for w in TYPE_WORDS):
        return []
    found = title_stocks(title, names, blocked)
    brokers = [c for c, n in found.items() if BROKER.search(n)]
    if brokers and (len(found) > len(brokers) or any(w in title for w in SOURCE_HINT)):
        for c in brokers:  # 다른 회사에 대한 증권사 의견 → 증권사는 출처라 뺌 (증권사 자기 실적 기사는 남음)
            del found[c]
    if len(found) > MAX_STOCKS:
        return []
    main = len(found) <= 2
    return [(code, name, main, REL_MAIN if main else REL_SIDE) for code, name in found.items()]


def purge_ai_results(engine, presses):
    """정책이 바뀌기 전에 만든 본문·AI 결과를 지우고 다시 처리하게 LISTED 로 되돌림. 지운 건수"""
    sql = text("""UPDATE article SET body = NULL, summary = NULL, keywords = NULL, sentiment = NULL, companies = NULL,
                         model = NULL, summarized_at = NULL, status = 'LISTED', last_error = NULL, retry_count = 0
                  WHERE channel = 'RSS' AND press IN :p
                    AND (body IS NOT NULL OR summary IS NOT NULL OR companies IS NOT NULL OR model IS NOT NULL
                         OR status IN ('FETCHED', 'SUMMARIZED'))""").bindparams(bindparam("p", expanding=True))
    with engine.begin() as conn:
        return conn.execute(sql, {"p": presses}).rowcount


def link_title_only(engine=None, redo=False):
    """redo=True: 규칙을 바꾼 뒤 이미 처리한 기사(DONE·NO_STOCK)도 다시 연결 (비용 0)"""
    engine = engine or get_engine()
    presses = title_only_presses()
    purged = purge_ai_results(engine, presses)
    names, _, _ = load_dictionary(engine)
    blocked = blocked_names(engine)
    sql = text("""SELECT article_id, title FROM article WHERE channel = 'RSS' AND press IN :p
                  AND status IN :st""").bindparams(bindparam("p", expanding=True), bindparam("st", expanding=True))
    statuses = ["LISTED", "SKIPPED", "FAILED"] + (["DONE", "NO_STOCK"] if redo else [])
    with engine.connect() as conn:
        rows = conn.execute(sql, {"p": presses, "st": statuses}).all()
    done = 0
    for r in rows:
        links = decide(r.title, names, blocked)
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM article_stock WHERE article_id = :id"), {"id": r.article_id})
            for code, name, main, rel in links:
                conn.execute(text("""INSERT INTO article_stock (article_id, stock_code, is_main, sentiment, reason,
                                         match_type, relevance, evidence, matched_keywords)
                                     VALUES (:id, :code, :main, NULL, :reason, 'DIRECT', :rel, NULL, :kw)"""),
                             {"id": r.article_id, "code": code, "main": main, "reason": REASON, "rel": rel, "kw": name[:300]})
            conn.execute(text("UPDATE article SET status = :st, last_error = NULL WHERE article_id = :id"),
                         {"st": "DONE" if links else "NO_STOCK", "id": r.article_id})
        done += bool(links)
    if rows or purged:
        log.info("제목만 연결 (%s): AI 결과 지움 %d건, 처리 %d건 중 DONE %d", ", ".join(presses), purged, len(rows), done)
    return {"purged": purged, "processed": len(rows), "done": done}


if __name__ == "__main__":
    import sys

    print(link_title_only(redo="--redo" in sys.argv))
