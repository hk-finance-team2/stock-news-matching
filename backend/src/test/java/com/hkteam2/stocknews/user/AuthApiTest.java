package com.hkteam2.stocknews.user;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.hkteam2.stocknews.support.ApiTestSupport;

/** 회원가입·로그인·내 정보 (/api/auth/...) */
class AuthApiTest extends ApiTestSupport {

    @Test
    void 회원가입하면_201이고_비밀번호는_응답에_없다() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("zzauth01", PASSWORD)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.loginId").value("zzauth01"))
                .andExpect(jsonPath("$.userId").exists())
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void 같은_아이디로_또_가입하면_409() throws Exception {
        tokenOf("zzauth02");

        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("zzauth02", "otherpassword")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_LOGIN_ID"));
    }

    @Test
    void 아이디_비밀번호_규칙을_어기면_400() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("ABC", PASSWORD)))   // 대문자, 3자
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("zzauth03", "short")))   // 8자 미만
                .andExpect(status().isBadRequest());
    }

    @Test
    void 로그인하면_토큰이_오고_그_토큰으로_내_정보를_본다() throws Exception {
        String token = tokenOf("zzauth04");

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("zzauth04", PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").value(3600));
        mvc.perform(get("/api/auth/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.loginId").value("zzauth04"))
                .andExpect(jsonPath("$.role").value("USER"));
    }

    @Test
    void 비밀번호가_틀려도_없는_아이디여도_같은_401() throws Exception {
        tokenOf("zzauth05");

        // 어느 쪽이 틀렸는지 알려 주지 않음 (아이디가 있는지 숨김)
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("zzauth05", "wrongpassword")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("zznobody99", PASSWORD)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void 다섯_번_틀리면_맞는_비밀번호도_429() throws Exception {
        tokenOf("zzauth06");

        for (int i = 0; i < LoginAttemptLimiter.MAX_FAILURES; i++) {
            mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                            .content(loginJson("zzauth06", "wrongpassword")))
                    .andExpect(status().isUnauthorized());
        }
        // 막힌 동안은 비밀번호를 보지 않음
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("zzauth06", PASSWORD)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_LOGIN_ATTEMPTS"));
    }

    @Test
    void 토큰이_없거나_위조면_401() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(get("/api/auth/me").header("Authorization", bearer("forged.token.value")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 위조_토큰을_붙이면_로그인이_필요_없는_API도_401() throws Exception {
        // docs/api.md 약속: 401이면 프론트가 토큰을 지우고 로그인 화면으로
        mvc.perform(get("/api/articles").header("Authorization", bearer("forged.token.value")))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/articles"))
                .andExpect(status().isOk());
    }
}
