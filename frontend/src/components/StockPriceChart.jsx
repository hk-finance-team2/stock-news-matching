// 종목 주가 차트: TradingView Lightweight Charts(오픈소스 그리기 라이브러리)로 캔들 + 거래량
// 데이터는 우리 백엔드 GET /api/quotes/{code}/chart (원래 KIS). TradingView 서버·데이터는 쓰지 않음
// 처음 모양(종목 요약 탭 맨 위, 불러오는 중·실패·빈 데이터 표시)은 #61(호현님) 차트를 따름
// 왼쪽으로 끌면 과거를 이어 받음 (일봉 100개씩, 분봉은 최근 5영업일까지). docs/decisions.md 11/04
import { useEffect, useRef, useState } from 'react';
import { CandlestickSeries, HistogramSeries, createChart } from 'lightweight-charts';
import { quoteApi } from '../api';

const UNITS = [
  { key: '1m', label: '1분' },
  { key: '5m', label: '5분' },
  { key: '10m', label: '10분' },
  { key: '30m', label: '30분' },
  { key: 'day', label: '일' },
  { key: 'week', label: '주' },
  { key: 'month', label: '월' },
  { key: 'year', label: '년' },
];
const CHART_HEIGHT = 340;
const KST_OFFSET_SEC = 9 * 3600;

const isIntraday = (unit) => unit.endsWith('m');

// 과거 이어 받기. KIS는 초당 호출 제한이 있어 "필요할 때만, 하나씩"
/** 분봉은 최근 이만큼의 영업일까지만 (하루 = KIS 약 4번) */
const MAX_INTRADAY_DAYS = 5;
/** 일봉은 처음에 1년 치를 받고, 이만큼만 보여 줌 (나머지는 끌면 보임) */
const DAY_INITIAL_BARS = 120;
/** 보이는 범위 왼쪽이 첫 봉에서 이만큼 안으로 들어오면 더 받음 */
const LOAD_MORE_MARGIN = 10;

/** 'YYYY-MM-DD' 하루 전 */
const dayBefore = (ymd) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** 'YYYY-MM-DD' 직전 평일 (주말 건너뜀. 공휴일은 빈 날로 오면 한 번 더 앞으로) */
const prevWeekday = (ymd) => {
  let d = dayBefore(ymd);
  while ([0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())) d = dayBefore(d);
  return d;
};

/**
 * 분봉 하루치를 받음. 빈 날(장 전·주말·공휴일)이면 그 앞 평일로, 지금까지 물은 날과 합쳐 MAX_INTRADAY_DAYS 번까지
 * date null = 오늘. → { items, date(받은 날 또는 마지막으로 물은 날), tried(지금까지 물은 날 수) }
 */
async function fetchIntradayDay(stockCode, unit, date, tried, signal) {
  let day = date;
  let count = tried;
  while (count < MAX_INTRADAY_DAYS) {
    const res = await quoteApi.chart(stockCode, unit, { date: day ?? undefined }, { signal });
    count += 1;
    const answered = res.date || day;
    if (res.items?.length) return { items: res.items, date: answered, tried: count };
    day = prevWeekday(answered);
  }
  return { items: [], date: day, tried: count };
}

/** 옛것 + 지금 것, 같은 시각은 하나로, 오래된 것부터 */
const mergeOlder = (older, current) => {
  const byTime = new Map();
  [...older, ...current].forEach((it) => byTime.set(it.time, it));
  return [...byTime.values()].sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));
};

/**
 * API 시각 → 차트 시각
 * 분봉: 초 단위 숫자. 차트는 숫자 시각을 UTC로 그려서 9시간을 더해 한국 시각으로 보이게 (라이브러리 권장 방식)
 * 일봉 이상: 'YYYY-MM-DD' (날짜만)
 */
const toChartTime = (iso, unit) =>
  isIntraday(unit) ? Math.floor(new Date(iso).getTime() / 1000) + KST_OFFSET_SEC : String(iso).slice(0, 10);

