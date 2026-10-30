package com.hkteam2.stocknews.board;

import java.util.List;
import java.util.Optional;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** board_comment 테이블. SQL은 resources/mapper/board/CommentMapper.xml */
@Mapper
public interface CommentMapper {

    /** 오래된 순 (대화처럼 위에서 아래로) */
    List<CommentRow> findAllByPost(@Param("postId") Long postId);

    Optional<CommentRow> findById(@Param("commentId") Long commentId);

    /** 작성자 회원 ID (댓글이 없으면 empty) */
    Optional<Long> findAuthorId(@Param("commentId") Long commentId);

    /** 저장 후 comment.commentId에 DB가 만든 번호가 채워짐 */
    void insert(Comment comment);

    void delete(@Param("commentId") Long commentId);
}
