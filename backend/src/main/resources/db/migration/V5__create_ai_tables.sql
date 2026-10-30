-- AI 파트가 쓰고 백엔드가 읽는 테이블 (F-01, F-05~F-09, F-16)
-- 바탕: AI 파트 제안서 ai/docs/AI테이블_제안.md (article, article_stock, collect_run)
-- [확장] 표시 칸: 요구사항에 있지만 아직 정해지지 않은 것. 비워 둘 수 있게 해서 AI 코드를 바꾸지 않아도 됨

-- 뉴스·SNS 글 + LLM 요약
CREATE TABLE article (
    article_id     BIGINT        NOT NULL AUTO_INCREMENT COMMENT '기사 ID',
    url_key        VARCHAR(500)  NOT NULL COLLATE utf8mb4_bin COMMENT '추적용 꼬리(utm_*, ref, input)를 뗀 주소. 중복 판단용',
    url            VARCHAR(1000) NOT NULL COMMENT '원래 주소. 화면의 원문 링크',
    press          VARCHAR(100)  NOT NULL COMMENT '언론사 이름 (모르는 곳은 도메인)',
    title          VARCHAR(500)  NOT NULL COMMENT '제목',
    reporter       VARCHAR(100)  NULL     COMMENT '기자명',
    description    TEXT          NULL     COMMENT 'RSS 짧은 요약문',
    body           MEDIUMTEXT    NULL     COMMENT '정제 본문 (LLM 요약용). 7일 후 NULL로 지움. 백엔드·화면에서는 조회하지 않음',
    published_at   DATETIME      NOT NULL COMMENT '발행 시각 (없으면 수집 시각)',
    collected_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '수집 시각',
    status         VARCHAR(20)   NOT NULL DEFAULT 'LISTED' COMMENT '처리 상태',
    retry_count    TINYINT       NOT NULL DEFAULT 0 COMMENT '실패 재시도 횟수 (3번 넘으면 FAILED)',
    last_error     VARCHAR(1000) NULL     COMMENT '마지막 오류',
    summary        TEXT          NULL     COMMENT 'LLM 요약. 계속 보관',
    model          VARCHAR(50)   NULL     COMMENT '요약한 모델 (AI 생성 표시용)',
    summarized_at  DATETIME      NULL     COMMENT '요약 시각',
    -- [확장]
    source_type    VARCHAR(10)   NOT NULL DEFAULT 'NEWS' COMMENT '[확장] NEWS, SNS',
    channel        VARCHAR(20)   NOT NULL DEFAULT 'RSS' COMMENT '[확장] 세부 출처: RSS, NAVER_NEWS, NAVER_BLOG, NAVER_CAFE',
    collect_mode   VARCHAR(10)   NOT NULL DEFAULT 'REALTIME' COMMENT '[확장] REALTIME 실시간, BACKFILL 과거 보충 수집',
    keywords       VARCHAR(500)  NULL     COMMENT '[확장] 핵심 키워드 (쉼표 구분)',
    sentiment      VARCHAR(10)   NULL     COMMENT '[확장] 글 전체 감성: POSITIVE, NEGATIVE, NEUTRAL',
    PRIMARY KEY (article_id),
    UNIQUE KEY uk_article_url_key (url_key),
    KEY idx_article_status (status),
    KEY idx_article_published (published_at),
    CONSTRAINT ck_article_status CHECK (status IN ('LISTED', 'FETCHED', 'SUMMARIZED', 'DONE', 'FAILED', 'SKIPPED', 'NO_STOCK')),
    CONSTRAINT ck_article_source_type CHECK (source_type IN ('NEWS', 'SNS')),
    CONSTRAINT ck_article_collect_mode CHECK (collect_mode IN ('REALTIME', 'BACKFILL')),
    CONSTRAINT ck_article_sentiment CHECK (sentiment IN ('POSITIVE', 'NEGATIVE', 'NEUTRAL'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '뉴스·SNS 글과 LLM 요약';

-- 기사 × 종목 연결. 글 1개에 종목 여러 개
CREATE TABLE article_stock (
    article_id        BIGINT        NOT NULL COMMENT '기사 ID',
    stock_code        CHAR(6)       NOT NULL COMMENT '종목코드',
    is_main           BOOLEAN       NOT NULL DEFAULT FALSE COMMENT '대표 종목 여부',
    sentiment         VARCHAR(10)   NOT NULL COMMENT '종목별 감성: POSITIVE, NEGATIVE, NEUTRAL',
    reason            VARCHAR(500)  NOT NULL COMMENT '판단 이유',
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '연결 시각',
    -- [확장] 매칭 방식이 정해지면 채움 (F-05, F-06)
    match_type        VARCHAR(10)   NULL     COMMENT '[확장] DIRECT 회사명 등장, INDIRECT 이슈 영향',
    relevance         DECIMAL(3, 2) NULL     COMMENT '[확장] 관련도 0.00~1.00 (화면 %는 백엔드가 변환)',
    evidence          VARCHAR(1000) NULL     COMMENT '[확장] 근거가 된 원문 문장',
    matched_keywords  VARCHAR(300)  NULL     COMMENT '[확장] 매칭에 쓰인 키워드 (쉼표 구분)',
    PRIMARY KEY (article_id, stock_code),
    KEY idx_article_stock_stock (stock_code),
    CONSTRAINT fk_article_stock_article FOREIGN KEY (article_id) REFERENCES article (article_id) ON DELETE CASCADE,
    CONSTRAINT fk_article_stock_stock FOREIGN KEY (stock_code) REFERENCES stock_info (stock_code),
    CONSTRAINT ck_article_stock_sentiment CHECK (sentiment IN ('POSITIVE', 'NEGATIVE', 'NEUTRAL')),
    CONSTRAINT ck_article_stock_match_type CHECK (match_type IN ('DIRECT', 'INDIRECT')),
    CONSTRAINT ck_article_stock_relevance CHECK (relevance BETWEEN 0 AND 1)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '기사-종목 연결';

-- 수집·요약 실행 기록 (화면의 "갱신 시각")
CREATE TABLE collect_run (
    run_id            BIGINT      NOT NULL AUTO_INCREMENT COMMENT '실행 ID',
    started_at        DATETIME    NOT NULL COMMENT '시작 시각',
    finished_at       DATETIME    NULL     COMMENT '끝난 시각 (실행 중이면 NULL)',
    status            VARCHAR(10) NOT NULL DEFAULT 'RUNNING' COMMENT 'RUNNING, SUCCESS, FAILED',
    collected_count   INT         NOT NULL DEFAULT 0 COMMENT '새로 받은 기사 수',
    summarized_count  INT         NOT NULL DEFAULT 0 COMMENT '요약한 기사 수',
    error             TEXT        NULL     COMMENT '실패 원인',
    -- [확장]
    channel           VARCHAR(20) NULL     COMMENT '[확장] 어디서 모았나 (RSS, NAVER_NEWS 등)',
    PRIMARY KEY (run_id),
    KEY idx_collect_run_status_finished (status, finished_at),
    CONSTRAINT ck_collect_run_status CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '수집·요약 실행 기록';

-- [확장] 종목별 하루 종합 요약 (F-08). AI 쪽은 나중에 채움, 표만 미리 만들어 둠
CREATE TABLE stock_daily_summary (
    summary_id    BIGINT   NOT NULL AUTO_INCREMENT COMMENT '요약 ID',
    stock_code    CHAR(6)  NOT NULL COMMENT '종목코드',
    summary_date  DATE     NOT NULL COMMENT '날짜',
    news_summary  TEXT     NULL     COMMENT '뉴스 요약',
    sns_summary   TEXT     NULL     COMMENT 'SNS 반응 요약',
    pos_count     INT      NOT NULL DEFAULT 0 COMMENT '긍정 글 수',
    neg_count     INT      NOT NULL DEFAULT 0 COMMENT '부정 글 수',
    neu_count     INT      NOT NULL DEFAULT 0 COMMENT '중립 글 수',
    generated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 시각 (다시 만들면 갱신)',
    PRIMARY KEY (summary_id),
    UNIQUE KEY uk_stock_daily_summary (stock_code, summary_date),
    CONSTRAINT fk_stock_daily_summary_stock FOREIGN KEY (stock_code) REFERENCES stock_info (stock_code),
    CONSTRAINT ck_stock_daily_summary_counts CHECK (pos_count >= 0 AND neg_count >= 0 AND neu_count >= 0)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '종목별 하루 종합 요약';
