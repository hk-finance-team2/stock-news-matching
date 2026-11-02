# 쿼리 테스트

SQL을 DB에서 직접 실행해 예상 결과와 실제 결과를 비교한 기록입니다.
- QT-01~29: 테이블의 제약 조건(UNIQUE·FK·CHECK)이 잘못된 데이터를 실제로 막는지
- QT-30~: 화면용 API가 쓰는 조회·집계 SQL이 맞는 결과를 내는지, 인덱스를 타는지

산출물(docx) 양식 순서: 쿼리 ID / 테이블 / 테스트 쿼리 / 설명 / 예상 결과 → 실제 결과 → 검증

- 데이터를 바꾸는 테스트는 `START TRANSACTION` 안에서 실행하고 마지막에 `ROLLBACK`해서 DB에 흔적을 남기지 않았습니다.
- 대상 테이블 설계는 [DB 설계](schema.md)를 봅니다.
- 같은 SQL은 백엔드 자동 테스트(`backend/src/test/`, PR마다 GitHub Actions)로도 매번 확인합니다. 이 문서는 SQL 한 문장 단위의 기록입니다.

## 2026-10-30 · V4 (회원·관심 종목·게시판)

환경: MariaDB 11.8.9 (Docker), 예시 종목 5개(V2)가 있는 상태

| 쿼리 ID | 테이블 | 테스트 쿼리 | 설명 | 예상 결과 | 실제 결과 | 검증 |
|---|---|---|---|---|---|---|
| QT-01 | users | `INSERT INTO users (login_id, password_hash) VALUES ('tester', 'hash')` | 정상 가입 | 성공 | 성공 | ✅ |
| QT-02 | users | 같은 `login_id`로 한 번 더 INSERT | 아이디 중복 | 실패 (UNIQUE) | `ERROR 1062 Duplicate entry 'tester' for key 'uk_users_login_id'` | ✅ |
| QT-03 | users | `role = 'KING'`으로 INSERT | 없는 권한 | 실패 (CHECK) | `ERROR 4025 CONSTRAINT ck_users_role failed` | ✅ |
| QT-04 | watchlist | 회원 + `'005930'` INSERT | 정상 관심 종목 등록 | 성공 | 성공 | ✅ |
| QT-05 | watchlist | 같은 회원 + `'005930'` 한 번 더 | 관심 종목 중복 | 실패 (PK) | `ERROR 1062 Duplicate entry '1-005930' for key 'PRIMARY'` | ✅ |
| QT-06 | watchlist | 회원 + `'999999'` INSERT | 없는 종목코드 | 실패 (FK) | `ERROR 1452 ... fk_watchlist_stock` | ✅ |
| QT-07 | board_post | `title = '   '`으로 INSERT | 공백 제목 | 실패 (CHECK) | `ERROR 4025 CONSTRAINT ck_board_post_title failed` | ✅ |
| QT-08 | board_post, board_comment, board_like | 게시글 1개, 댓글 1개, 공감 1개 INSERT | 정상 작성 | 성공 | 성공 | ✅ |
| QT-09 | board_like | 같은 회원이 같은 글에 공감 한 번 더 | 공감 중복 | 실패 (PK) | `ERROR 1062 Duplicate entry '1-1' for key 'PRIMARY'` | ✅ |
| QT-10 | board_post | `DELETE FROM board_post WHERE post_id = ?` 후 댓글·공감 수 조회 | 게시글 삭제 시 함께 삭제 | 댓글 0, 공감 0 | 댓글 0, 공감 0 | ✅ |
| QT-11 | users | 관심 종목이 있는 회원 DELETE | 참조 중인 회원 삭제 | 실패 (FK RESTRICT) | `ERROR 1451 ... fk_watchlist_user` | ✅ |
| QT-12 | 전체 | `ROLLBACK` 후 `SELECT COUNT(*) FROM users` | 테스트 흔적 제거 | 0 | 0 | ✅ |

## 2026-10-30 · V5 (AI 파트 테이블)

환경: 같은 DB, 예시 종목 5개(V2). 핵심은 **AI 코드가 [확장] 칸을 몰라도 저장되는지**

