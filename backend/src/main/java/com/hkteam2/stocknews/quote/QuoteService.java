package com.hkteam2.stocknews.quote;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import com.hkteam2.stocknews.common.TimeUtils;

/**
 * 시세 조회 ("주방"): KIS 답을 우리 API 모양으로 바꾸고, 짧은 캐시로 KIS 호출을 줄임
 *
 * | 무엇 | 캐시 | KIS 호출 |
 * | 현재가 | 5초 | 1번 |
 * | 오늘 분봉 | 60초 | 최대 4번 (30분씩 거꾸로, 약 2시간) |
 * | 일봉 | 10분 | 1번 (최근 약 100거래일) |
 * | 최근 체결 | 5초 | 1번 (30건) |
 * KIS_ENABLED=true 일 때만 만들어짐. 꺼져 있으면 QuoteController가 503 QUOTE_DISABLED
 */
@Service
@ConditionalOnProperty(name = "KIS_ENABLED", havingValue = "true")
public class QuoteService {

    static final Duration PRICE_TTL = Duration.ofSeconds(5);
    static final Duration MINUTE_TTL = Duration.ofSeconds(60);
    static final Duration DAY_TTL = Duration.ofMinutes(10);
    static final Duration TICK_TTL = Duration.ofSeconds(5);
    private static final int MINUTE_PAGES = 4;
    private static final int PAGE_SIZE = 30;
    private static final LocalTime MARKET_OPEN = LocalTime.of(9, 0);

    /** 실시간 현재가가 이만큼 안에 갱신됐으면 KIS에 묻지 않고 그 값을 씀 */
    static final Duration LIVE_FRESH = Duration.ofSeconds(15);

    private final KisRestClient kis;
    private final KisProperties props;
    private final KisWebSocketClient realtime;
    private final TickBuffer buffer;
    private final TickWriter writer;
    private final QuoteMapper mapper;
    private final SubscriptionManager subscriptions;
    private final QuoteCache cache;
    private final Clock clock;

    public QuoteService(KisRestClient kis, KisProperties props, KisWebSocketClient realtime, TickBuffer buffer,
                        TickWriter writer, QuoteMapper mapper, SubscriptionManager subscriptions) {
        this.kis = kis;
        this.props = props;
        this.realtime = realtime;
        this.buffer = buffer;
        this.writer = writer;
        this.mapper = mapper;
        this.subscriptions = subscriptions;
        this.clock = Clock.system(TimeUtils.KST);
        this.cache = new QuoteCache(clock);
    }

    /**
     * 현재가. 실시간으로 받고 있는 종목이면 DB의 현재가(quote_snapshot)를 바로 씀 (KIS 호출 0, live=true)
     * 아니면 KIS REST 조회 + 5초 캐시
     */
    public QuoteResponse price(String stockCode) {
        QuoteSnapshotRow s = mapper.findSnapshot(stockCode);
        if (isLive(s)) {
            return fromSnapshot(s);
        }
        return cache.get("price:" + stockCode, PRICE_TTL, () -> {
            KisPrice p = kis.inquirePrice(stockCode);
            return new QuoteResponse(p.stockCode(), p.price(), p.changeAmount(), p.changeRate(),
                    direction(p.changeSign()), p.open(), p.high(), p.low(), p.accVolume(),
                    TimeUtils.toKst(LocalDateTime.now(clock)), false);
        });
    }

    /** 오늘 1분봉. 30분씩 거꾸로 최대 4쪽 → 오래된 것부터 정렬 */
    public ChartResponse minuteChart(String stockCode) {
        return cache.get("minute:" + stockCode, MINUTE_TTL, () -> {
            Map<LocalDateTime, KisCandle> byTime = new TreeMap<>();   // 시각 순 + 겹치는 분 하나로
            LocalTime until = LocalTime.now(clock);
            for (int page = 0; page < MINUTE_PAGES; page++) {
                List<KisCandle> rows = kis.inquireMinuteCandles(stockCode, until);
                rows.forEach(c -> byTime.put(c.time(), c));
                LocalDateTime earliest = rows.stream().map(KisCandle::time).min(Comparator.naturalOrder()).orElse(null);
                if (rows.size() < PAGE_SIZE || earliest == null || !earliest.toLocalTime().isAfter(MARKET_OPEN)) {
                    break;   // 장 시작(09:00)까지 다 받았거나 더 없음
                }
                until = earliest.toLocalTime().minusMinutes(1);
            }
            return new ChartResponse(stockCode, "MINUTE", toCandles(byTime.values()));
        });
    }

