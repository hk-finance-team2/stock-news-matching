# DB 설계 (테이블 정의서 · ERD)

- DB: MariaDB 11.8.9, 문자셋 utf8mb4 / utf8mb4_unicode_ci, 시간대 +09:00
- 테이블 생성·변경은 백엔드가 Flyway로만 합니다. (`backend/src/main/resources/db/migration`)
- 이 문서는 Flyway SQL을 기준으로 씁니다. 테이블을 바꾸면 이 문서도 같은 PR에서 고칩니다.
- 제약 조건이 실제로 동작하는지는 [쿼리 테스트](query-test.md)에 기록합니다.

## 테이블 목록

| 테이블 | 설명 | 쓰는 파트 | 읽는 파트 | Flyway | 상태 |
|---|---|---|---|---|---|
| `stock_info` | 종목 기본 정보 | 백엔드 | AI, 백엔드 | V1 | ✅ |
| `stock_alias` | 종목 약칭·별칭 | 백엔드 | AI, 백엔드 | V3 | ✅ |
| `stock_theme` | 종목 테마 키워드 | 백엔드 | AI, 백엔드 | V3 | ✅ |
| `match_setting` | 매칭 가중치·최소 점수 | 백엔드 | AI | V3 | ✅ |
| `users` | 회원 | 백엔드 | 백엔드 | V4 | ✅ |
| `watchlist` | 관심 종목 | 백엔드 | 백엔드 | V4 | ✅ |
| `board_post` | 종목 토론 게시글 | 백엔드 | 백엔드 | V4 | ✅ |
| `board_comment` | 게시글 댓글 | 백엔드 | 백엔드 | V4 | ✅ |
| `board_like` | 게시글 공감 | 백엔드 | 백엔드 | V4 | ✅ |
| `article` 외 4개 | 뉴스·SNS 글, 분석, 매칭 결과, 종합 요약, 수집 기록 | AI | 백엔드 | - | AI 파트와 컬럼 합의 후 |

## 설계 원칙

- **시각:** 모두 `DATETIME` (한국 시간). 문자열로 저장하지 않음
- **같은 의미의 키는 같은 타입:** 종목코드는 어디서나 `CHAR(6)`, 회원 ID는 어디서나 `BIGINT`
- **종목코드는 문자열:** `"005930"`처럼 앞자리 0 보존
- **모든 컬럼에 COMMENT:** DB만 봐도 뜻을 알 수 있게
- **잘못된 데이터는 DB에서도 막음:** UNIQUE(중복), FOREIGN KEY(없는 대상 참조), CHECK(허용 값·빈 문자열)
- **삭제 규칙:** 게시글에 딸린 댓글·공감은 게시글과 함께 삭제(`ON DELETE CASCADE`). 그 밖의 참조는 삭제를 막음(기본값 `RESTRICT`)
- **이름 규칙:** 기본키 `PK`, 유니크 `uk_테이블_컬럼`, 인덱스 `idx_테이블_컬럼`, 외래키 `fk_테이블_대상`, 체크 `ck_테이블_컬럼`

## ERD

GitHub에서는 아래 그림이 자동으로 그려집니다.

```mermaid
erDiagram
    stock_info ||--o{ stock_alias : "별칭"
    stock_info ||--o{ stock_theme : "테마"
    stock_info ||--o{ watchlist : "관심 등록"
    stock_info ||--o{ board_post : "종목 게시판"
    users ||--o{ watchlist : "관심 등록"
    users ||--o{ board_post : "작성"
    users ||--o{ board_comment : "작성"
    users ||--o{ board_like : "공감"
    board_post ||--o{ board_comment : "댓글"
    board_post ||--o{ board_like : "공감"

    stock_info {
        CHAR(6) stock_code PK
        VARCHAR(100) stock_name
        VARCHAR(10) market
        VARCHAR(100) sector
        DATETIME created_at
        DATETIME updated_at
    }
    stock_alias {
        BIGINT alias_id PK
        CHAR(6) stock_code FK
        VARCHAR(100) alias
        DATETIME created_at
    }
    stock_theme {
        BIGINT theme_id PK
        CHAR(6) stock_code FK
        VARCHAR(50) theme
        DATETIME created_at
    }
    match_setting {
        VARCHAR(50) setting_key PK
        DECIMAL(4_2) setting_value
        VARCHAR(200) description
        DATETIME updated_at
    }
    users {
        BIGINT user_id PK
        VARCHAR(30) login_id UK
        VARCHAR(100) password_hash
        VARCHAR(20) role
        DATETIME created_at
    }
    watchlist {
        BIGINT user_id PK, FK
        CHAR(6) stock_code PK, FK
        DATETIME created_at
    }
    board_post {
        BIGINT post_id PK
        CHAR(6) stock_code FK
        BIGINT user_id FK
        VARCHAR(200) title
        TEXT content
        DATETIME created_at
        DATETIME updated_at
    }
    board_comment {
        BIGINT comment_id PK
        BIGINT post_id FK
        BIGINT user_id FK
        VARCHAR(1000) content
        DATETIME created_at
    }
    board_like {
        BIGINT post_id PK, FK
        BIGINT user_id PK, FK
        DATETIME created_at
    }
```