| 쿼리 ID | 테이블 | 테스트 쿼리 | 설명 | 예상 결과 | 실제 결과 | 검증 |
|---|---|---|---|---|---|---|
| QT-13 | article | 제안서 칸(`url_key`, `url`, `press`, `title`, `published_at`)만 INSERT | AI 코드 그대로 저장 | 성공, [확장] 칸은 기본값 | 성공, `LISTED`/`NEWS`/`RSS`/`REALTIME`/NULL | ✅ |
| QT-14 | article | 같은 `url_key`로 한 번 더 | 기사 중복 | 실패 (UNIQUE) | `ERROR 1062 ... uk_article_url_key` | ✅ |
| QT-15 | article | 대소문자만 다른 `url_key` | 다른 주소로 인정 | 성공 | 성공 (`utf8mb4_bin`) | ✅ |
| QT-16 | article | `status = 'HELLO'` | 없는 상태값 | 실패 (CHECK) | `ERROR 4025 ck_article_status` | ✅ |
| QT-17 | article_stock | 제안서 칸만으로 `005930` 연결 | AI 코드 그대로 저장 | 성공 | 성공 | ✅ |
| QT-18 | article_stock | 종목 사전에 없는 `035720` | 없는 종목 | 실패 (FK) | `ERROR 1452 ... fk_article_stock_stock` | ✅ |
| QT-19 | article_stock | [확장] 칸 포함 (`INDIRECT`, 0.85, 근거 문장) | 확장 칸 저장 | 성공 | 성공 | ✅ |
| QT-20 | article_stock | `relevance = 1.50` | 관련도 범위 밖 | 실패 (CHECK) | `ERROR 4025 ck_article_stock_relevance` | ✅ |
| QT-21 | article_stock | `match_type = 'MAYBE'` | 없는 값 | 실패 (CHECK) | `ERROR 4025 ck_article_stock_match_type` | ✅ |
| QT-22 | stock_daily_summary | 같은 종목·같은 날 두 번 | 하루 한 줄 | 실패 (UNIQUE) | `ERROR 1062 ... uk_stock_daily_summary` | ✅ |
| QT-23 | collect_run | `SELECT MAX(finished_at) ... WHERE status = 'SUCCESS'` | 마지막 성공 수집 시각 | 09:01 | 09:01 | ✅ |
| QT-24 | article | 기사 DELETE 후 연결 수 조회 | 기사 삭제 시 연결도 삭제 | 0 | 0 | ✅ |

## 2026-11-02 · V6 (종목 사전 2,655개)

| 쿼리 ID | 테이블 | 테스트 쿼리 | 설명 | 예상 결과 | 실제 결과 | 검증 |
|---|---|---|---|---|---|---|
| QT-25 | flyway_schema_history | 서버 시작 로그 + `SELECT version ...` | V5까지 된 DB에 V6만 실행되는지 | V6만 실행 | `Current version: 5` → `Migrating to version 6` → v6 | ✅ |
| QT-26 | stock_info | `SELECT market, COUNT(*) ... GROUP BY market` | 시장별 개수 | KOSPI 829, KOSDAQ 1,826 | KOSPI 829, KOSDAQ 1,826 | ✅ |
| QT-27 | stock_info | 예시 5개 종목 조회 | 공식 값으로 덮어썼는지 | 업종이 공식 분류로 바뀜 | 삼성전자 "통신 및 방송 장비 제조업" 등 | ✅ |
| QT-28 | article_stock | `035720`(카카오), `005380`(현대자동차) 연결 INSERT | QT-18에서 막혔던 종목 | 성공 | 성공 (ROLLBACK) | ✅ |
| QT-29 | watchlist | V6 후 기존 관심 종목 조회 | 기존 데이터 유지 | 그대로 | 그대로 | ✅ |

## 2026-11-02 · V7 (article.companies)과 화면용 조회 쿼리

환경: MariaDB 11.8.9 (Docker), 종목 2,655개(V6), 예시 기사 10건(`DONE` 8, `NO_STOCK` 1, `SUMMARIZED` 1, 같은 날 07:00~10:40 사이 작성, 현대자동차 1건은 전날), 실행 시각 14:11