    /** 최근 약 100거래일 일봉 (달력으로 150일 전부터, KIS는 한 번에 100개까지) → 오래된 것부터 */
    public ChartResponse dayChart(String stockCode) {
        return cache.get("day:" + stockCode, DAY_TTL, () -> {
            LocalDate today = LocalDate.now(clock);
            List<KisCandle> rows = new ArrayList<>(kis.inquireDailyCandles(stockCode, today.minusDays(150), today));
            rows.sort(Comparator.comparing(KisCandle::time));
            return new ChartResponse(stockCode, "DAY", toCandles(rows));
        });
    }

    /** 최근 체결 30건 (최신이 앞) */
    public List<TickResponse> ticks(String stockCode) {
        return cache.get("ticks:" + stockCode, TICK_TTL, () -> {
            LocalDate today = LocalDate.now(clock);
            return kis.inquireRecentTicks(stockCode).stream()
                    .map(t -> new TickResponse(TimeUtils.toKst(today.atTime(t.time())), t.price(), t.changeAmount(),
                            t.changeRate(), direction(t.changeSign()), t.volume(), t.strength()))
                    .toList();
        });
    }

    /** 실시간 현재가 줄이 최근(15초 안)에 갱신됐는지 = 지금 생중계로 받고 있는지 */
    boolean isLive(QuoteSnapshotRow s) {
        return s != null && s.updatedAt().isAfter(LocalDateTime.now(clock).minus(LIVE_FRESH));
    }

    /** DB 현재가 줄 → API 응답 (live=true) */
    static QuoteResponse fromSnapshot(QuoteSnapshotRow s) {
        return new QuoteResponse(s.stockCode(), s.price(), s.changeAmount(), s.changeRate(),
                direction(s.changeSign()), s.openPrice(), s.highPrice(), s.lowPrice(), s.accVolume(),
                TimeUtils.toKst(s.tradedAt()), true);
    }

    /** 실시간 수집 상태 */
    public QuoteStatusResponse status() {
        return new QuoteStatusResponse(props.mode(), realtime.connected(), TimeUtils.toKst(realtime.connectedAt()),
                TimeUtils.toKst(realtime.lastMessageAt()), subscriptions.capacity(), subscriptions.fixedCodes(),
                subscriptions.activeCodes(), realtime.subscribedCodes(), subscriptions.waitingCodes(),
                subscriptions.viewers(),
                realtime.messages(), buffer.received(), writer.saved(), buffer.dropped(), writer.failed(),
                buffer.size(), realtime.quarantined(), realtime.reconnects(), mapper.countTicks(LocalDate.now(clock)));
    }

    /** KIS 전일 대비 부호 → 화면용. 1 상한·2 상승 → UP, 4 하한·5 하락 → DOWN, 3 보합 → FLAT */
    static String direction(String kisSign) {
        if ("1".equals(kisSign) || "2".equals(kisSign)) {
            return "UP";
        }
        if ("4".equals(kisSign) || "5".equals(kisSign)) {
            return "DOWN";
        }
        return "FLAT";
    }

    private static List<ChartResponse.Candle> toCandles(Iterable<KisCandle> candles) {
        List<ChartResponse.Candle> out = new ArrayList<>();
        for (KisCandle c : candles) {
            out.add(new ChartResponse.Candle(TimeUtils.toKst(c.time()), c.open(), c.high(), c.low(), c.close(), c.volume()));
        }
        return out;
    }
}
