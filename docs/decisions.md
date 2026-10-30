# 결정 기록

무엇을 왜 그렇게 정했는지 남기는 문서입니다. 새 기술·라이브러리·설정을 추가하면 아래에 이어서 적습니다.
형식: 날짜 · 결정 · 이유 · 검토한 대안

## 2026-10-30 · Spring Boot 4.1.2, Java 21, Gradle

- **결정:** Spring Boot 4.1.2, Java 21 (Eclipse Temurin), Gradle(Groovy) 9.8.2 Wrapper. 패키지 `com.hkteam2.stocknews`
- **이유:**
  - 3.5는 2026-06-30, 4.0은 2026-12에 무료 지원이 끝나 프로젝트 기간을 버티지 못함. 4.1은 지원이 남은 최신 정식 계열이고, 4.1.2는 그 최신 패치
  - Java 21은 LTS이고 라이브러리 호환이 가장 넓음
  - Gradle Wrapper로 팀원 모두 같은 Gradle 버전을 자동으로 받아 씀
- **검토한 대안:** 4.2.0-RC1·SNAPSHOT (정식 출시 전이라 바뀔 수 있음), Java 25 (수업·도구가 21 기준), Maven

## 2026-10-30 · MariaDB 11.8.9를 Docker Compose로 실행, 포트 3308

- **결정:** 저장소 최상위 `docker-compose.yml`의 `db` 서비스로 `mariadb:11.8.9` 실행. utf8mb4 / utf8mb4_unicode_ci, 시간대 +09:00. 내 PC 포트는 **3308** (컨테이너 안은 3306)
- **이유:**
  - 팀원 4명의 DB 버전·문자셋·시간대를 파일 하나로 맞추고, 다른 파트도 `docker compose up -d db` 한 줄로 실행
  - 패치 버전까지 고정해 모두 정확히 같은 버전을 씀
  - 수업용 MariaDB가 3306을, 다른 팀원 프로젝트가 3307을 쓰고 있어 겹치지 않는 3308 선택
- **검토한 대안:** PC에 직접 설치 (팀원마다 설정이 달라지고 수업용 DB와 섞임), 3306 그대로 쓰고 수업용 DB 끄기 (수업 때마다 다시 켜야 함)

## 2026-10-30 · DB 접속 정보는 `.env`에서 읽기

- **결정:** `application.yml`에 `spring.config.import: optional:file:../.env[.properties]`. 비밀번호는 코드에 쓰지 않음. 환경변수가 있으면 환경변수가 우선
- **이유:** Docker Compose와 Spring이 같은 `.env` 하나를 함께 씀. `.env`는 Git에서 제외되어 비밀번호가 올라가지 않음
- **검토한 대안:** `application-local.yml`에 직접 적기 (설정 파일이 둘로 나뉘어 값이 어긋나기 쉬움)

## 2026-10-30 · Flyway로 스키마 관리

- **결정:** `spring-boot-starter-flyway` + `flyway-mysql` (버전은 Boot가 관리, 12.4.0). SQL은 `backend/src/main/resources/db/migration/V번호__설명.sql`
- **이유:** 서버를 켜면 아직 실행 안 한 번호만 자동 실행되어 팀원 모두의 DB 구조가 같아짐. 변경 이력이 Git에 남음
- **규칙:** main에 합쳐진 V 파일은 고치지 않고 새 번호를 추가. (main에 합치기 전 내 PC에서만 쓰는 동안은 DB를 비우고 다시 만들 수 있음)
- **참고:** 실행 시 "MariaDB 11.8은 Flyway가 검증한 11.7보다 새 버전" 경고가 나오지만 동작에는 문제없음. Flyway가 11.8 검증을 추가하면 사라짐
- **검토한 대안:** `schema.sql` (변경할 때 데이터를 지우고 다시 만들어야 함)

## 2026-10-30 · MyBatis starter 4.1.0, SQL은 XML에

- **결정:** `mybatis-spring-boot-starter:4.1.0`. SQL은 `resources/mapper/**/*.xml`, `map-underscore-to-camel-case` 사용
- **이유:**
  - 이슈 종목 순위, 언급량 추이처럼 집계 쿼리가 많아 SQL을 직접 통제하려고 MyBatis 선택
  - 4.1.0은 Spring Boot 4.1 기준으로 만든 버전 (4.0.x는 Boot 4.0용). Spring 생성기 목록에는 아직 Boot 4.1용이 없어 직접 추가
  - Boot가 버전을 관리하지 않는 부품이라 `build.gradle`에 버전을 직접 적음
