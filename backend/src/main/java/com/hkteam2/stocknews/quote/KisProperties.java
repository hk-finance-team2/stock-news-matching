package com.hkteam2.stocknews.quote;

import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * KIS(한국투자증권) Open API 설정. 값은 저장소 최상위 .env 에서 읽음 (application.yml 의 spring.config.import)
 * - KIS_ENABLED=true 일 때만 이 클래스와 시세 기능이 만들어짐. 없으면 꺼짐 → 키 없는 팀원 서버는 지금과 같음
 * - KIS_MODE: real(실전) / paper(모의)
 * - 키는 본인 PC .env 에만. 로그·응답·toString 에 절대 내보내지 않음
 * 주소는 KIS 공식 예제(koreainvestment/open-trading-api, kis_devlp.yaml) 기준
 */
@Component
@ConditionalOnProperty(name = "KIS_ENABLED", havingValue = "true")
public class KisProperties {

    private static final String REAL_URL = "https://openapi.koreainvestment.com:9443";
    private static final String PAPER_URL = "https://openapivts.koreainvestment.com:29443";
    private static final String REAL_WS = "ws://ops.koreainvestment.com:21000";
    private static final String PAPER_WS = "ws://ops.koreainvestment.com:31000";

    private final String mode;
    private final String appKey;
    private final String appSecret;
    private final Path tokenDir;
    private final List<String> fixedCodes;

    /**
     * fixedCodes: 항상 실시간으로 받을 종목 (KIS_FIXED_CODES, 쉼표로). 기본 대형주 5개
     * 삼성전자, SK하이닉스, LG에너지솔루션, 현대자동차, NAVER
     */
    public KisProperties(@Value("${KIS_MODE:real}") String mode,
                         @Value("${KIS_APP_KEY:}") String appKey,
                         @Value("${KIS_APP_SECRET:}") String appSecret,
                         @Value("${KIS_TOKEN_DIR:data/kis}") String tokenDir,
                         @Value("${KIS_FIXED_CODES:005930,000660,373220,005380,035420}") String fixedCodes) {
        if (!"real".equals(mode) && !"paper".equals(mode)) {
            throw new IllegalStateException("KIS_MODE는 real 또는 paper 여야 합니다: " + mode);
        }
        if (appKey.isBlank() || appSecret.isBlank()) {
            throw new IllegalStateException("KIS_ENABLED=true 인데 .env 의 KIS_APP_KEY·KIS_APP_SECRET 이 비어 있습니다");
        }
        this.mode = mode;
        this.appKey = appKey.strip();
        this.appSecret = appSecret.strip();
        this.tokenDir = Path.of(tokenDir);   // data/ 폴더는 Git 제외 (.gitignore **/data/)
        this.fixedCodes = Arrays.stream(fixedCodes.split(",")).map(String::strip)
                .filter(s -> s.matches("[0-9A-Z]{6}")).distinct().toList();
    }

    public String webSocketUrl() {
        return "real".equals(mode) ? REAL_WS : PAPER_WS;
    }

    public List<String> fixedCodes() {
        return fixedCodes;
    }

    public String mode() {
        return mode;
    }

    public String baseUrl() {
        return "real".equals(mode) ? REAL_URL : PAPER_URL;
    }

    String appKey() {
        return appKey;
    }

    String appSecret() {
        return appSecret;
    }

    Path tokenDir() {
        return tokenDir;
    }

    /** 키가 실수로 로그에 찍히지 않게 가림 */
    @Override
    public String toString() {
        return "KisProperties[mode=" + mode + ", appKey=(가림), appSecret=(가림)]";
    }
}