`match_setting`은 다른 테이블과 연결되지 않는 설정 테이블입니다.

## 테이블 정의서

산출물(xlsx) 양식과 같은 열 순서입니다: Col # / Column Name / Data Type / Key / Not Null / Default / Comments

### stock_info · 종목 기본 정보 (V1)

| # | Column Name | Data Type | Key | Not Null | Default | Comments |
|---|---|---|---|---|---|---|
| 1 | stock_code | CHAR(6) | PK | Y | | 종목코드 6자리 (앞자리 0 보존) |
| 2 | stock_name | VARCHAR(100) | | Y | | 종목명 |
| 3 | market | VARCHAR(10) | | Y | | KOSPI, KOSDAQ |
| 4 | sector | VARCHAR(100) | | N | | 업종 |
| 5 | created_at | DATETIME | | Y | CURRENT_TIMESTAMP | 등록 시각 |
| 6 | updated_at | DATETIME | | Y | CURRENT_TIMESTAMP (수정 시 갱신) | 수정 시각 |

### stock_alias · 종목 약칭·별칭 (V3)

| # | Column Name | Data Type | Key | Not Null | Default | Comments |
|---|---|---|---|---|---|---|
| 1 | alias_id | BIGINT | PK | Y | AUTO_INCREMENT | 별칭 ID |
| 2 | stock_code | CHAR(6) | FK → stock_info, UK① | Y | | 종목코드 |
| 3 | alias | VARCHAR(100) | UK①, IDX | Y | | 약칭·별칭 (예: 삼전) |
| 4 | created_at | DATETIME | | Y | CURRENT_TIMESTAMP | 등록 시각 |

- UK① `uk_stock_alias (stock_code, alias)`: 같은 종목에 같은 별칭은 한 번만. 다른 종목에는 같은 별칭 가능
- IDX `idx_stock_alias_alias (alias)`: 별칭으로 종목 찾기

### stock_theme · 종목 테마 키워드 (V3)

| # | Column Name | Data Type | Key | Not Null | Default | Comments |
|---|---|---|---|---|---|---|
| 1 | theme_id | BIGINT | PK | Y | AUTO_INCREMENT | 테마 ID |
| 2 | stock_code | CHAR(6) | FK → stock_info, UK① | Y | | 종목코드 |
| 3 | theme | VARCHAR(50) | UK①, IDX | Y | | 테마 키워드 (예: 방산) |
| 4 | created_at | DATETIME | | Y | CURRENT_TIMESTAMP | 등록 시각 |

- UK① `uk_stock_theme (stock_code, theme)`, IDX `idx_stock_theme_theme (theme)`: 테마로 종목 찾기

### match_setting · 매칭 설정값 (V3)

| # | Column Name | Data Type | Key | Not Null | Default | Comments |
|---|---|---|---|---|---|---|
| 1 | setting_key | VARCHAR(50) | PK | Y | | 설정 이름 |
| 2 | setting_value | DECIMAL(4,2) | | Y | | 설정 값 (0.00~1.00) |
| 3 | description | VARCHAR(200) | | N | | 설명 |
| 4 | updated_at | DATETIME | | Y | CURRENT_TIMESTAMP (수정 시 갱신) | 수정 시각 |

초기값 (V3에서 입력, 요구사항 2026-10-29 기준):

| setting_key | setting_value | description |
|---|---|---|
| name_weight | 0.40 | 종목명 일치 가중치 |
| theme_weight | 0.40 | 테마 일치 가중치 |
| context_weight | 0.20 | 문맥(LLM 판단) 가중치 |
| min_score | 0.70 | 저장할 최소 관련도 |

### users · 회원 (V4)