- **검토한 대안:** JPA (객체 저장이 장점인데, 백엔드는 AI가 쓴 테이블을 주로 읽기만 함)

## 2026-10-30 · 코드 구조와 목록 응답 형식

- **결정:** 기능 패키지마다 Controller → Service → Mapper(+ XML) 순서. 응답 모양은 Java record. 목록 응답은 `common.ListResponse` → `{ "items": [...], "totalCount": 5 }`
- **이유:** 모든 API가 같은 흐름이라 한 번 만든 틀을 복사해 쓸 수 있음. 목록 응답 형식은 프론트와 맞춘 공통 약속
- **검토한 대안:** Lombok으로 생성자 줄이기 (지금은 코드가 짧아 쓰지 않음, 필요하면 다시 검토)

## 2026-10-30 · springdoc 3.2.0으로 Swagger

- **결정:** `springdoc-openapi-starter-webmvc-ui:3.2.0`. 화면 `/swagger-ui.html`, 명세 JSON `/v3/api-docs`
- **이유:** 프론트가 백엔드 코드를 보지 않고 API를 확인하고 바로 호출해 볼 수 있음. 코드에서 자동으로 만들어져 문서가 항상 최신. 3.2.0은 Spring Boot 4.1.2 기준 버전
- **검토한 대안:** 손으로 쓴 API 문서만 두기 (코드를 고치면 문서가 틀려지기 쉬움)

## 2026-10-30 · CORS는 WebMvcConfigurer로, 허용 주소는 설정 파일에

- **결정:** `common.config.WebConfig`에서 `/api/**`에 CORS 허용. 허용 주소는 `application.yml`의 `app.cors.allowed-origins` (지금은 `http://localhost:5173`)
- **이유:** 브라우저는 주소가 다른 서버로의 요청을 기본으로 막아서, 프론트(5173)가 백엔드(8080)를 부르려면 허용이 필요. 주소를 설정 파일에 두면 배포 주소가 생겨도 코드를 고치지 않음
- **참고:** 로그인(Spring Security)을 붙이면 CORS를 Security 설정에서도 함께 허용해야 함
- **검토한 대안:** Controller마다 `@CrossOrigin` (빠뜨리기 쉬움), 모든 주소 허용 `*` (아무 사이트나 우리 API를 부를 수 있음)

## 2026-10-30 · 공통 오류 응답 `{ code, message }`

- **결정:** `common.error`에 `ErrorCode`(오류 목록 enum), `BusinessException`, `GlobalExceptionHandler`(`@RestControllerAdvice`). 서비스는 `throw new BusinessException(ErrorCode.STOCK_NOT_FOUND)`처럼 던지기만 함
- **이유:** 프론트와 맞춘 실패 응답 형식. 오류 종류와 HTTP 상태·메시지를 한곳에서 관리. 예상하지 못한 오류는 원인을 로그에만 남기고 사용자에게는 일반 메시지만 보여 내부 정보가 새지 않음
- **검토한 대안:** Spring 기본 오류 응답 (모양이 다르고 내부 정보가 섞일 수 있음), Controller마다 try-catch (중복 코드)

## 2026-10-30 · 회원가입: Spring Security + BCrypt, 입력값 검사

- **결정:** `spring-boot-starter-security`(Security 7.1.2, Boot가 관리), 비밀번호는 `BCryptPasswordEncoder`로 암호화해 저장. `spring-boot-starter-validation`으로 입력값 검사 (아이디: 영문 소문자·숫자 4~20자, 비밀번호: 8~64자)
- **이유:**
  - BCrypt는 되돌릴 수 없는 방식이고, 같은 비밀번호도 매번 다른 결과(솔트)가 나와 DB가 유출돼도 원래 비밀번호를 알기 어려움
  - 입력 규칙은 요청 클래스에 적어 두면 Controller에 들어오기 전에 400으로 거절됨. 어긴 규칙의 메시지를 그대로 응답해 프론트가 화면에 보여 줄 수 있음
  - 아이디 중복은 서비스에서 먼저 확인하고, 동시에 가입하는 경우는 DB UNIQUE 오류를 잡아 같은 409로 응답 (DB가 최종 방어선)
