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

## 다음에 추가할 항목

- `EXPLAIN`으로 인덱스 사용 확인 (게시판 최신순 목록, 별칭·테마 검색)
- AI 파트 테이블 생성 후: 관련도 범위(0.00~1.00), 값 표기(`DIRECT`/`INDIRECT` 등) CHECK
- 이슈 종목 순위·언급량 추이 같은 집계 쿼리의 결과 검증