| # | Column Name | Data Type | Key | Not Null | Default | Comments |
|---|---|---|---|---|---|---|
| 1 | user_id | BIGINT | PK | Y | AUTO_INCREMENT | 회원 ID |
| 2 | login_id | VARCHAR(30) | UK | Y | | 로그인 아이디 |
| 3 | password_hash | VARCHAR(100) | | Y | | BCrypt로 암호화한 비밀번호 |
| 4 | role | VARCHAR(20) | CHECK | Y | 'USER' | 권한: USER, ADMIN |
| 5 | created_at | DATETIME | | Y | CURRENT_TIMESTAMP | 가입 시각 |

- UK `uk_users_login_id (login_id)`: 아이디 중복 금지
- CHECK `ck_users_role`: `role IN ('USER', 'ADMIN')`

### watchlist · 관심 종목 (V4)

| # | Column Name | Data Type | Key | Not Null | Default | Comments |
|---|---|---|---|---|---|---|
| 1 | user_id | BIGINT | PK, FK → users | Y | | 회원 ID |
| 2 | stock_code | CHAR(6) | PK, FK → stock_info, IDX | Y | | 종목코드 |
| 3 | created_at | DATETIME | | Y | CURRENT_TIMESTAMP | 등록 시각 |

- PK `(user_id, stock_code)`: 같은 종목을 두 번 등록할 수 없음
- IDX `idx_watchlist_stock (stock_code)`: 종목 쪽에서 찾기

### board_post · 종목 토론 게시글 (V4)

| # | Column Name | Data Type | Key | Not Null | Default | Comments |
|---|---|---|---|---|---|---|
| 1 | post_id | BIGINT | PK | Y | AUTO_INCREMENT | 게시글 ID |
| 2 | stock_code | CHAR(6) | FK → stock_info, IDX① | Y | | 종목코드 |
| 3 | user_id | BIGINT | FK → users, IDX | Y | | 작성자 회원 ID |
| 4 | title | VARCHAR(200) | CHECK | Y | | 제목 |
| 5 | content | TEXT | | Y | | 내용 |
| 6 | created_at | DATETIME | IDX① | Y | CURRENT_TIMESTAMP | 작성 시각 |
| 7 | updated_at | DATETIME | | Y | CURRENT_TIMESTAMP (수정 시 갱신) | 수정 시각 |

- IDX① `idx_board_post_stock_created (stock_code, created_at)`: 종목 게시판 최신순 목록
- CHECK `ck_board_post_title`: 공백만 있는 제목 금지

### board_comment · 게시글 댓글 (V4)

| # | Column Name | Data Type | Key | Not Null | Default | Comments |
|---|---|---|---|---|---|---|
| 1 | comment_id | BIGINT | PK | Y | AUTO_INCREMENT | 댓글 ID |
| 2 | post_id | BIGINT | FK → board_post (CASCADE), IDX① | Y | | 게시글 ID |
| 3 | user_id | BIGINT | FK → users, IDX | Y | | 작성자 회원 ID |
| 4 | content | VARCHAR(1000) | CHECK | Y | | 내용 |
| 5 | created_at | DATETIME | IDX① | Y | CURRENT_TIMESTAMP | 작성 시각 |

- IDX① `idx_board_comment_post_created (post_id, created_at)`: 게시글의 댓글을 시간순으로
- 게시글이 삭제되면 댓글도 함께 삭제
- CHECK `ck_board_comment_content`: 공백만 있는 댓글 금지

### board_like · 게시글 공감 (V4)

| # | Column Name | Data Type | Key | Not Null | Default | Comments |
|---|---|---|---|---|---|---|
| 1 | post_id | BIGINT | PK, FK → board_post (CASCADE) | Y | | 게시글 ID |
| 2 | user_id | BIGINT | PK, FK → users, IDX | Y | | 회원 ID |
| 3 | created_at | DATETIME | | Y | CURRENT_TIMESTAMP | 공감 시각 |

- PK `(post_id, user_id)`: 한 회원이 한 게시글에 공감 1번. 다시 누르면 행을 지워 취소
- 공감 수는 따로 저장하지 않고 `COUNT(*)`로 셈
- 게시글이 삭제되면 공감도 함께 삭제

## 변경 이력

| 날짜 | Flyway | 내용 |
|---|---|---|
| 2026-10-30 | V1 | stock_info |
| 2026-10-30 | V2 | 예시 종목 5개 (개발·연결 확인용) |
| 2026-10-30 | V3 | stock_alias, stock_theme, match_setting + 초기값 |
| 2026-10-30 | V4 | users, watchlist, board_post, board_comment, board_like |
