package com.hkteam2.stocknews.quote;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * 연결 확인: 서버가 켜질 때 삼성전자 현재가를 한 번 받아 로그에 남김
 * 키가 맞는지, 실전 승인이 끝났는지, 우리 서버에서 KIS까지 통신이 되는지를 한 번에 확인
 * 실패해도 서버는 그대로 켜짐 (경고 로그만). 키·토큰 값은 찍지 않음
 */
@Component
@ConditionalOnProperty(name = "KIS_ENABLED", havingValue = "true")
public class KisConnectionCheck implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(KisConnectionCheck.class);
    private static final String SAMSUNG = "005930";

    private final KisProperties props;
    private final KisRestClient client;

    public KisConnectionCheck(KisProperties props, KisRestClient client) {
        this.props = props;
        this.client = client;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            KisPrice p = client.inquirePrice(SAMSUNG);
            log.info("KIS 연결 확인 성공 ({}): 삼성전자 현재가 {}원, 전일 대비 {}원 ({}%, 부호 {}), 거래량 {}",
                    props.mode(), p.price(), p.changeAmount(), p.changeRate(), p.changeSign(), p.accVolume());
        } catch (KisApiException e) {
            log.warn("KIS 연결 확인 실패: KIS 오류 {}", e.getMessage());
        } catch (RuntimeException e) {
            log.warn("KIS 연결 확인 실패: {} - {}", e.getClass().getSimpleName(), e.getMessage());
        }
    }
}