| 쿼리 ID | 테이블 | 테스트 쿼리 | 설명 | 예상 결과 | 실제 결과 | 검증 |
|---|---|---|---|---|---|---|
| QT-30 | article | `UPDATE article SET companies = '[{"name":"포스코퓨처엠",...}]'` 후 `JSON_VALUE(companies, '$[0].name')` | V7 JSON 칸에 정상 값 | 저장되고 꺼낼 수 있음 | `포스코퓨처엠` (ROLLBACK) | ✅ |
| QT-31 | article | `companies = '[{name: 깨짐'` | 깨진 JSON | 실패 (CHECK `json_valid`) | `ERROR 4025 CONSTRAINT article.companies failed` | ✅ |
| QT-32 | stock_info | `WHERE stock_name LIKE '%삼성%' ... ORDER BY CASE(이름 일치 0 → 이름 시작 1 → 코드 시작 2 → 나머지 3), CHAR_LENGTH(stock_name)` | 종목 검색 순위 | 이름이 "삼성"으로 시작하는 짧은 이름부터 | 21개 중 삼성공조·삼성물산·삼성생명·삼성전기·삼성전자 | ✅ |
| QT-33 | article, article_stock | `WHERE status = 'DONE' AND EXISTS (... stock_code = '005930')` | 글 목록: 분석 끝난 글 + 종목 거르기 | 10건 중 DONE 8건, 그중 삼성전자 연결 2건 | DONE 8, 2건 (최신순) | ✅ |
| QT-34 | article_stock | `WHERE article_id IN (DONE 글 8개) GROUP BY article_id` | 관련 종목 칩을 SQL 한 번에 (N+1 방지) | 8개 글의 칩이 한 번에 | 8개 글, 칩 1~4개씩 (총 17) | ✅ |
| QT-35 | article_stock, article, stock_info | `WHERE status = 'DONE' AND published_at >= CURDATE() GROUP BY stock_code ORDER BY COUNT(*) DESC, AVG(relevance) DESC` | 오늘의 이슈 종목 순위 | 글 수 같으면 평균 관련도 순, 전날 글 제외 | 한화에어로스페이스 2(85%) → 삼성전자 2(83%) → 대한항공 2(69%) → SK하이닉스 2(64%), 현대자동차는 전체 2건 중 오늘 1건만 | ✅ |
| QT-36 | article_stock, article | `WHERE stock_code = '005930' AND published_at >= CURDATE() GROUP BY s.sentiment` | 종목 감성 비율 재료 | 긍정 1, 중립 1 (부정 0건은 줄이 없음) | `NEUTRAL 1`, `POSITIVE 1` | ✅ |
| QT-37 | article_stock, article | `GROUP BY DATE_FORMAT(published_at, '%Y-%m-%d %H:00:00')`, `SUM(CASE WHEN source_type = 'NEWS' THEN 1 ELSE 0 END)` | 언급량 시간 칸 (대한항공) | 07시 SNS 1, 10시 뉴스 1, 글 없는 칸은 줄이 없음 | `07:00 뉴스 0 SNS 1`, `10:00 뉴스 1 SNS 0` | ✅ |
| QT-38 | stock_info, article_stock, article | 종목마다 `(SELECT COUNT(*) ... >= CURDATE())`, `(SELECT MAX(published_at) ...)` 서브쿼리 | 관심 종목의 오늘 글 수·최근 시각 | 기아 0·NULL, 대한항공 2·10:10, 현대자동차 1(전날 글 제외)·03:10 | 같음 | ✅ |
| QT-39 | article, article_stock | 관심 종목 2개(한화·대한항공): `EXISTS (... stock_code IN (...))` vs `JOIN` | 두 종목에 걸친 글의 중복 | EXISTS는 글 3건, JOIN은 겹치는 글이 두 줄 | EXISTS 3, JOIN 4 | ✅ |
| QT-40 | - | `'10%' LIKE '%10\%%'`, `'100원' LIKE '%10\%%'`, `'100원' LIKE '%10%%'` | 검색어의 %를 글자 그대로 | 1, 0, 1 (그냥 쓰면 100원도 걸림) | 1, 0, 1 | ✅ |
| QT-41 | article_stock, article | `EXPLAIN` 종목별 기사 목록, 종목 감성 개수 | 인덱스 사용 | `article_stock`은 `idx_article_stock_stock`, `article`은 기본키로 한 줄씩 | `x ref idx_article_stock_stock`, `a eq_ref` (두 쿼리 모두) | ✅ |

- QT-34: 글마다 칩을 따로 조회하면 SQL이 1 + 8번. `IN`으로 묶어 2번(글 페이지 1 + 칩 1)
- QT-39: JOIN으로 붙이면 글이 연결 종목 수만큼 불어나 목록 중복·페이지 틀어짐 → API는 `EXISTS` 사용
- QT-41: 종목코드로 먼저 좁히고(인덱스) 기사는 기본키로 찾아 데이터가 늘어도 전체를 훑지 않음. 감성 개수의 `Using temporary; Using filesort`는 GROUP BY 정리용이고 대상 줄이 그 종목 것뿐이라 작음

## 다음에 추가할 항목

- `EXPLAIN`으로 게시판 최신순 목록, 별칭·테마 검색 확인
- 기사가 많이 쌓인 뒤 이슈 순위·검색(`LIKE '%q%'`) 실행 시간 측정