- **Security 설정:** JWT를 쓰는 API 서버라 CSRF·기본 로그인 화면·HTTP Basic은 끄고 세션은 만들지 않음(STATELESS). 지금은 모든 API를 열어 두고, JWT 검사를 붙일 때 로그인이 필요한 API만 잠금. CORS는 `.cors()`로 WebConfig 명단을 그대로 사용
- **검토한 대안:** 비밀번호 SHA-256 직접 해시 (빠른 해시라 무차별 대입에 약함), 입력값을 Service에서 if문으로 검사 (규칙이 흩어짐)

## 2026-10-30 · 로그인 토큰: Spring Security 공식 JWT 지원 (HS256)

- **결정:** `spring-boot-starter-security-oauth2-resource-server`의 `JwtEncoder`(발급)·`JwtDecoder`(검사). 서명은 HS256, 키는 `.env`의 `JWT_SECRET`(32자 이상). 유효 시간 60분(`app.jwt.expiration-minutes`)
- **토큰 내용:** `sub`(회원 ID), `loginId`, `role`, `iss`, `iat`, `exp`. 비밀번호 등 비밀 정보는 넣지 않음 (JWT 내용은 누구나 읽을 수 있고, 서명은 위조만 막음)
- **이유:**
  - Spring Security가 공식으로 제공하는 JWT 지원이라 Spring Boot가 버전을 맞춰 줌 (Boot 4로 바뀐 직후라 호환성이 중요)
  - 토큰 검사는 Security가 표준 방식으로 처리 → 보안 코드를 직접 짜며 생길 실수를 줄임
  - 서버 하나라 공개키/개인키(RS256)까지는 필요 없고, 비밀 키 하나(HS256)로 충분
  - 로그인 실패 시 아이디가 없는지 비밀번호가 틀렸는지 구분하지 않고 같은 401 응답 (어떤 아이디가 가입돼 있는지 숨김)
  - 서명 키가 32자보다 짧으면 서버가 시작하지 않게 막음
- **검토한 대안:** jjwt + 직접 만든 검사 필터 (예제가 많지만 버전 호환을 직접 확인해야 하고 보안 코드를 직접 관리), 세션 로그인 (React와 분리된 API 구조에 맞지 않음)
- **아직 안 정한 것:** 프론트의 토큰 저장 위치, 로그아웃·만료 처리 (프론트와 정함)

## 2026-10-30 · 토큰 검사와 로그인이 필요한 API 잠그기

- **결정:** `SecurityConfig`에서 `.oauth2ResourceServer().jwt()`로 `Authorization: Bearer {토큰}`을 검사. 기본은 모두 허용하고, 로그인이 필요한 주소만 `AUTHENTICATED_PATHS` 목록에 추가해 잠금 (지금은 `/api/auth/me`)
- **이유:** 요구사항상 조회는 로그인 없이, 관심 종목·게시판 쓰기만 로그인 필요. 잠글 주소가 적어서 "잠글 것만 나열"이 읽기 쉬움
- **오류 응답:** 토큰 없음·만료·위조는 401 `UNAUTHORIZED`, 권한 부족은 403 `FORBIDDEN`. Security 필터에서 난 오류도 `GlobalExceptionHandler`로 넘겨 `{ code, message }` 형식을 유지
- **주의 (프론트와 공유):** 잘못되거나 만료된 토큰을 붙이면 **공개 API도 401**이 됨 (Spring Security가 토큰이 있으면 먼저 검사하기 때문). 프론트는 401을 받으면 저장한 토큰을 지우고 로그인 화면으로 보내거나, 토큰 없이 다시 요청
- **Swagger:** Authorize 버튼에 토큰을 넣으면 잠긴 API도 시험 가능
- **2차로 미룸:** 관리자(ADMIN) 권한 검사 (토큰의 `role`을 권한으로 연결)

## 2026-10-30 · 회원 ID는 토큰에서만, 시각은 +09:00 포함

