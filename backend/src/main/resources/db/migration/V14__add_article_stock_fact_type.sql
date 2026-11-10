-- 근거 문장의 사실 종류 (2026-11-10)
-- AI 요약 단계의 LLM 이 회사마다 근거 문장이 어떤 문장인지 고름: FACT 일어난 일, PLAN 회사 계획, FORECAST 전망·의견, RUMOR 소문
-- 그동안은 article.companies(JSON) 안에만 있고 판단 보류(전망·소문뿐이면 감성 NULL)에만 썼음
-- 화면에 "근거 문장 + 사실 종류"를 같이 보여 주려고 칸으로 꺼냄 (멘토 피드백 "보수적으로 정보만 제공",
--   금융위 금융분야 AI 가이드라인 "인용 출처 제공". 근거: docs/decisions.md 2026-11-10)
-- 이미 저장된 연결은 NULL (새 기사부터 AI 매칭 단계가 채움). 제목만 연결·공시 연결도 NULL
ALTER TABLE article_stock
    ADD COLUMN fact_type VARCHAR(10) NULL COMMENT '근거 문장의 사실 종류: FACT, PLAN, FORECAST, RUMOR (AI 가 씀). 없으면 NULL',
    ADD CONSTRAINT chk_article_stock_fact_type CHECK (fact_type IS NULL OR fact_type IN ('FACT', 'PLAN', 'FORECAST', 'RUMOR'));
