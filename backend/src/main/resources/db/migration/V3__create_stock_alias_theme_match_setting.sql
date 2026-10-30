-- 종목 사전 보조 테이블과 매칭 설정 (F-02, F-05). 백엔드가 쓰고 AI 파트는 읽기만 함

-- 약칭·별칭. 예: 삼전 -> 삼성전자
CREATE TABLE stock_alias (
    alias_id   BIGINT       NOT NULL AUTO_INCREMENT COMMENT '별칭 ID',
    stock_code CHAR(6)      NOT NULL COMMENT '종목코드',
    alias      VARCHAR(100) NOT NULL COMMENT '약칭·별칭',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 시각',
    PRIMARY KEY (alias_id),
    UNIQUE KEY uk_stock_alias (stock_code, alias),
    KEY idx_stock_alias_alias (alias),
    CONSTRAINT fk_stock_alias_stock FOREIGN KEY (stock_code) REFERENCES stock_info (stock_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '종목 약칭·별칭';

-- 테마 키워드. 예: 한화에어로스페이스 -> 방산, 우주항공
CREATE TABLE stock_theme (
    theme_id   BIGINT      NOT NULL AUTO_INCREMENT COMMENT '테마 ID',
    stock_code CHAR(6)     NOT NULL COMMENT '종목코드',
    theme      VARCHAR(50) NOT NULL COMMENT '테마 키워드',
    created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 시각',
    PRIMARY KEY (theme_id),
    UNIQUE KEY uk_stock_theme (stock_code, theme),
    KEY idx_stock_theme_theme (theme),
    CONSTRAINT fk_stock_theme_stock FOREIGN KEY (stock_code) REFERENCES stock_info (stock_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '종목 테마 키워드';

-- 매칭 설정값. 결과를 보며 조정하려고 코드가 아닌 DB에 둠
CREATE TABLE match_setting (
    setting_key   VARCHAR(50)  NOT NULL COMMENT '설정 이름',
    setting_value DECIMAL(4, 2) NOT NULL COMMENT '설정 값 (0.00~1.00)',
    description   VARCHAR(200) NULL     COMMENT '설명',
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시각',
    PRIMARY KEY (setting_key)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '매칭 설정값';

-- 요구사항(2026-10-29)의 초기값
INSERT INTO match_setting (setting_key, setting_value, description) VALUES
    ('name_weight', 0.40, '종목명 일치 가중치'),
    ('theme_weight', 0.40, '테마 일치 가중치'),
    ('context_weight', 0.20, '문맥(LLM 판단) 가중치'),
    ('min_score', 0.70, '저장할 최소 관련도');
