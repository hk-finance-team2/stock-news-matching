-- 회원, 관심 종목, 종목 토론 게시판 (F-18, F-19, F-20). 백엔드만 씀
-- 삭제 규칙: 게시글에 딸린 댓글·공감은 게시글과 함께 삭제(CASCADE), 그 밖의 참조는 삭제를 막음(기본값)

-- 회원
CREATE TABLE users (
    user_id       BIGINT       NOT NULL AUTO_INCREMENT COMMENT '회원 ID',
    login_id      VARCHAR(30)  NOT NULL COMMENT '로그인 아이디',
    password_hash VARCHAR(100) NOT NULL COMMENT 'BCrypt로 암호화한 비밀번호',
    role          VARCHAR(20)  NOT NULL DEFAULT 'USER' COMMENT '권한: USER, ADMIN',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '가입 시각',
    PRIMARY KEY (user_id),
    UNIQUE KEY uk_users_login_id (login_id),
    CONSTRAINT ck_users_role CHECK (role IN ('USER', 'ADMIN'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '회원';

-- 관심 종목. 회원 1명 x 종목 1개 = 1행
CREATE TABLE watchlist (
    user_id    BIGINT   NOT NULL COMMENT '회원 ID',
    stock_code CHAR(6)  NOT NULL COMMENT '종목코드',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 시각',
    PRIMARY KEY (user_id, stock_code),
    KEY idx_watchlist_stock (stock_code),
    CONSTRAINT fk_watchlist_user FOREIGN KEY (user_id) REFERENCES users (user_id),
    CONSTRAINT fk_watchlist_stock FOREIGN KEY (stock_code) REFERENCES stock_info (stock_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '관심 종목';

-- 게시글. 종목마다 게시판
CREATE TABLE board_post (
    post_id    BIGINT       NOT NULL AUTO_INCREMENT COMMENT '게시글 ID',
    stock_code CHAR(6)      NOT NULL COMMENT '종목코드',
    user_id    BIGINT       NOT NULL COMMENT '작성자 회원 ID',
    title      VARCHAR(200) NOT NULL COMMENT '제목',
    content    TEXT         NOT NULL COMMENT '내용',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '작성 시각',
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시각',
    PRIMARY KEY (post_id),
    KEY idx_board_post_stock_created (stock_code, created_at),
    KEY idx_board_post_user (user_id),
    CONSTRAINT fk_board_post_stock FOREIGN KEY (stock_code) REFERENCES stock_info (stock_code),
    CONSTRAINT fk_board_post_user FOREIGN KEY (user_id) REFERENCES users (user_id),
    CONSTRAINT ck_board_post_title CHECK (TRIM(title) <> '')
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '종목 토론 게시글';

-- 댓글
CREATE TABLE board_comment (
    comment_id BIGINT        NOT NULL AUTO_INCREMENT COMMENT '댓글 ID',
    post_id    BIGINT        NOT NULL COMMENT '게시글 ID',
    user_id    BIGINT        NOT NULL COMMENT '작성자 회원 ID',
    content    VARCHAR(1000) NOT NULL COMMENT '내용',
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '작성 시각',
    PRIMARY KEY (comment_id),
    KEY idx_board_comment_post_created (post_id, created_at),
    KEY idx_board_comment_user (user_id),
    CONSTRAINT fk_board_comment_post FOREIGN KEY (post_id) REFERENCES board_post (post_id) ON DELETE CASCADE,
    CONSTRAINT fk_board_comment_user FOREIGN KEY (user_id) REFERENCES users (user_id),
    CONSTRAINT ck_board_comment_content CHECK (TRIM(content) <> '')
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '게시글 댓글';

-- 공감. 회원 1명이 게시글 1개에 1번만 (다시 누르면 행 삭제로 취소)
CREATE TABLE board_like (
    post_id    BIGINT   NOT NULL COMMENT '게시글 ID',
    user_id    BIGINT   NOT NULL COMMENT '회원 ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '공감 시각',
    PRIMARY KEY (post_id, user_id),
    KEY idx_board_like_user (user_id),
    CONSTRAINT fk_board_like_post FOREIGN KEY (post_id) REFERENCES board_post (post_id) ON DELETE CASCADE,
    CONSTRAINT fk_board_like_user FOREIGN KEY (user_id) REFERENCES users (user_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '게시글 공감';
