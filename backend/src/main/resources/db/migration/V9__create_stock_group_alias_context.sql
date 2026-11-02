-- 종목 사전 보조 테이블 2개 (F-02, 2026-11-02). 백엔드가 쓰고 AI 파트는 읽기만 함
-- 아이디어: 임호현(PR #33). 데이터는 반복 지시서 R__stock_group.sql, R__stock_alias_context.sql
-- stock_alias와 외래키를 걸지 않는 이유: R__stock_alias.sql이 실행할 때마다 별칭을 전부 지우고 다시 넣어서,
--   별칭을 가리키는 외래키가 있으면 지우기가 막힘. 맞는지는 StockDictionaryTest가 검사함

-- 기업집단(그룹) 소속 종목. 예: 삼성그룹 → 삼성전자, 삼성SDI, 삼성바이오로직스 …
-- 별칭에 넣지 않는 이유: 한 이름이 여러 종목을 가리켜서, 별칭으로 두면 AI가 그중 한 종목에만 잘못 연결함
CREATE TABLE stock_group (
    group_name VARCHAR(50) NOT NULL COMMENT '그룹 이름 (예: 삼성그룹)',
    stock_code CHAR(6)     NOT NULL COMMENT '종목코드',
    created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 시각',
    PRIMARY KEY (group_name, stock_code),
    KEY idx_stock_group_stock (stock_code),
    CONSTRAINT fk_stock_group_stock FOREIGN KEY (stock_code) REFERENCES stock_info (stock_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '기업집단(그룹) 소속 종목';

-- 헷갈리는 별칭(AMBIGUOUS)의 후보를 고르는 문맥 키워드
-- 예: '한미' + '반도체' → 한미반도체(042700), '한미' + '신약' → 한미약품(128940)
-- (alias, stock_code)는 stock_alias에 alias_type = 'AMBIGUOUS'로 있는 줄이어야 함
CREATE TABLE stock_alias_context (
    alias      VARCHAR(100) NOT NULL COMMENT '헷갈리는 별칭 (stock_alias.alias)',
    stock_code CHAR(6)      NOT NULL COMMENT '후보 종목코드',
    keyword    VARCHAR(50)  NOT NULL COMMENT '이 말이 기사에 있으면 이 종목일 가능성이 높음',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 시각',
    PRIMARY KEY (alias, stock_code, keyword),
    KEY idx_stock_alias_context_stock (stock_code),
    CONSTRAINT fk_stock_alias_context_stock FOREIGN KEY (stock_code) REFERENCES stock_info (stock_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '헷갈리는 별칭의 문맥 키워드';
