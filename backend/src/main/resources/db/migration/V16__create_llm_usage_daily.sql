-- LLM 하루 비용 (AI 가 씀, 2026-11-13)
-- 하루 상한(LLM_DAILY_USD)을 수집기 컨테이너·내 PC 실행이 같이 세려고 파일(logs/llm_usage.json) 대신 DB 에 둠
-- 쓰기: INSERT ... ON DUPLICATE KEY UPDATE 로 더하기만 (동시에 써도 빠지지 않음)
CREATE TABLE llm_usage_daily (
    usage_date    DATE           NOT NULL COMMENT '한국 시간 날짜',
    input_tokens  BIGINT         NOT NULL DEFAULT 0,
    output_tokens BIGINT         NOT NULL DEFAULT 0,
    usd           DECIMAL(12, 6) NOT NULL DEFAULT 0 COMMENT '추정 비용(달러). 토큰 × 단가 (step5_summary.PRICE_IN/OUT)',
    updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (usage_date)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'LLM 하루 비용 (AI 씀)';
