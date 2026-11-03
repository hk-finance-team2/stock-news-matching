package com.hkteam2.stocknews.quote;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 실시간 수집 상태 (GET /api/quotes/status). 개발·발표 때 "잘 받고 있나"를 숫자로 보여 줌
 *
 * 생중계 자리: capacity(등록 한도, KIS가 거절하면 스스로 낮춤), fixedCodes(항상 생중계),
 *   activeCodes(지금 자리를 준 종목), waitingCodes(보는 사람은 있는데 자리가 없어 REST로 대신), viewers(종목별 보는 사람 수)
 * 수집: received(웹소켓으로 받아 읽은 체결 수, 서버 켠 뒤), saved(DB에 새로 넣은 수, 중복 제외),
 *   dropped(대기열이 꽉 차 버린 수), failed(저장 실패로 버린 수), queueSize(아직 저장 안 된 수),
 *   quarantined(읽지 못해 격리한 메시지 수), ticksToday(오늘 DB에 있는 체결 수)
 */
public record QuoteStatusResponse(
        String mode,
        boolean connected,
        OffsetDateTime connectedAt,
        OffsetDateTime lastMessageAt,
        int capacity,
        List<String> fixedCodes,
        List<String> activeCodes,
        List<String> subscribedCodes,
        List<String> waitingCodes,
        Map<String, Integer> viewers,
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
