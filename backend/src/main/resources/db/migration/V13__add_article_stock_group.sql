-- 같은 소식 묶음 (2026-11-09)
-- AI 의 step7_group.save_groups() 가 5분마다 "같은 종목 + 24시간 안 + 제목이 비슷한" 기사를 묶어,
-- 묶음의 대표 기사 번호(묶음에서 가장 먼저 저장된 기사)를 여기에 넣음. 묶이지 않은 기사는 NULL
-- 그동안은 이 칸이 없어서 묶은 결과를 매번 버렸고, 화면 집계가 같은 소식을 여러 번 셌음
--   (11/03 이후 종목 연결의 46% 가 반복 보도. 근거: docs/decisions.md 2026-11-09 같은 소식 묶기)
-- 백엔드는 "사건 수 = 대표 번호가 있으면 그 번호, 없으면 자기 번호"로 셈 (COALESCE)
ALTER TABLE article_stock
    ADD COLUMN group_article_id BIGINT NULL COMMENT '같은 소식 묶음의 대표 기사 번호 (AI 가 씀). 묶이지 않으면 NULL';

-- 종목별로 묶음을 셀 때 씀 (이슈 순위·감성 비율의 사건 수)
CREATE INDEX idx_article_stock_group ON article_stock (stock_code, group_article_id);