- **결정:**
  - 로그인이 필요한 API는 회원 ID를 요청 값으로 받지 않고 `CurrentUser.id(jwt)`로 토큰에서 꺼냄
  - DB의 `DATETIME`(한국 시간)은 응답할 때 `TimeUtils.toKst()`로 `OffsetDateTime`으로 바꿔 `2026-10-30T14:39:39+09:00` 형식으로 내보냄
- **이유:**
  - 회원 ID를 요청으로 받으면 남의 ID를 넣어 남의 데이터를 다룰 수 있음. 토큰은 서명 때문에 고칠 수 없음
  - API 약속(AGENTS.md)이 "시간대 포함 ISO-8601". `LocalDateTime`을 그대로 내보내면 `+09:00`이 빠짐
- **검토한 대안:** JVM·Jackson 전역 시간대 설정 (응답마다 시간대가 붙는지 눈에 잘 안 보임), 요청 값으로 회원 ID 받기 (보안 문제)

## 2026-10-30 · 관심 종목 API 범위

- **결정:** `GET·POST /api/watchlist`, `DELETE /api/watchlist/{stockCode}`. 응답은 종목코드·종목명·시장·등록 시각
- **미룬 것:** 요구사항(F-19)의 "오늘 매칭 글 수·최근 매칭 시각", "관심 종목 글 모아 보기"는 AI 기사 테이블이 생긴 뒤 추가. 그때까지 해당 칸은 **응답에 넣지 않음** (0이나 빈 값을 넣으면 프론트가 진짜 값으로 오해할 수 있음)
- **오류:** 없는 종목 404 `STOCK_NOT_FOUND`, 이미 있음 409 `ALREADY_IN_WATCHLIST`, 목록에 없는 종목 삭제 404 `WATCHLIST_NOT_FOUND`

## 2026-10-30 · 목록 페이지 규칙 (모든 목록 API 공통)

- **결정:** 요청 `page`(1부터), `size`(1~100, 기본 20). 응답은 `{ items, totalCount }`. `common.PageQuery`가 SQL `LIMIT`/`OFFSET`을 계산하고, 범위를 벗어나면 400 `INVALID_PAGE`
- **이유:** 화면의 페이지 번호와 같게 1부터. 한 번에 너무 많이 요청하지 못하게 최대 100. 목록 API마다 규칙이 다르면 프론트가 헷갈리므로 공용 도구로 통일 (글 목록 B-03 등도 같은 도구 사용)
- **검토한 대안:** 0부터 시작(Spring Data 기본값, 화면 번호와 달라 혼동), 커서 방식(무한 스크롤에 유리하지만 지금 규모에 과함)

## 2026-10-30 · 종목 토론 게시판 범위와 규칙

- **범위 (F-20 그대로, 텍스트만):** 게시글 목록·상세·작성·삭제, 댓글 목록·작성·삭제, 공감 토글. 글·댓글 수정, 대댓글, 첨부, 조회수, 게시판 검색은 만들지 않음
- **권한:** 보기는 로그인 없이, 쓰기는 로그인, 삭제는 본인만. 남의 글·댓글 삭제는 403(`NOT_POST_OWNER`, `NOT_COMMENT_OWNER`), 없는 글·댓글은 404
- **잠금 방식:** 같은 주소라도 GET은 공개, POST·DELETE만 잠그도록 `SecurityConfig`에서 "방식 + 주소"로 지정
- **댓글 수·공감 수:** 따로 저장하지 않고 조회할 때 `COUNT(*)`로 계산 (숫자를 따로 고치다 어긋나는 문제를 피함). 느려지면 그때 저장 방식 검토
- **정렬:** 게시글은 최신순(페이지), 댓글은 오래된 순(전부, 페이지 없음)
- **공감 토글:** "먼저 지워 보고, 지운 게 있으면 취소 / 없으면 추가". 1인 1회는 DB 기본키 `(post_id, user_id)`가 보장
- **삭제:** 글을 지우면 댓글·공감은 DB `ON DELETE CASCADE`로 함께 삭제

## 2026-10-30 · 백엔드 Docker화 (멀티 스테이지 빌드)

