package com.hkteam2.stocknews.board;

/**
 * 공감 토글 결과
 *
 * @param liked     지금 내가 공감한 상태인지
 * @param likeCount 이 글의 전체 공감 수
 */
public record LikeResponse(boolean liked, long likeCount) {
}
