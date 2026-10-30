package com.hkteam2.stocknews.board;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

@Service
public class LikeService {

    private final LikeMapper likeMapper;
    private final PostMapper postMapper;

    public LikeService(LikeMapper likeMapper, PostMapper postMapper) {
        this.likeMapper = likeMapper;
        this.postMapper = postMapper;
    }

    /**
     * 공감 토글. 먼저 지워 보고, 지운 게 있으면 취소 / 없으면 새로 추가.
     * "1인 1회"는 DB 기본키(post_id, user_id)가 보장
     */
    @Transactional
    public LikeResponse toggle(Long userId, Long postId) {
        if (!postMapper.existsById(postId)) {
            throw new BusinessException(ErrorCode.POST_NOT_FOUND);
        }

        boolean liked;
        if (likeMapper.delete(postId, userId) > 0) {
            liked = false;
        } else {
            try {
                likeMapper.insert(postId, userId);
            } catch (DuplicateKeyException e) {
                // 아주 빠르게 두 번 눌러 다른 요청이 먼저 추가한 경우 -> 이미 공감한 상태
            }
            liked = true;
        }
        return new LikeResponse(liked, likeMapper.countByPost(postId));
    }
}
