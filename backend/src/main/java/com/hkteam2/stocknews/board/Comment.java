package com.hkteam2.stocknews.board;

/** 새 댓글 저장용. 저장 후 DB가 만든 commentId를 받음 */
public class Comment {

    private Long commentId;
    private final Long postId;
    private final Long userId;
    private final String content;

    public Comment(Long postId, Long userId, String content) {
        this.postId = postId;
        this.userId = userId;
        this.content = content;
    }

    public Long getCommentId() {
        return commentId;
    }

    public Long getPostId() {
        return postId;
    }

    public Long getUserId() {
        return userId;
    }

    public String getContent() {
        return content;
    }
}
