package com.hkteam2.stocknews;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

// 테스트는 KIS 시세를 부르지 않음 (내 .env 에 KIS_ENABLED=true 가 있어도 끔)
@SpringBootTest(properties = "KIS_ENABLED=false")
class StocknewsApplicationTests {

    @Test
    void contextLoads() {
    }

}
