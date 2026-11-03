-- 실시간 시세 저장 (주제 ①②, 1차 범위 밖 확장, 2026-11-03)
-- KIS 웹소켓 실시간 체결(H0STCNT0)을 받아 저장. KIS_ENABLED=true 인 서버만 채움 → 다른 PC에서는 빈 표
-- KIS 시세는 재배포 금지: 이 표의 데이터를 덤프해 Git에 올리거나 외부에 공개하지 않음 (교육용 시연만)

-- 종목마다 "지금 상태" 1줄. 새 체결이 오면 덮어씀
CREATE TABLE quote_snapshot (
    stock_code    CHAR(6)       NOT NULL COMMENT '종목코드',
    price         INT           NOT NULL COMMENT '현재가(마지막 체결가, 원)',
    change_sign   CHAR(1)       NOT NULL COMMENT 'KIS 전일 대비 부호 (1 상한 2 상승 3 보합 4 하한 5 하락)',
    change_amount INT           NOT NULL COMMENT '전일 대비 (원, 하락이면 음수)',
    change_rate   DECIMAL(7, 2) NOT NULL COMMENT '전일 대비율 (%)',
    open_price    INT           NOT NULL COMMENT '시가',
    high_price    INT           NOT NULL COMMENT '고가',
    low_price     INT           NOT NULL COMMENT '저가',
    acc_volume    BIGINT        NOT NULL COMMENT '누적 거래량',
    acc_amount    BIGINT        NOT NULL COMMENT '누적 거래대금 (원)',
    trade_date    DATE          NOT NULL COMMENT '영업일자',
    traded_at     DATETIME      NOT NULL COMMENT '마지막 체결 시각 (거래소, 한국 시간)',
    updated_at    DATETIME(3)   NOT NULL COMMENT '이 줄을 고친 시각 (화면에 밀어 줄 "바뀐 종목"을 고를 때)',
    PRIMARY KEY (stock_code),
    KEY idx_quote_snapshot_updated (updated_at),
    CONSTRAINT fk_quote_snapshot_stock FOREIGN KEY (stock_code) REFERENCES stock_info (stock_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '실시간 현재가 (종목당 1줄)';

-- 체결마다 1줄 = 녹화본. 다시 보기·분봉 만들기·정합성 점검에 씀
CREATE TABLE quote_tick (
    tick_id     BIGINT        NOT NULL AUTO_INCREMENT COMMENT '체결 ID',
    stock_code  CHAR(6)       NOT NULL COMMENT '종목코드',
    trade_date  DATE          NOT NULL COMMENT '영업일자',
    traded_at   DATETIME      NOT NULL COMMENT '체결 시각 (거래소, 초 단위)',
    price       INT           NOT NULL COMMENT '체결가',
    volume      INT           NOT NULL COMMENT '이번 체결 수량',
    acc_volume  BIGINT        NOT NULL COMMENT '누적 거래량 (체결마다 커짐 → 체결 하나를 가리킴)',
    change_rate DECIMAL(7, 2) NOT NULL COMMENT '전일 대비율 (%)',
    trade_side  VARCHAR(2)    NULL     COMMENT 'KIS 체결 구분 (CCLD_DVSN)',
    received_at DATETIME(3)   NOT NULL COMMENT '우리 서버가 받은 시각 (지연 = received_at - traded_at)',
    PRIMARY KEY (tick_id),
    -- 같은 체결을 두 번 저장하지 않음 (재접속 후 같은 체결이 다시 와도 INSERT IGNORE로 한 번만)
    UNIQUE KEY uk_quote_tick (stock_code, trade_date, acc_volume),
    KEY idx_quote_tick_time (stock_code, traded_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '실시간 체결 이력 (녹화본)';

-- 해석하지 못한 메시지는 버리지 않고 원문 그대로 보관 → 원인 확인 (Quarantine)
CREATE TABLE quote_quarantine (
    quarantine_id BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'ID',
    raw           TEXT         NOT NULL COMMENT '받은 원문',
    reason        VARCHAR(200) NOT NULL COMMENT '격리 이유 (칸 개수가 다름, 숫자가 아님 등)',
    received_at   DATETIME(3)  NOT NULL COMMENT '받은 시각',
    PRIMARY KEY (quarantine_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '해석하지 못한 실시간 메시지';
