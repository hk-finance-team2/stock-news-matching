package com.hkteam2.stocknews.user;

import java.util.Optional;

import org.apache.ibatis.annotations.Mapper;

/** users 테이블. SQL은 resources/mapper/user/UserMapper.xml */
@Mapper
public interface UserMapper {

    boolean existsByLoginId(String loginId);

    /** 저장 후 user.userId에 DB가 만든 번호가 채워짐 */
    void insert(User user);

    /** 없으면 Optional.empty() */
    Optional<User> findByLoginId(String loginId);
}