/** 국내 증권 앱 관례: 상승 빨강, 하락 파랑. 화면 색 변수(--up-color 등)를 그대로 씀 */
const readColors = () => {
  const css = getComputedStyle(document.documentElement);
  const pick = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return { up: pick('--up-color', '#e11d48'), down: pick('--down-color', '#2563eb'), text: pick('--text-sub', '#666666') };
};

const fmt = (n) => (n == null ? '-' : Math.round(n).toLocaleString('ko-KR'));

const pad = (n) => String(n).padStart(2, '0');

/** 십자선 아래 시각 글자. 기본값은 "04 11월 '26 12:30"처럼 영어식 순서라 한국식으로 (분봉 11/04 12:30, 그 밖 2026-11-04) */
const formatTime = (t) => {
  if (typeof t === 'number') {
    const d = new Date(t * 1000); // 이미 9시간을 더한 값이라 UTC 기준으로 읽으면 한국 시각
    return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }
  if (typeof t === 'object' && t) return `${t.year}-${pad(t.month)}-${pad(t.day)}`;
  return String(t);
};

const EMPTY = { key: null, items: [], error: null, more: false, cursor: null, tried: 0 };

export default function StockPriceChart({ stockCode, stockName }) {
  const [unit, setUnit] = useState('day');
  // items: 오래된 것부터. more: 더 옛날을 받을 수 있는지. cursor: 일봉은 가장 옛 날짜, 분봉은 가장 옛날 물어본 날
  const [data, setData] = useState(EMPTY);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(null);
  const [legend, setLegend] = useState(null); // 마우스가 가리키는 봉 { open, high, low, close, volume }
  const boxRef = useRef(null);
  const chartRef = useRef(null);
  const dataRef = useRef(data); // 차트 이벤트(한 번만 등록)에서 최신 값을 읽으려고
  const busyRef = useRef(false); // 이어 받기는 한 번에 하나
  const moreAbortRef = useRef(null);
  const placedKeyRef = useRef(null); // 처음 위치(최근 쪽 보여 주기)를 잡은 종목·단위
  const shownCountRef = useRef(0); // 지금 차트에 그린 봉 수 (이어 받을 때 몇 개 붙었는지 계산)
  const loadOlderRef = useRef(() => {});

  // 차트는 한 번만 만들고 데이터만 바꿈 (만들 때 무거움). 화면에서 사라지면 정리
  useEffect(() => {
    const c = readColors();
    const chart = createChart(boxRef.current, {
      autoSize: true,
      layout: { textColor: c.text, background: { color: 'transparent' }, attributionLogo: true },
      grid: { vertLines: { color: '#f1f5f9' }, horzLines: { color: '#f1f5f9' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      localization: { locale: 'ko-KR', priceFormatter: fmt, timeFormatter: formatTime },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: c.up,
      downColor: c.down,
      borderUpColor: c.up,
      borderDownColor: c.down,
      wickUpColor: c.up,
      wickDownColor: c.down,
    });
    // 거래량은 아래 칸(창 1)에 따로
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceLineVisible: false }, 1);
    chart.panes()[0].setStretchFactor(3);
    chart.panes()[1].setStretchFactor(1);

    chart.subscribeCrosshairMove((param) => {
      const bar = param.seriesData?.get(candles);
      const vol = param.seriesData?.get(volume);
      setLegend(bar ? { ...bar, volume: vol?.value } : null);
    });
    // 보이는 범위가 바뀔 때(끌기·확대): 왼쪽이 첫 봉 가까이 오면 더 옛날을 받음 (라이브러리 공식 예제 방식)
    // from은 "몇 번째 봉"(0 = 첫 봉). 첫 봉보다 왼쪽 빈 곳까지 끌면 음수
    const onRange = (range) => {
      if (range && range.from < LOAD_MORE_MARGIN) loadOlderRef.current();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    chartRef.current = { chart, candles, volume, colors: c };
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // 종목·단위가 바뀌면 처음부터 다시 받음 (이전 요청·이어 받기는 취소)
  const key = `${stockCode}:${unit}`;
  useEffect(() => {
    if (!stockCode) return undefined;
    const controller = new AbortController();
    moreAbortRef.current?.abort();
    moreAbortRef.current = null;
    busyRef.current = false;
    setLoadingMore(false);
    setMoreError(null);
    const first = isIntraday(unit)
      ? // 분봉: 오늘부터. 오늘이 비면(장 전·주말) 가장 가까운 영업일
        fetchIntradayDay(stockCode, unit, null, 0, controller.signal).then((r) => ({
          items: r.items,
          cursor: r.date,
          tried: r.tried,
          more: r.items.length > 0 && r.tried < MAX_INTRADAY_DAYS,
        }))
      : quoteApi.chart(stockCode, unit, {}, { signal: controller.signal }).then((res) => {
          const items = res.items || [];
          // 일봉만 이어 받기 (주·월·년봉은 처음 범위가 이미 8년·상장 이후)
          return {
            items,
            cursor: items[0] ? String(items[0].time).slice(0, 10) : null,
            tried: 0,
            more: unit === 'day' && items.length > 0,
          };
        });
    first
      .then((r) => setData({ key, error: null, ...r }))
      .catch((err) => {
        if (err.name !== 'AbortError') setData({ ...EMPTY, key, error: err });
      });
    return () => controller.abort();
  }, [stockCode, unit, key]);

  // 더 옛날 받기: 일봉은 가장 옛 날짜 하루 전까지(to), 분봉은 그 앞 영업일 하루
  loadOlderRef.current = () => {
    const d = dataRef.current;
    if (busyRef.current || !d.more || d.key !== key || d.error) return;
    busyRef.current = true;
    setLoadingMore(true);
    const controller = new AbortController();
    moreAbortRef.current = controller;
    const next = isIntraday(unit)
      ? fetchIntradayDay(stockCode, unit, prevWeekday(d.cursor), d.tried, controller.signal).then((r) => ({
          older: r.items,
          cursor: r.date,
          tried: r.tried,
          more: r.items.length > 0 && r.tried < MAX_INTRADAY_DAYS,
        }))
      : quoteApi.chart(stockCode, unit, { to: dayBefore(d.cursor) }, { signal: controller.signal }).then((res) => {
          const older = res.items || [];
          // 빈 답 = 상장일보다 앞 → 끝
          return {
            older,
            cursor: older[0] ? String(older[0].time).slice(0, 10) : d.cursor,
            tried: 0,
            more: older.length > 0,
          };
        });
    next
      .then((r) => {
        setData((prev) =>
          prev.key === key // 그사이 종목·단위가 바뀌었으면 버림
            ? { ...prev, items: mergeOlder(r.older, prev.items), cursor: r.cursor, tried: r.tried, more: r.more }
            : prev
        );
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        // 실패하면 이 종목·단위에서는 더 묻지 않음 (끌 때마다 실패 요청을 반복하지 않게). 단위를 다시 고르면 처음부터
        setMoreError(err);
        setData((prev) => (prev.key === key ? { ...prev, more: false } : prev));
      })
      .finally(() => {
        if (moreAbortRef.current === controller) {
          moreAbortRef.current = null;
          busyRef.current = false;
          setLoadingMore(false);
        }
      });
  };

  // 받은 데이터를 차트에 그림
  useEffect(() => {
    dataRef.current = data;
    const ref = chartRef.current;
    if (!ref || data.key !== key) return;
    const rows = data.items.map((it) => ({ ...it, t: toChartTime(it.time, unit) }));
    // 이어 받은 경우: 앞에 붙은 봉 수만큼 보이는 범위를 옮겨 보던 자리를 지킴
    // (안 옮기면 차트가 "왼쪽에서 몇 번째"를 그대로 둬서 화면이 계속 왼쪽 끝 → 이어 받기가 꼬리를 물고 끝없이 반복)
    const timeScale = ref.chart.timeScale();
    const added = placedKeyRef.current === key ? rows.length - shownCountRef.current : 0;
    const before = added > 0 ? timeScale.getVisibleLogicalRange() : null;
    shownCountRef.current = rows.length;
    ref.candles.setData(rows.map((r) => ({ time: r.t, open: r.open, high: r.high, low: r.low, close: r.close })));
    ref.volume.setData(
      rows.map((r) => ({
        time: r.t,
        value: r.volume,
        color: `${r.close >= r.open ? ref.colors.up : ref.colors.down}66`, // 반투명
      }))
    );
    if (before) {
      timeScale.setVisibleLogicalRange({ from: before.from + added, to: before.to + added });
    }
    // 처음 한 번만 위치를 잡음
    if (placedKeyRef.current !== key) {
      placedKeyRef.current = key;
      ref.chart.applyOptions({ timeScale: { timeVisible: isIntraday(unit), secondsVisible: false } });
      if (unit === 'day' && rows.length > DAY_INITIAL_BARS) {
        // 1년 치를 다 넣으면 봉이 너무 가늘어서 최근 120개(약 6개월)만. 앞쪽은 끌면 보임
        ref.chart.timeScale().setVisibleLogicalRange({ from: rows.length - DAY_INITIAL_BARS, to: rows.length - 1 });
      } else {
        ref.chart.timeScale().fitContent();
      }
    }
  }, [data, key, unit]);

  const loading = data.key !== key;
  const last = data.items.length ? data.items[data.items.length - 1] : null;
  const shown = legend || last;
  const message = loading
    ? '차트 불러오는 중…'
    : data.error
      ? data.error.code === 'QUOTE_DISABLED'
        ? '시세가 꺼진 서버입니다 (KIS_ENABLED).'
        : `차트를 불러오지 못했습니다 (${data.error.message})`
      : data.items.length === 0
        ? isIntraday(unit)
          ? `최근 ${MAX_INTRADAY_DAYS}영업일 분봉이 없습니다. 일봉 이상으로 보세요.`
          : '표시할 시세가 없습니다.'
        : null;
  // 이어 받기 상태 한 줄 (값 줄 오른쪽)
  let moreStatus = '';
  if (!loading && !message) {
    if (loadingMore) moreStatus = '이전 데이터 불러오는 중…';
    else if (moreError) moreStatus = '이전 데이터를 불러오지 못했습니다';
    else if (!data.more && isIntraday(unit)) moreStatus = `분봉은 최근 ${MAX_INTRADAY_DAYS}영업일까지`;
    else if (!data.more && unit === 'day') moreStatus = '상장 이후 전부';
  }

  return (
    <div className="content-card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="card-title">📈 {stockName} 주가 차트</div>
        <div className="header-btn-group" role="group" aria-label="봉 단위">
          {UNITS.map((u) => (
            <button
              key={u.key}
              type="button"
              className={`more-link2 ${unit === u.key ? 'active' : ''}`}
              aria-pressed={unit === u.key}
              onClick={() => setUnit(u.key)}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      {/* 마우스가 가리키는 봉(없으면 마지막 봉)의 값 + 이어 받기 상태 */}
      <div
        className="stock-meta num"
        style={{ minHeight: 18, marginBottom: 6, display: 'flex', justifyContent: 'space-between', gap: 12 }}
      >
        <span>
          {shown && !message
            ? `시 ${fmt(shown.open)} · 고 ${fmt(shown.high)} · 저 ${fmt(shown.low)} · 종 ${fmt(shown.close)}` +
              (shown.volume != null ? ` · 거래량 ${fmt(shown.volume)}` : '')
            : ' '}
        </span>
        <span aria-live="polite">{moreStatus}</span>
      </div>

      {/* 차트 상자는 항상 그려 둠 (차트가 이 상자에 붙어 있음). 안내 문구는 위에 겹쳐 보여 줌 */}
      <div style={{ position: 'relative', height: CHART_HEIGHT }}>
        <div ref={boxRef} style={{ position: 'absolute', inset: 0 }} aria-label={`${stockName} 주가 차트`} role="img" />
        {message && (
          <div className="empty-text" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            {message}
          </div>
        )}
      </div>
      <div className="llm-notice">
        캔들: 빨강 상승 · 파랑 하락, 아래는 거래량. 끌어서 이동·휠로 확대, 왼쪽 끝까지 끌면 이전 데이터를 이어 받음.
        시세 출처 한국투자증권(KIS), 차트 그리기 TradingView Lightweight Charts
      </div>
    </div>
  );
}
