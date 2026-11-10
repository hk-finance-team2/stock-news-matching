"""AI 데이터 내보내기: 내 DB 의 수집·분석 결과를 **본문 없이** 팀 공유용 Flyway 반복 지시서로

    python -m hk_llm.export_data        (ai 폴더에서) → backend/src/main/resources/db/ai-data/R__ai_data.sql

왜: 팀 DB 는 PC 마다 따로라, 내 PC 에서 수집·요약한 결과를 팀원은 볼 수 없음. 팀원마다 다시 수집하면
    시간·LLM 비용이 들고 LLM 답이 실행마다 달라 데이터가 PC 마다 달라짐 → 한 명이 만들고 모두 같은 데이터
    백엔드는 모두 켜므로, Flyway 가 켤 때 넣게 함 (파이썬 없이 git pull + 백엔드 재시작이면 끝)

넣는 것: 화면에 나오는 기사(DONE)의 제목·요약·키워드·감성·원문 링크 등, 종목 연결(사실 종류·같은 소식 묶음 포함), 종목별 하루 요약, 마지막 수집 기록
빼는 것: 기사 본문(저작권, 7일 뒤 삭제 약속), RSS 짧은 설명문, AI 내부용 회사 목록, 연결 못 한 기사, 예시 기사, KIS 시세
- 기사 번호(article_id)는 PC 마다 달라서 기사 주소(url_key)로 넣고 종목 연결도 주소로 찾아 붙임
- 같은 소식 묶음(V13 group_article_id)도 번호 대신 묶음 대표 기사의 주소(group_url_key)로 내보내고 받는 PC 가 주소로 번호를 찾음
- 다시 실행해도 안전: 같은 주소의 기사는 갱신(본문 칸은 건드리지 않음), 그 기사의 종목 연결은 지우고 다시 넣음
"""
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from sqlalchemy import text

from hk_llm.core.db import get_engine
from hk_llm.core.press_policy import title_only_presses
from hk_llm.core.util import get_logger

OUT = Path(__file__).parent.parent.parent / "backend" / "src" / "main" / "resources" / "db" / "ai-data" / "R__ai_data.sql"
CHUNK = 300  # INSERT 한 문장에 넣는 줄 수

ARTICLE_COLS = ("url_key", "url", "press", "title", "reporter", "published_at", "collected_at", "status", "summary",
                "model", "summarized_at", "source_type", "channel", "collect_mode", "keywords", "sentiment")
# evidence(근거 문장)는 기사 원문 문장 그대로라 공개 레포에 올리지 않음 (2026-11-05). 팀원 PC 에서는 근거 칸이 비어 보임
LINK_COLS = ("url_key", "stock_code", "is_main", "sentiment", "reason", "match_type", "relevance", "matched_keywords",
             "fact_type", "group_url_key")  # fact_type: V14 사실 종류(분류 값, 원문 아님), group_url_key: 묶음 대표 기사 주소
SUMMARY_COLS = ("stock_code", "summary_date", "news_summary", "sns_summary", "pos_count", "neg_count", "neu_count",
                "generated_at")
RUN_COLS = ("started_at", "finished_at", "status", "collected_count", "summarized_count", "channel")
# 화면에 나오는 뉴스·공시만 (예시 기사 sample:// 와 SNS 시험 글은 뺌)
WHERE = "a.status = 'DONE' AND a.channel IN ('RSS', 'SITEMAP', 'DART') AND a.url_key NOT LIKE 'sample://%'"

log = get_logger(__name__)


def lit(v):
    """파이썬 값 → SQL 글자. MariaDB 기본 설정은 백슬래시가 이스케이프 문자라 함께 처리.
    Flyway 는 ${...} 를 치환하므로 그런 글자가 나오면 '$ {' 로 바꿈"""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float, Decimal)):
        return str(v)
    if isinstance(v, datetime):
        return f"'{v:%Y-%m-%d %H:%M:%S}'"
    if isinstance(v, date):
        return f"'{v:%Y-%m-%d}'"
    s = str(v).replace("${", "$ {").replace("\\", "\\\\").replace("'", "''")
    return f"'{s}'"


def values(rows, cols):
    return ",\n".join("    (" + ", ".join(lit(r[c]) for c in cols) + ")" for r in rows)


def chunks(rows):
    return [rows[i:i + CHUNK] for i in range(0, len(rows), CHUNK)]


