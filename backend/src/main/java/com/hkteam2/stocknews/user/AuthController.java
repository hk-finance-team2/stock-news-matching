package com.hkteam2.stocknews.user;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hkteam2.stocknews.common.config.OpenApiConfig;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "회원", description = "회원가입·로그인")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @Operation(summary = "회원가입", description = "아이디가 이미 있으면 409 DUPLICATE_LOGIN_ID, 규칙에 어긋나면 400 INVALID_REQUEST")
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public SignupResponse signup(@Valid @RequestBody SignupRequest request) {
        return userService.signup(request);
    }

    @Operation(summary = "로그인", description = "성공하면 JWT를 발급합니다. 아이디나 비밀번호가 틀리면 401 INVALID_CREDENTIALS")
    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return userService.login(request);
    }

    /** Security가 토큰 검사를 통과시킨 경우에만 들어옴. jwt = 검사가 끝난 토큰 내용 */
    @Operation(summary = "내 정보", description = "토큰이 없거나 만료·위조되면 401 UNAUTHORIZED",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH))
    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal Jwt jwt) {
        return new MeResponse(Long.valueOf(jwt.getSubject()), jwt.getClaimAsString("loginId"),
                jwt.getClaimAsString("role"));
    }
}
