package com.hkteam2.stocknews.board;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hkteam2.stocknews.common.ListResponse;
import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

@Service
public class CommentService {

    private final CommentMapper commentMapper;
    private final PostMapper postMapper;

    public CommentService(CommentMapper commentMapper, PostMapper postMapper) {
        this.commentMapper = commentMapper;
        this.postMapper = postMapper;
    }

    @Transactional(readOnly = true)
    public ListResponse<CommentResponse> getComments(Long postId) {
        requirePost(postId);
        return ListResponse.of(commentMapper.findAllByPost(postId).stream()
                .map(CommentResponse::from)
                .toList());
    }

    @Transactional
    public CommentResponse create(Long userId, Long postId, CommentCreateRequest request) {
        requirePost(postId);
        Comment comment = new Comment(postId, userId, request.content());
        commentMapper.insert(comment);
        return commentMapper.findById(comment.getCommentId())
                .map(CommentResponse::from)
                .orElseThrow();
    }

    /** 본인 댓글만 삭제 */
    @Transactional
    public void delete(Long userId, Long commentId) {
        Long authorId = commentMapper.findAuthorId(commentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.COMMENT_NOT_FOUND));
        if (!authorId.equals(userId)) {
            throw new BusinessException(ErrorCode.NOT_COMMENT_OWNER);
        }
        commentMapper.delete(commentId);
    }

    private void requirePost(Long postId) {
        if (!postMapper.existsById(postId)) {
            throw new BusinessException(ErrorCode.POST_NOT_FOUND);
        }
    }
}
