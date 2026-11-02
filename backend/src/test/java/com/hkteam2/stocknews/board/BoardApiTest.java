package com.hkteam2.stocknews.board;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import com.hkteam2.stocknews.support.ApiTestSupport;

/** 종목 토론 게시판: 글·댓글·공감. 보기는 누구나, 쓰기·삭제는 로그인, 삭제는 본인만 */
class BoardApiTest extends ApiTestSupport {

    private ResultActions writePost(String token, String stockCode, String title) throws Exception {
        return mvc.perform(post("/api/stocks/{code}/posts", stockCode).header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"" + title + "\",\"content\":\"본문입니다\"}"));
    }

    private long newPost(String token, String title) throws Exception {
        return readLong(writePost(token, KIA, title).andReturn(), "$.postId");
    }

    private ResultActions writeComment(String token, long postId, String content) throws Exception {
        return mvc.perform(post("/api/posts/{id}/comments", postId).header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"" + content + "\"}"));
    }

    @Test
    void 글쓰기는_로그인이_필요하고_보기는_누구나() throws Exception {
        mvc.perform(post("/api/stocks/{code}/posts", KIA).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"제목\",\"content\":\"본문\"}"))
                .andExpect(status().isUnauthorized());

        String token = tokenOf("zzboard01");
        writePost(token, KIA, "기아 어떻게 보세요")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.stockName").value("기아"))
                .andExpect(jsonPath("$.authorLoginId").value("zzboard01"));

        // 토큰 없이 목록 보기
        mvc.perform(get("/api/stocks/{code}/posts", KIA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("기아 어떻게 보세요"))
                .andExpect(jsonPath("$.items[0].commentCount").value(0))
                .andExpect(jsonPath("$.items[0].likeCount").value(0));
    }

    @Test
    void 제목이_비었거나_없는_종목이면_실패() throws Exception {
        String token = tokenOf("zzboard02");

        writePost(token, KIA, "").andExpect(status().isBadRequest());
        writePost(token, "999999", "제목").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("STOCK_NOT_FOUND"));
    }

    @Test
    void 남의_글은_삭제_못_하고_본인_글은_삭제된다() throws Exception {
        String author = tokenOf("zzboard03");
        String other = tokenOf("zzboard04");
        long postId = newPost(author, "내 글");

        mvc.perform(delete("/api/posts/{id}", postId).header("Authorization", bearer(other)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_POST_OWNER"));
        mvc.perform(delete("/api/posts/{id}", postId).header("Authorization", bearer(author)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/posts/{id}", postId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("POST_NOT_FOUND"));
    }

    @Test
    void 댓글을_쓰면_글의_댓글_수가_늘고_남의_댓글은_삭제_못_한다() throws Exception {
        String author = tokenOf("zzboard05");
        String commenter = tokenOf("zzboard06");
        long postId = newPost(author, "댓글 달 글");

        long commentId = readLong(writeComment(commenter, postId, "좋은 글이네요")
                .andExpect(status().isCreated())
                .andReturn(), "$.commentId");

        mvc.perform(get("/api/posts/{id}", postId))
                .andExpect(jsonPath("$.commentCount").value(1));
        mvc.perform(get("/api/posts/{id}/comments", postId))
                .andExpect(jsonPath("$.items[0].content").value("좋은 글이네요"))
                .andExpect(jsonPath("$.items[0].authorLoginId").value("zzboard06"));

        // 글쓴이라도 남의 댓글은 못 지움
        mvc.perform(delete("/api/comments/{id}", commentId).header("Authorization", bearer(author)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_COMMENT_OWNER"));
        mvc.perform(delete("/api/comments/{id}", commentId).header("Authorization", bearer(commenter)))
                .andExpect(status().isNoContent());
    }

    @Test
    void 공감은_누르면_1_다시_누르면_취소() throws Exception {
        String author = tokenOf("zzboard07");
        String fan = tokenOf("zzboard08");
        long postId = newPost(author, "공감 받을 글");

        mvc.perform(post("/api/posts/{id}/like", postId).header("Authorization", bearer(fan)))
                .andExpect(jsonPath("$.liked").value(true))
                .andExpect(jsonPath("$.likeCount").value(1));
        mvc.perform(post("/api/posts/{id}/like", postId).header("Authorization", bearer(author)))
                .andExpect(jsonPath("$.likeCount").value(2));
        // 같은 사람이 다시 누르면 취소 (한 사람 1회)
        mvc.perform(post("/api/posts/{id}/like", postId).header("Authorization", bearer(fan)))
                .andExpect(jsonPath("$.liked").value(false))
                .andExpect(jsonPath("$.likeCount").value(1));
        // 토큰 없이 공감은 401
        mvc.perform(post("/api/posts/{id}/like", postId))
                .andExpect(status().isUnauthorized());
    }
}