def build(engine):
    """(SQL 글, 건수 dict)"""
    with engine.connect() as conn:
        arts = [dict(r._mapping) for r in conn.execute(text(
            f"SELECT {', '.join('a.' + c for c in ARTICLE_COLS)} FROM article a WHERE {WHERE} ORDER BY a.published_at, a.url_key"))]
        links = [dict(r._mapping) for r in conn.execute(text(
            f"""SELECT a.url_key, {', '.join('s.' + c for c in LINK_COLS[1:-1])}, g.url_key AS group_url_key FROM article_stock s
                JOIN article a USING (article_id) LEFT JOIN article g ON g.article_id = s.group_article_id
                WHERE {WHERE} ORDER BY a.url_key, s.stock_code"""))]
        sums = [dict(r._mapping) for r in conn.execute(text(
            f"SELECT {', '.join(SUMMARY_COLS)} FROM stock_daily_summary WHERE news_summary NOT LIKE '[예시]%' "
            "ORDER BY summary_date, stock_code"))]
        runs = [dict(r._mapping) for r in conn.execute(text(
            f"""SELECT {', '.join(RUN_COLS)} FROM collect_run r WHERE status = 'SUCCESS'
                AND finished_at = (SELECT MAX(finished_at) FROM collect_run x WHERE x.status = 'SUCCESS'
                                   AND x.channel <=> r.channel)"""))]
    out = [HEADER.format(n_art=len(arts), n_link=len(links), n_sum=len(sums), at=datetime.now())]
    presses = ", ".join(lit(x) for x in title_only_presses())
    out.append("-- 0. AI 활용 금지 언론사 기사: 예전 파일로 받은 AI 요약·감성을 지움 (2026-11-05, 제목만 연결로 바뀜)\n"
               "--    AI 결과가 남은 기사만 대상이라 이미 정리된 PC 에서는 아무것도 안 바뀜. 연결은 아래 1·2번이 다시 넣음\n"
               "DELETE s FROM article_stock s JOIN article a ON a.article_id = s.article_id\n"
               f"WHERE a.channel = 'RSS' AND a.press IN ({presses}) AND a.summary IS NOT NULL;\n"
               "UPDATE article SET summary = NULL, keywords = NULL, sentiment = NULL, model = NULL, summarized_at = NULL,\n"
               "       status = IF(status = 'DONE', 'NO_STOCK', status)\n"
               f"WHERE channel = 'RSS' AND press IN ({presses}) AND summary IS NOT NULL;\n")
    out.append("-- 1. 기사: 같은 주소가 있으면 갱신 (본문 body 칸은 건드리지 않음)")
    for part in chunks(arts):
        out.append(f"INSERT INTO article ({', '.join(ARTICLE_COLS)}) VALUES\n{values(part, ARTICLE_COLS)}\n"
                   "ON DUPLICATE KEY UPDATE "
                   + ", ".join(f"{c} = VALUES({c})" for c in ARTICLE_COLS if c not in ("url_key", "collected_at"))
                   + ";\n")
    out.append(LINK_HEAD)
    for part in chunks(links):
        out.append(f"INSERT INTO tmp_ai_link ({', '.join(LINK_COLS)}) VALUES\n{values(part, LINK_COLS)};\n")
    out.append(LINK_TAIL)
    out.append("-- 3. 종목별 하루 요약: (종목, 날짜)가 같으면 갱신")
    for part in chunks(sums):
        out.append(f"INSERT INTO stock_daily_summary ({', '.join(SUMMARY_COLS)}) VALUES\n{values(part, SUMMARY_COLS)}\n"
                   "ON DUPLICATE KEY UPDATE "
                   + ", ".join(f"{c} = VALUES({c})" for c in SUMMARY_COLS[2:]) + ";\n")
    out.append("-- 4. 마지막 수집 기록 (화면의 \"갱신 시각\"). 같은 시작 시각·채널이 이미 있으면 넣지 않음")
    for r in runs:
        out.append(f"INSERT INTO collect_run ({', '.join(RUN_COLS)})\n"
                   f"SELECT {', '.join(lit(r[c]) for c in RUN_COLS)} FROM DUAL\n"
                   f"WHERE NOT EXISTS (SELECT 1 FROM collect_run WHERE started_at = {lit(r['started_at'])} "
                   f"AND channel <=> {lit(r['channel'])});\n")
    return "\n".join(out), {"기사": len(arts), "종목 연결": len(links), "하루 요약": len(sums), "수집 기록": len(runs)}


