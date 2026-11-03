package com.hkteam2.stocknews.quote;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.Map;
import java.util.Properties;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * KIS 접근토큰("하루짜리 출입증") 받기·보관
 *
 * KIS 규칙 (공식 예제 kis_auth.py 주석, 저장소 README)
 * - POST /oauth2/tokenP 로 받음. 유효 1일. 발급할 때마다 카카오 알림톡이 감
 * - 재발급은 1분에 1회 (넘으면 EGW00133). 너무 자주 받으면 이용이 제한될 수 있음
 * 그래서 받은 토큰을 메모리와 파일(data/kis, Git 제외)에 두고, 만료 1시간 전까지 다시 씀
 * → 서버를 껐다 켜도 새로 받지 않음
 *
 * 토큰·키 값은 로그에 찍지 않음. 파일에는 어느 앱키로 받은 토큰인지 구분하려고 앱키의 해시 앞부분만 적음
 */
@Component
@ConditionalOnProperty(name = "KIS_ENABLED", havingValue = "true")
public class KisTokenManager {

    private static final Logger log = LoggerFactory.getLogger(KisTokenManager.class);
    private static final Duration REFRESH_BEFORE = Duration.ofHours(1);
    private static final DateTimeFormatter KST_TIME =
            DateTimeFormatter.ofPattern("MM/dd HH:mm").withZone(ZoneId.of("Asia/Seoul"));

    private final KisProperties props;
    private final RestClient restClient;
    private final Path tokenFile;
    private final String keyId;
    private Token cached;

    record Token(String value, Instant expiresAt) {
    }

    /** POST /oauth2/tokenP 응답 (필요한 칸만) */
    record TokenResponse(@JsonProperty("access_token") String accessToken,
                         @JsonProperty("expires_in") long expiresIn) {
    }

    /** 토큰 발급 실패 응답 */
    record TokenError(@JsonProperty("error_code") String errorCode,
                      @JsonProperty("error_description") String errorDescription) {
    }

    public KisTokenManager(KisProperties props, KisHttp http) {
        this.props = props;
        this.restClient = http.restClient();
        this.tokenFile = props.tokenDir().resolve("token-" + props.mode() + ".properties");
        this.keyId = sha256(props.appKey()).substring(0, 12);
    }

    /** 쓸 수 있는 토큰. 메모리 → 파일 → 새로 발급 순서로 찾음 */
    public synchronized String accessToken() {
        if (usable(cached)) {
            return cached.value();
        }
        Token fromFile = loadFile();
        if (usable(fromFile)) {
            cached = fromFile;
            log.info("KIS 접근토큰: 보관해 둔 토큰을 다시 씀 (만료 {} KST)", KST_TIME.format(fromFile.expiresAt()));
            return cached.value();
        }
        cached = issue();
        saveFile(cached);
        log.info("KIS 접근토큰: 새로 발급 (만료 {} KST, 알림톡이 감)", KST_TIME.format(cached.expiresAt()));
        return cached.value();
    }

    private boolean usable(Token t) {
        return t != null && Instant.now().isBefore(t.expiresAt().minus(REFRESH_BEFORE));
    }

    private Token issue() {
        try {
            TokenResponse res = restClient.post()
                    .uri(props.baseUrl() + "/oauth2/tokenP")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("grant_type", "client_credentials",
                            "appkey", props.appKey(),
                            "appsecret", props.appSecret()))
                    .retrieve()
                    .body(TokenResponse.class);
            if (res == null || res.accessToken() == null) {
                throw new KisApiException("NO_TOKEN", "토큰 응답이 비어 있음");
            }
            return new Token(res.accessToken(), Instant.now().plusSeconds(res.expiresIn()));
        } catch (RestClientResponseException e) {
            TokenError err = e.getResponseBodyAs(TokenError.class);
            throw err != null && err.errorCode() != null
                    ? new KisApiException(err.errorCode(), err.errorDescription())
                    : new KisApiException("HTTP_" + e.getStatusCode().value(), "토큰 발급 실패");
        }
    }

    private Token loadFile() {
        if (!Files.exists(tokenFile)) {
            return null;
        }
        Properties p = new Properties();
        try (Reader r = Files.newBufferedReader(tokenFile, StandardCharsets.UTF_8)) {
            p.load(r);
            if (!keyId.equals(p.getProperty("keyId"))) {
                return null;   // 다른 앱키로 받은 토큰 (키를 바꿨을 때)
            }
            return new Token(p.getProperty("token"), Instant.ofEpochSecond(Long.parseLong(p.getProperty("expiresAt"))));
        } catch (IOException | RuntimeException e) {
            log.warn("KIS 토큰 보관 파일을 읽지 못해 새로 받음: {}", e.getClass().getSimpleName());
            return null;
        }
    }

    private void saveFile(Token t) {
        Properties p = new Properties();
        p.setProperty("keyId", keyId);
        p.setProperty("token", t.value());
        p.setProperty("expiresAt", String.valueOf(t.expiresAt().getEpochSecond()));
        try {
            Files.createDirectories(tokenFile.getParent());
            try (Writer w = Files.newBufferedWriter(tokenFile, StandardCharsets.UTF_8)) {
                p.store(w, "KIS access token (Git 제외 폴더, 공유 금지)");
            }
        } catch (IOException e) {
            log.warn("KIS 토큰을 파일에 보관하지 못함 (메모리에만 둠): {}", e.getClass().getSimpleName());
        }
    }

    private static String sha256(String s) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
