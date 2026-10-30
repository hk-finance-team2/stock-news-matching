package com.hkteam2.stocknews.board;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hkteam2.stocknews.common.ListResponse;
import com.hkteam2.stocknews.common.PageQuery;
import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;
import com.hkteam2.stocknews.stock.StockMapper;

@Service
public class PostService {

    private final PostMapper postMapper;
    private final StockMapper stockMapper;

    public PostService(PostMapper postMapper, StockMapper stockMapper) {
        this.postMapper = postMapper;
        this.stockMapper = stockMapper;
    }

    @Transactional(readOnly = true)
    public ListResponse<PostSummaryResponse> getPosts(String stockCode, PageQuery pageQuery) {
        requireStock(stockCode);
        long totalCount = postMapper.countByStock(stockCode);
        List<PostSummaryResponse> items = postMapper
                .findPageByStock(stockCode, pageQuery.limit(), pageQuery.offset()).stream()
                .map(PostSummaryResponse::from)
                .toList();
        return new ListResponse<>(items, totalCount);
    }

    @Transactional(readOnly = true)
    public PostDetailResponse getPost(Long postId) {
        return postMapper.findDetail(postId)
                .map(PostDetailResponse::from)
                .orElseThrow(() -> new BusinessException(ErrorCode.POST_NOT_FOUND));
    }

    @Transactional
    public PostDetailResponse create(Long userId, String stockCode, PostCreateRequest request) {
        requireStock(stockCode);
        Post post = new Post(stockCode, userId, request.title(), request.content());
        postMapper.insert(post);
        return getPost(post.getPostId());
    }

    /** 본인 글만 삭제. 댓글·공감은 DB가 함께 삭제 */
    @Transactional
    public void delete(Long userId, Long postId) {
        Long authorId = postMapper.findAuthorId(postId)
                .orElseThrow(() -> new BusinessException(ErrorCode.POST_NOT_FOUND));
        if (!authorId.equals(userId)) {
            throw new BusinessException(ErrorCode.NOT_POST_OWNER);
        }
        postMapper.delete(postId);
    }

    private void requireStock(String stockCode) {
        if (!stockMapper.existsByCode(stockCode)) {
            throw new BusinessException(ErrorCode.STOCK_NOT_FOUND);
        }
    }
}
