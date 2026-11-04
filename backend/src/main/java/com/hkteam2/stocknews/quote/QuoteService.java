package com.hkteam2.stocknews.quote;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.Function;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import com.hkteam2.stocknews.common.TimeUtils;

/**
 * 시세 조회 ("주방"): KIS 답을 우리 API 모양으로 바꾸고, 짧은 캐시로 KIS 호출을 줄임
 *
 * | 무엇 | 캐시 | KIS 호출 |
 * | 현재가 | 5초 | 1번 |
 * | 분봉 1·5·10·30분 (그날 하루) | 오늘 장중 60초, 15:40 이후·지난 날 1시간 | 4번 동시에 (120분 구간씩), 주말 0번 → 서버가 n분씩 묶음 |
 * | 주·월·년봉 | 10분 | 1번 (최근 100개, 년봉은 상장 이후) |
 * | 일봉 1년 (차트 첫 화면 + 급등·급락 이력, 같은 캐시) | 10분 | 3번 (140일씩 나눠서) |
 * | 일·주·월봉 이어 받기 (to 이전 100개) | 1시간 | 1번 |
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
    /** 지난 날 분봉은 바뀌지 않으므로 길게 */
    static final Duration PAST_MINUTE_TTL = Duration.ofHours(1);
    /** 지난 구간 일·주·월봉 (to 있음)도 바뀌지 않으므로 길게 */
    static final Duration PAST_PERIOD_TTL = Duration.ofHours(1);
    /** 09:00~15:30 = 391분, KIS는 한 번에 120분 → 4구간 (+ 여유 1) */
    private static final int MINUTE_PAGES = 5;
    /** KIS 분봉 한 번에 거꾸로 120줄 */
    private static final int MINUTE_WINDOW_MINUTES = 120;
    /** 이 시각이 지나면 오늘 분봉도 다 나온 것 (15:30 종가 단일가 봉이 들어올 여유 10분) */
    static final LocalTime MINUTE_SETTLED_AT = LocalTime.of(15, 40);
    private static final LocalTime MARKET_OPEN = CandleAggregator.MARKET_OPEN;
    private static final LocalTime MARKET_CLOSE = LocalTime.of(15, 30);
    /** KIS 분봉 보관 기간 (공식 예제 주석: 최대 1년) */
    static final int MINUTE_HISTORY_DAYS = 365;
    /** KIS 일봉은 한 번에 100개까지 → 달력 140일씩 (거래일 약 96일) */
    private static final int DAILY_CHUNK_DAYS = 140;
    /** 1년 + 앞쪽 여유 (첫날 등락률을 내려면 그 전 거래일 종가가 필요, 연휴 대비 2주) */
    private static final int YEAR_DAYS = 366 + 14;

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

    /** 오늘 날짜 (한국 시간). 분봉 날짜를 고를 때 기준 */
    public LocalDate today() {
        return LocalDate.now(clock);
    }

    /**
     * 분봉 차트: date 하루(09:00~15:30)의 1분봉을 받아 unit 분씩 묶음. 오래된 것부터
     * 1분봉 원본은 날짜마다 캐시해서 5·10·30분봉으로 바꿔 봐도 KIS를 다시 부르지 않음
     */
    public ChartResponse minuteChart(String stockCode, ChartUnit unit, LocalDate date) {
        List<KisCandle> oneMinute = oneMinuteCandles(stockCode, date);
        return new ChartResponse(stockCode, unit.code(), date,
                toCandles(CandleAggregator.aggregate(oneMinute, unit.minutes())));
    }

    /**
     * 그날 1분봉 전부. 그날·장 시간(09:00~15:30) 것만 남김
     *
     * 15:30(오늘 장중이면 지금)부터 120분 간격으로 끊은 구간(15:30·13:30·11:30·09:30)을 KIS에 **한꺼번에** 물음.
     * 예전에는 한 구간 답을 받고 나서 다음 구간을 물어(KIS 한 번에 약 1초 × 4번) 첫 조회가 5초쯤 걸렸음 (QA #7)
     * - 구간끼리는 서로의 답이 필요 없어서 동시에 물어도 됨. 줄 서기(KisRateLimiter)는 그대로라 KIS 한도는 지킴
     * - KIS는 구간마다 거꾸로 120줄을 줌. 거래 없는 분(15:20~15:30 단일가 등)은 줄이 없어서 120분보다 길게 덮음
     *   → 구간끼리 겹치기만 하고 빈틈은 생기지 않음. 겹치는 분은 하나로 합침
     * - 주말은 장이 없으니 KIS에 묻지 않음 (화면이 빈 날을 건너 앞 영업일을 물을 때 헛호출 4번을 막음)
     */
    List<KisCandle> oneMinuteCandles(String stockCode, LocalDate date) {
        if (date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY) {
            return List.of();
        }
        LocalDateTime now = LocalDateTime.now(clock).withNano(0);
        boolean isToday = date.equals(now.toLocalDate());
        // 오늘이라도 장이 끝나고 조금 지나면(15:40) 더 바뀌지 않으므로 지난 날처럼 길게
        boolean settled = !isToday || !now.toLocalTime().isBefore(MINUTE_SETTLED_AT);
        return cache.get("m1:" + stockCode + ":" + date, settled ? PAST_MINUTE_TTL : MINUTE_TTL, () -> {
            LocalTime until = isToday && now.toLocalTime().isBefore(MARKET_CLOSE) ? now.toLocalTime() : MARKET_CLOSE;
            List<LocalTime> windows = new ArrayList<>();
            for (LocalTime t = until; !t.isBefore(MARKET_OPEN) && windows.size() < MINUTE_PAGES;
                 t = t.minusMinutes(MINUTE_WINDOW_MINUTES)) {
                windows.add(t);
            }
            Map<LocalDateTime, KisCandle> byTime = new TreeMap<>();   // 시각 순 + 겹치는 분 하나로
            for (List<KisCandle> rows : inParallel(windows, t -> kis.inquireMinuteCandles(stockCode, date, t))) {
                for (KisCandle c : rows) {
                    LocalTime t = c.time().toLocalTime();
                    // 장 시작 앞으로 넘어가면 전날 시간외 봉이 섞여 옴 → 그날 09:00~15:30만
                    if (c.time().toLocalDate().equals(date) && !t.isBefore(MARKET_OPEN) && !t.isAfter(MARKET_CLOSE)) {
                        byTime.put(c.time(), c);
                    }
                }
            }
            return List.copyOf(byTime.values());
        });
    }

    /**
     * 여러 KIS 조회를 동시에 보내고, 보낸 순서대로 답을 모음. 하나라도 실패하면 그 오류를 그대로 던짐
     * (KisApiException 그대로 → QuoteExceptionHandler가 429·502로 바꿈)
     * 일꾼(스레드)은 부를 때마다 구간 수만큼 만들고 끝나면 닫음. 분봉은 캐시가 있어 새로 만드는 일이 드묾
     */
    private static <T, R> List<R> inParallel(List<T> inputs, Function<T, R> call) {
        if (inputs.isEmpty()) {
            return List.of();
        }
        try (ExecutorService pool = Executors.newFixedThreadPool(inputs.size())) {
            List<Future<R>> futures = inputs.stream().map(in -> pool.submit(() -> call.apply(in))).toList();
            List<R> out = new ArrayList<>();
            for (Future<R> f : futures) {
                out.add(f.get());
            }
            return out;
        } catch (ExecutionException e) {
            if (e.getCause() instanceof RuntimeException re) {
                throw re;
            }
            throw new KisApiException("PARALLEL_FAILED", String.valueOf(e.getCause()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new KisApiException("INTERRUPTED", "기다리는 중 중단됨");
        }
    }

    /** 일·주·월·년봉 최근 (to 없음) */
    public ChartResponse periodChart(String stockCode, ChartUnit unit) {
        return periodChart(stockCode, unit, null);
    }

    /**
     * 일·주·월·년봉. 오래된 것부터
     * - to 없음 (첫 화면): 일봉은 1년 치 = 급등·급락 이력과 같은 캐시를 씀 (KIS 추가 호출 0).
     *   주·월봉은 최근 100개 (주봉 95주, 월봉 95개월), 년봉은 상장 이후 전체 (99년)
     * - to 있음 (화면을 왼쪽으로 끌 때 이어 받기): to(포함)까지 거꾸로 100개 이내 = KIS 1번.
     *   지난 구간은 값이 바뀌지 않으므로 1시간 캐시
     */
    public ChartResponse periodChart(String stockCode, ChartUnit unit, LocalDate to) {
        if (to == null && unit == ChartUnit.DAY) {
            return new ChartResponse(stockCode, unit.code(), null, toCandles(yearDailyCandles(stockCode)));
        }
        // 이름표 앞에 용도(chart:)를 붙임. 예전에는 "year:"가 아래 yearDailyCandles와 겹쳐 년봉이 일봉 목록을 꺼내 500이 났음
        String key = "chart:" + unit.code() + ":" + stockCode + (to == null ? "" : ":" + to);
        return cache.get(key, to == null ? DAY_TTL : PAST_PERIOD_TTL, () -> {
            LocalDate end = to == null ? today() : to;
            LocalDate from = switch (unit) {
                case WEEK -> end.minusWeeks(95);
                case MONTH -> end.minusMonths(95);
                case YEAR -> end.minusYears(99);
                default -> end.minusDays(150);   // 달력 150일 = 거래일 약 100일
            };
            List<KisCandle> rows = new ArrayList<>(kis.inquirePeriodCandles(stockCode, from, end, unit.periodCode()));
            rows.sort(Comparator.comparing(KisCandle::time));
            return new ChartResponse(stockCode, unit.code(), null, toCandles(rows));
        });
    }

    /**
     * 일봉 약 1년 치 (급등·급락 이력용), 오래된 것부터
     * 오늘부터 거꾸로 140일씩 나눠 KIS에 물음 (3번). 경계에서 겹치는 날은 하나로
     */
    public List<KisCandle> yearDailyCandles(String stockCode) {
        return cache.get("daily1y:" + stockCode, DAY_TTL, () -> {
            LocalDate today = LocalDate.now(clock);
            LocalDate start = today.minusDays(YEAR_DAYS);
            Map<LocalDateTime, KisCandle> byDate = new TreeMap<>();
            for (LocalDate end = today; !end.isBefore(start); ) {
                LocalDate from = end.minusDays(DAILY_CHUNK_DAYS - 1);
                if (from.isBefore(start)) {
                    from = start;
                }
                kis.inquireDailyCandles(stockCode, from, end).forEach(c -> byDate.put(c.time(), c));
                end = from.minusDays(1);
            }
            return List.copyOf(byDate.values());
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