- **결정:** `backend/Dockerfile`로 백엔드를 이미지로 만들고 `docker-compose.yml`에 `backend` 서비스 추가. `docker compose up -d --build` 한 줄로 DB와 백엔드가 함께 실행
  - 1단계(`eclipse-temurin:21-jdk`): Gradle로 `bootJar` 빌드. 라이브러리 목록을 먼저 복사해 받아 두어 코드만 바뀌면 다시 받지 않음. 테스트는 DB가 필요해 이미지 빌드에서는 건너뜀
  - 2단계(`eclipse-temurin:21-jre`): `.jar`만 복사해 실행. 소스·빌드 도구는 이미지에 남기지 않음
  - root가 아닌 전용 계정(`app`)으로 실행, JVM 시간대 `Asia/Seoul`
  - 상자 안에서는 DB를 `db:3306`으로 찾도록 `DB_HOST`·`DB_PORT`만 덮어씀. 나머지 값은 `.env`에서 읽음 (코드 수정 없음)
  - DB `healthcheck`가 통과한 뒤에 백엔드 시작 (`depends_on: condition: service_healthy`)
- **이유:**
  - 프론트·AI 팀원이 Java·Gradle 설치나 버전 차이 없이 백엔드를 켤 수 있음
  - 발표 때 `docker compose up` 한 번으로 전체 실행하는 목표(B-13)의 첫 조각
  - 실행 이미지에 빌드 도구·소스를 넣지 않아 더 작고 안전함
- **사용 구분:** 백엔드를 고치지 않는 사람은 Docker, 백엔드 개발자는 DB만 Docker로 켜고 `gradlew bootRun` (코드 변경이 바로 반영되도록). 둘 다 8080을 쓰므로 동시에 켜지 않음
- **검토한 대안:** 한 단계 Dockerfile(JDK와 소스가 이미지에 남아 큼), 팀원마다 Java 21 설치(버전·환경 차이)

## 2026-10-30 · AI 파트 테이블 (V5): AI 제안서 기반 + 확장 칸

AI 파트(지승현)와 이야기해서 정함.

- **결정:**
  - AI 파트 제안서(`ai/docs/AI테이블_제안.md`)의 `article`, `article_stock`, `collect_run`을 **칸 이름·타입 그대로** 사용
  - 요구사항에 있지만 아직 정해지지 않은 칸을 **[확장]**으로 덧붙임. 모두 NULL 허용 또는 기본값이 있어서 AI 코드가 몰라도 저장됨
    - `article`: `source_type`(NEWS/SNS), `channel`, `collect_mode`(REALTIME/BACKFILL), `keywords`, `sentiment`
    - `article_stock`: `match_type`(DIRECT/INDIRECT), `relevance`(0~1), `evidence`(근거 문장), `matched_keywords`
    - `collect_run`: `channel`
  - `stock_daily_summary`(종목별 하루 요약)는 표만 미리 만들고 AI가 나중에 채움
  - 값 표기는 AI 코드에 맞춤: 감성 `POSITIVE/NEGATIVE/NEUTRAL`, 처리 상태 `LISTED … DONE`
  - AI도 **팀 Docker DB**(`stocknews`, 3308, 앱 전용 계정)를 사용
- **이유:**
  - AI 파트가 이미 이 구조로 수집 코드를 짜고 있어서, 바꾸지 않고 그대로 저장을 시작할 수 있게
  - 직접/간접·관련도·근거 문장은 서비스의 차별점(F-05·F-06)이라 자리를 미리 마련. "요구사항에 있는 것은 미리 넣고, 안 쓰면 나중에 지운다", 추측성 칸은 넣지 않음
  - 같은 DB를 써야 백엔드가 AI 결과를 읽어 화면에 보여 줄 수 있음
- **기사 본문(`body`):** 요구사항 문서에는 "본문 저장 안 함"이었으나, AI 파트와 이야기해 **DB에는 LLM 요약용으로 저장**하기로 함. 7일 후 NULL로 지우고, 백엔드·화면에서는 조회하지 않으며, GitHub에는 올리지 않음(AGENTS.md 3번)
- **종목 사전:** `article_stock.stock_code`에 `stock_info` FK를 걸어서 종목 사전에 없는 종목은 저장되지 않음 → 종목 사전 채우기(B-01)를 백엔드가 이어서 진행. AI 파트가 가진 종목 데이터는 임시 테스트용
- **검토한 대안:** 백엔드 초안 5개 테이블(글·분석·매칭·요약·수집 기록을 따로)로 새로 설계 (AI 코드를 크게 바꿔야 해서 제외)
