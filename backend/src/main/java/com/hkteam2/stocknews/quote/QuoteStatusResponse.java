package com.hkteam2.stocknews.quote;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 실시간 수집 상태 (GET /api/quotes/status). 개발·발표 때 "잘 받고 있나"를 숫자로 보여 줌
 * received: 웹소켓으로 받아 읽은 체결 수(서버 켠 뒤), saved: 실제로 DB에 새로 넣은 수(중복 제외),
 * dropped: 대기열이 꽉 차 버린 수, failed: 저장 실패로 버린 수, queueSize: 아직 저장 안 된 수,
 * quarantined: 읽지 못해 격리한 메시지 수, ticksToday: 오늘 DB에 있는 체결 수
 */
public record QuoteStatusResponse(
        String mode,
        boolean connected,
        OffsetDateTime connectedAt,
        OffsetDateTime lastMessageAt,
        List<String> fixedCodes,
        List<String> subscribedCodes,
        long messages,
        long received,
        long saved,
        long dropped,
        long failed,
        int queueSize,
        long quarantined,
        long reconnects,
        long ticksToday
) {
}