HEADER = """-- AI 수집·분석 결과 (본문 없음) — 팀원이 같은 진짜 데이터로 화면·API 를 보게 함
-- 만든 곳: 백엔드1 PC 의 DB, {at:%Y-%m-%d %H:%M} (python -m hk_llm.export_data). 이 파일은 손으로 고치지 않음
-- 기사 {n_art}건 (뉴스·공시, DONE 만), 종목 연결 {n_link}개(사실 종류·같은 소식 묶음 포함), 종목별 하루 요약 {n_sum}개
-- 빠진 것: 기사 본문(저작권, 7일 뒤 삭제), 근거 문장(원문 문장 그대로), RSS 설명문, AI 내부 회사 목록, 연결 못 한 기사, 예시 기사, KIS 시세
-- 반복 지시서(R__): 이 파일이 바뀌면 백엔드를 켤 때 다시 실행됨. 다시 실행해도 안전 (기사 주소 기준 갱신)
-- 끄려면 .env 의 FLYWAY_LOCATIONS 에서 classpath:db/ai-data 를 빼기 (docs/setup.md 2절)
"""

LINK_HEAD = """-- 2. 종목 연결: 기사 번호는 PC 마다 달라서 주소로 찾아 붙임. 이 파일의 기사는 연결을 파일 내용과 같게 맞춤
CREATE TEMPORARY TABLE tmp_ai_link (
    url_key          VARCHAR(500)  NOT NULL COLLATE utf8mb4_bin,
    stock_code       CHAR(6)       NOT NULL,
    is_main          BOOLEAN       NOT NULL,
    sentiment        VARCHAR(10)   NULL,
    reason           VARCHAR(500)  NOT NULL,
    match_type       VARCHAR(10)   NULL,
    relevance        DECIMAL(3, 2) NULL,
    matched_keywords VARCHAR(300)  NULL,
    fact_type        VARCHAR(10)   NULL,
    group_url_key    VARCHAR(500)  NULL COLLATE utf8mb4_bin,
    KEY (url_key)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;  -- 다른 표와 같은 비교 규칙 (안 적으면 MariaDB 11.8 기본값이라 종목코드 비교에서 오류)
"""

LINK_TAIL = """-- 파일에 없는 연결만 지우고, 있는 연결은 갱신 (근거 문장 evidence 칸은 건드리지 않음: 파일에 없으므로 내 PC 에 있는 근거를 지키려고)
-- MariaDB 는 한 문장에서 임시 표를 두 번 열 수 없어서 기사 주소 목록을 따로 만듦
CREATE TEMPORARY TABLE tmp_ai_link_key (url_key VARCHAR(500) NOT NULL COLLATE utf8mb4_bin, PRIMARY KEY (url_key))
    DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
    SELECT DISTINCT url_key FROM tmp_ai_link;

DELETE s FROM article_stock s
    JOIN article a ON a.article_id = s.article_id
    JOIN tmp_ai_link_key k ON k.url_key = a.url_key
    LEFT JOIN tmp_ai_link t ON t.url_key = a.url_key AND t.stock_code = s.stock_code
WHERE t.url_key IS NULL;

INSERT INTO article_stock (article_id, stock_code, is_main, sentiment, reason, match_type, relevance, matched_keywords, fact_type)
SELECT a.article_id, t.stock_code, t.is_main, t.sentiment, t.reason, t.match_type, t.relevance, t.matched_keywords, t.fact_type
FROM tmp_ai_link t
    JOIN article a ON a.url_key = t.url_key
    JOIN stock_info i ON i.stock_code = t.stock_code
ON DUPLICATE KEY UPDATE is_main = VALUES(is_main), sentiment = VALUES(sentiment), reason = VALUES(reason),
    match_type = VALUES(match_type), relevance = VALUES(relevance), matched_keywords = VALUES(matched_keywords),
    fact_type = VALUES(fact_type);

-- 같은 소식 묶음 (V13): 대표 기사 주소 → 이 PC 의 기사 번호. 묶이지 않은 연결은 NULL
UPDATE article_stock s
    JOIN article a ON a.article_id = s.article_id
    JOIN tmp_ai_link t ON t.url_key = a.url_key AND t.stock_code = s.stock_code
    LEFT JOIN article g ON g.url_key = t.group_url_key
SET s.group_article_id = g.article_id;

DROP TEMPORARY TABLE tmp_ai_link_key;
DROP TEMPORARY TABLE tmp_ai_link;
"""


def main():
    sql, counts = build(get_engine())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(sql, encoding="utf-8", newline="\n")
    log.info("내보냄 %s: %s, %.1fMB", OUT.name, counts, OUT.stat().st_size / 1e6)
    return counts


if __name__ == "__main__":
    print(main())
