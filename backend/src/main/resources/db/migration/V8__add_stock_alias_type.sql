-- 별칭 종류 칸 추가 (F-02, 2026-11-02)
-- 같은 "별칭"이라도 믿을 수 있는 정도가 달라서 종류를 표시함
--   SHORT     공식 약칭·흔한 표기   예: 현대차, KT, 한전, 에스오일
--   FORMER    예전 이름             예: 엔씨소프트, LIG넥스원, 티웨이항공
--   NICKNAME  별명·줄임말           예: 삼전, 하닉, 카뱅
--   AMBIGUOUS 다른 종목과 헷갈림    예: 포스코(포스코퓨처엠 등 5개), 모비스(같은 이름의 다른 상장사)
-- 쓰는 곳: 종목 검색은 모든 별칭을, AI 매칭은 AMBIGUOUS를 뺀 별칭을 씀 (WHERE alias_type <> 'AMBIGUOUS')
-- 이미 있는 줄은 기본값 SHORT

ALTER TABLE stock_alias
    ADD COLUMN alias_type VARCHAR(20) NOT NULL DEFAULT 'SHORT'
        COMMENT '별칭 종류: SHORT 약칭, FORMER 예전 이름, NICKNAME 별명, AMBIGUOUS 헷갈림 (AI 매칭 제외)'
        AFTER alias,
    ADD CONSTRAINT ck_stock_alias_type CHECK (alias_type IN ('SHORT', 'FORMER', 'NICKNAME', 'AMBIGUOUS'));
