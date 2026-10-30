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
