-- 종목별 감성을 "판단 안 함"(NULL)으로 둘 수 있게 함 (2026-11-05, 백엔드1)
-- 왜: 기사 끝에 "AI 학습 및 활용 금지"를 적은 언론사(연합뉴스·서울경제·연합인포맥스)는 본문을 LLM 에 넣지 않고
--     제목만으로 종목을 연결함 (ai/hk_llm/steps/title_only.py). 본문을 안 보니 감성을 판단할 근거가 없음
--     → NEUTRAL(중립)로 채우면 "중립이라고 판단함"과 구별되지 않고 감성 비율을 왜곡함 → NULL = 판단 안 함
-- 감성 비율 집계(StockMapper.countSentiments)는 NULL 을 세지 않음
-- CHECK 제약(ck_article_stock_sentiment)은 그대로: NULL 은 CHECK 를 통과함 (SQL 표준)
ALTER TABLE article_stock
    MODIFY sentiment VARCHAR(10) NULL COMMENT '종목별 감성: POSITIVE, NEGATIVE, NEUTRAL. NULL = 판단 안 함 (본문을 쓰지 않은 기사)';
