package com.hkteam2.stocknews.common.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.servlet.HandlerExceptionResolver;

import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

/**
 * Spring Security 설정.
 * 조회 API는 로그인 없이 열어 두고, 로그인이 필요한 API만 아래 목록에 추가해 잠급니다.
 */
@Configuration
public class SecurityConfig {

    /** 로그인(JWT)이 있어야 하는 주소. 관심 종목·게시판 쓰기 등을 만들 때 여기에 추가 */
    private static final String[] AUTHENTICATED_PATHS = {
            "/api/auth/me",
    };

    private final HandlerExceptionResolver exceptionResolver;

    public SecurityConfig(@Qualifier("handlerExceptionResolver") HandlerExceptionResolver exceptionResolver) {
        this.exceptionResolver = exceptionResolver;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // 세션·쿠키 대신 토큰(JWT)을 쓰는 API 서버라 CSRF 방어와 기본 로그인 화면은 끔
                .csrf(csrf -> csrf.disable())
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // WebConfig의 CORS 허용 명단을 Security에서도 사용
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(AUTHENTICATED_PATHS).authenticated()
                        .anyRequest().permitAll())
                // "Authorization: Bearer {토큰}" 헤더를 읽어 JwtConfig의 검사기로 확인
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(Customizer.withDefaults())
                        .authenticationEntryPoint((request, response, e) -> exceptionResolver.resolveException(
                                request, response, null, new BusinessException(ErrorCode.UNAUTHORIZED)))
                        .accessDeniedHandler((request, response, e) -> exceptionResolver.resolveException(
                                request, response, null, new BusinessException(ErrorCode.FORBIDDEN))));
        return http.build();
    }

    /** 비밀번호 암호화 (BCrypt: 되돌릴 수 없는 방식) */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
