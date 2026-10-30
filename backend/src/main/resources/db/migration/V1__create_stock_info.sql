-- 종목 사전 기본 정보 (F-02). 백엔드가 쓰고 AI 파트는 읽기만 함
CREATE TABLE stock_info (
    stock_code CHAR(6)      NOT NULL COMMENT '종목코드 6자리 (앞자리 0 보존)',
    stock_name VARCHAR(100) NOT NULL COMMENT '종목명',
    market     VARCHAR(10)  NOT NULL COMMENT 'KOSPI, KOSDAQ',
    sector     VARCHAR(100) NULL     COMMENT '업종',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 시각',
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시각',
    PRIMARY KEY (stock_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '종목 기본 정보';
