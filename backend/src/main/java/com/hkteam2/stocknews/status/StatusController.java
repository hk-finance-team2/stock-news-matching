package com.hkteam2.stocknews.status;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** 데이터 상태. 로그인 없이 */
@Tag(name = "데이터 상태", description = "뉴스·SNS·요약이 언제 마지막으로 갱신됐는지")
@RestController
@RequestMapping("/api/status")
public class StatusController {

    private final StatusService statusService;

    public StatusController(StatusService statusService) {
        this.statusService = statusService;
    }

    @Operation(summary = "데이터 상태 (마지막 갱신 시각)",
            description = "newsCollectedAt·snsCollectedAt: 마지막으로 받은 뉴스·SNS 글의 수집 시각,"
                    + " summaryGeneratedAt: 마지막 종목 요약 생성 시각, lastSuccessAt: AI 수집이 마지막으로 성공한 시각,"
                    + " lastRun: 가장 최근 수집 실행(RUNNING/SUCCESS/FAILED). 아직 데이터가 없으면 각각 null")
    @GetMapping
    public DataStatusResponse getStatus() {
        return statusService.getStatus();
    }
}
