package com.hkteam2.stocknews.board;

/** 새 게시글 저장용. 저장 후 DB가 만든 postId를 받아야 해서 record가 아닌 클래스 */
public class Post {

    private Long postId;
    private final String stockCode;
    private final Long userId;
    private final String title;
    private final String content;

    public Post(String stockCode, Long userId, String title, String content) {
        this.stockCode = stockCode;
        this.userId = userId;
        this.title = title;
        this.content = content;
    }

    public Long getPostId() {
        return postId;
    }

    public String getStockCode() {
        return stockCode;
    }

    public Long getUserId() {
        return userId;
    }

    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }
}
