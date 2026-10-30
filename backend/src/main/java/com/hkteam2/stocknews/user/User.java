package com.hkteam2.stocknews.user;

import java.time.LocalDateTime;

/** users 테이블 한 줄. 저장 후 DB가 만든 userId를 받아야 해서 record가 아닌 클래스 */
public class User {

    private Long userId;
    private String loginId;
    private String passwordHash;
    private String role;
    private LocalDateTime createdAt;

    /** MyBatis가 조회 결과를 담을 때 사용 */
    protected User() {
    }

    /** 새 회원. 비밀번호는 이미 암호화된 값을 받음 */
    public static User newUser(String loginId, String passwordHash) {
        User user = new User();
        user.loginId = loginId;
        user.passwordHash = passwordHash;
        user.role = "USER";
        return user;
    }

    public Long getUserId() {
        return userId;
    }

    public String getLoginId() {
        return loginId;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getRole() {
        return role;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
