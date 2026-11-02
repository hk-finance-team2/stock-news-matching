-- V9: 모호한 별칭 구분 컬럼
ALTER TABLE stock_alias
ADD COLUMN ambiguous BOOLEAN NOT NULL DEFAULT FALSE
COMMENT '여러 종목이나 그룹을 의미할 수 있는 모호한 별칭 여부';

-- 모호한 별칭 및 그룹 별칭 표시
UPDATE stock_alias
SET ambiguous = TRUE
WHERE alias IN (
    '한미', '디비', '한타', '한조',
    '삼바', '카이', '두에', '두로',
    '포인', '유한', '엘화', '현건'
)
OR alias_type = 'GROUP';


-- 별칭 문맥 키워드 테이블
CREATE TABLE stock_alias_context (
    alias VARCHAR(50) NOT NULL,
    keyword VARCHAR(50) NOT NULL,

    PRIMARY KEY (alias, keyword)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- 문맥 키워드 데이터
INSERT INTO stock_alias_context (alias, keyword) VALUES
('한미', '약품'),
('한미', '신약'),
('한미', '제약'),
('디비', '주가'),
('디비', '손해보험'),
('디비', '하이텍'),
('삼바', '바이오'),
('삼바', 'CMO'),
('삼바', '셀트리온');