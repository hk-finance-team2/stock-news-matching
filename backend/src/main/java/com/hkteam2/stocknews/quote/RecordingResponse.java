package com.hkteam2.stocknews.quote;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/** 다시 볼 수 있는 날 (GET /api/quotes/{stockCode}/recordings) */
public record RecordingResponse(LocalDate date, long tickCount, OffsetDateTime firstAt, OffsetDateTime lastAt) {
}
