# 백엔드 서버를 Docker 상자(이미지)로 포장하는 설명서
# 사용: 저장소 최상위에서 docker compose up -d --build

# ---------- 1단계: 빌드 (요리) ----------
# Java 21 개발 도구(JDK)가 든 상자에서 실행 파일(.jar)을 만듦
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# 라이브러리 목록부터 복사해 받아 둠 -> 코드만 바뀌면 이 단계는 재사용되어 빨라짐
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN --mount=type=cache,target=/root/.gradle ./gradlew dependencies --no-daemon > /dev/null

# 소스 코드 복사 후 실행 파일 만들기 (테스트는 DB가 필요해 여기서는 건너뜀)
COPY src ./src
RUN --mount=type=cache,target=/root/.gradle ./gradlew bootJar -x test --no-daemon

# ---------- 2단계: 실행 (포장) ----------
# 실행에 필요한 Java 실행기(JRE)와 .jar만 담은 작은 상자
FROM eclipse-temurin:21-jre
WORKDIR /app

# 관리자(root)가 아닌 전용 계정으로 실행 (보안)
RUN groupadd --system app && useradd --system --gid app app
COPY --from=build /app/build/libs/*.jar app.jar
USER app

EXPOSE 8080
# 시간대는 한국 시간
ENTRYPOINT ["java", "-Duser.timezone=Asia/Seoul", "-jar", "app.jar"]
