package com.hkteam2.stocknews.board;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** board_like 테이블. SQL은 resources/mapper/board/LikeMapper.xml */
@Mapper
public interface LikeMapper {

    void insert(@Param("postId") Long postId, @Param("userId") Long userId);

    /** 지운 줄 수 (공감하지 않은 상태였으면 0) */
    int delete(@Param("postId") Long postId, @Param("userId") Long userId);

    long countByPost(@Param("postId") Long postId);
}
