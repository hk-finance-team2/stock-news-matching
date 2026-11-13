package com.hkteam2.stocknews.user;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

@Service
public class UserService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final LoginAttemptLimiter loginLimiter;

    public UserService(UserMapper userMapper, PasswordEncoder passwordEncoder, JwtTokenProvider jwtTokenProvider,
                       LoginAttemptLimiter loginLimiter) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.loginLimiter = loginLimiter;
    }

    @Transactional
    public SignupResponse signup(SignupRequest request) {
        if (userMapper.existsByLoginId(request.loginId())) {
            throw new BusinessException(ErrorCode.DUPLICATE_LOGIN_ID);
        }

        User user = User.newUser(request.loginId(), passwordEncoder.encode(request.password()));
        try {
            userMapper.insert(user);
        } catch (DuplicateKeyException e) {
            // 두 사람이 같은 아이디로 동시에 가입하면 위 확인을 둘 다 통과할 수 있음 -> DB UNIQUE가 최종으로 막음
            throw new BusinessException(ErrorCode.DUPLICATE_LOGIN_ID);
        }
        return new SignupResponse(user.getUserId(), user.getLoginId());
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request, String clientIp) {
        // 막혀 있으면 비밀번호를 보지도 않음 (맞는 비밀번호여도 막힘이 풀릴 때까지 기다려야 함)
        if (loginLimiter.isLocked(request.loginId(), clientIp)) {
            throw new BusinessException(ErrorCode.TOO_MANY_LOGIN_ATTEMPTS);
        }
        User user = userMapper.findByLoginId(request.loginId())
                .filter(found -> passwordEncoder.matches(request.password(), found.getPasswordHash()))
                .orElse(null);
        if (user == null) {
            loginLimiter.onFailure(request.loginId(), clientIp); // 없는 아이디도 똑같이 셈 (아이디가 있는지 숨김)
            throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
        }
        loginLimiter.onSuccess(request.loginId(), clientIp);

        String token = jwtTokenProvider.createToken(user);
        return LoginResponse.bearer(token, jwtTokenProvider.getExpirationSeconds());
    }
}
