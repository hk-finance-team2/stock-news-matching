package com.hkteam2.stocknews.board;

import java.util.List;
import java.util.Optional;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** board_post 테이블. SQL은 resources/mapper/board/PostMapper.xml */
@Mapper
public interface PostMapper {

    long countByStock(@Param("stockCode") String stockCode);

    /** 최신순 한 페이지 */
    List<PostSummaryRow> findPageByStock(@Param("stockCode") String stockCode,
                                         @Param("limit") int limit,
                                         @Param("offset") int offset);

    Optional<PostDetailRow> findDetail(@Param("postId") Long postId);

    /** 작성자 회원 ID (글이 없으면 empty) */
    Optional<Long> findAuthorId(@Param("postId") Long postId);

    /** 저장 후 post.postId에 DB가 만든 번호가 채워짐 */
    void insert(Post post);

    /** 댓글·공감은 DB의 ON DELETE CASCADE로 함께 삭제 */
    void delete(@Param("postId") Long postId);
}
