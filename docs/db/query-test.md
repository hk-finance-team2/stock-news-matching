# 쿼리 테스트

테이블의 제약 조건이 잘못된 데이터를 실제로 막는지 확인한 기록입니다.
산출물(docx) 양식 순서: 쿼리 ID / 테이블 / 테스트 쿼리 / 설명 / 예상 결과 → 실제 결과 → 검증

- 테스트는 `START TRANSACTION` 안에서 실행하고 마지막에 `ROLLBACK`해서 DB에 흔적을 남기지 않았습니다.
- 대상 테이블 설계는 [DB 설계](schema.md)를 봅니다.

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

## 다음에 추가할 항목

- `EXPLAIN`으로 인덱스 사용 확인 (게시판 최신순 목록, 종목별 기사 목록, 별칭·테마 검색)
- 이슈 종목 순위·언급량 추이 같은 집계 쿼리의 결과 검증
