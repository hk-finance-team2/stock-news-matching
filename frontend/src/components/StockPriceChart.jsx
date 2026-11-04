// 종목 주가 차트: TradingView Lightweight Charts(오픈소스 그리기 라이브러리)로 캔들 + 거래량
// 데이터는 우리 백엔드 GET /api/quotes/{code}/chart (원래 KIS). TradingView 서버·데이터는 쓰지 않음
// 처음 모양(종목 요약 탭 맨 위, 불러오는 중·실패·빈 데이터 표시)은 #61(호현님) 차트를 따름
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

export default function StockPriceChart({ stockCode, stockName }) {
  const [unit, setUnit] = useState('day');
  const [data, setData] = useState({ key: null, items: [], error: null });
  const [legend, setLegend] = useState(null); // 마우스가 가리키는 봉 { open, high, low, close, volume }
  const boxRef = useRef(null);
  const chartRef = useRef(null);

  // 차트는 한 번만 만들고 데이터만 바꿈 (만들 때 무거움). 화면에서 사라지면 정리
  useEffect(() => {
    const c = readColors();
    const chart = createChart(boxRef.current, {
      autoSize: true,
      layout: { textColor: c.text, background: { color: 'transparent' }, attributionLogo: true },
      grid: { vertLines: { color: '#f1f5f9' }, horzLines: { color: '#f1f5f9' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      localization: { locale: 'ko-KR', priceFormatter: fmt },
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
    chartRef.current = { chart, candles, volume, colors: c };
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // 종목·단위가 바뀌면 다시 받음 (이전 요청은 취소)
  const key = `${stockCode}:${unit}`;
  useEffect(() => {
    if (!stockCode) return undefined;
    const controller = new AbortController();
    quoteApi
      .chart(stockCode, unit, { signal: controller.signal })
      .then((res) => setData({ key, items: res.items || [], error: null }))
      .catch((err) => {
        if (err.name !== 'AbortError') setData({ key, items: [], error: err });
      });
    return () => controller.abort();
  }, [stockCode, unit, key]);

  // 받은 데이터를 차트에 그림
  useEffect(() => {
    const ref = chartRef.current;
    if (!ref || data.key !== key) return;
    const rows = [...data.items]
      .map((it) => ({ ...it, t: toChartTime(it.time, unit) }))
      .sort((a, b) => (a.t > b.t ? 1 : a.t < b.t ? -1 : 0));
    ref.candles.setData(rows.map((r) => ({ time: r.t, open: r.open, high: r.high, low: r.low, close: r.close })));
    ref.volume.setData(
      rows.map((r) => ({
        time: r.t,
        value: r.volume,
        color: `${r.close >= r.open ? ref.colors.up : ref.colors.down}66`, // 반투명
      }))
    );
    ref.chart.applyOptions({ timeScale: { timeVisible: isIntraday(unit), secondsVisible: false } });
    ref.chart.timeScale().fitContent();
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
          ? '오늘 분봉이 아직 없습니다 (장 시작 전·휴장일). 일봉 이상으로 보세요.'
          : '표시할 시세가 없습니다.'
        : null;

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

      {/* 마우스가 가리키는 봉(없으면 마지막 봉)의 값 */}
      <div className="stock-meta num" style={{ minHeight: 18, marginBottom: 6 }}>
        {shown && !message
          ? `시 ${fmt(shown.open)} · 고 ${fmt(shown.high)} · 저 ${fmt(shown.low)} · 종 ${fmt(shown.close)}` +
            (shown.volume != null ? ` · 거래량 ${fmt(shown.volume)}` : '')
          : ' '}
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
        캔들: 빨강 상승 · 파랑 하락, 아래는 거래량. 끌어서 이동·휠로 확대. 시세 출처 한국투자증권(KIS), 차트 그리기 TradingView Lightweight Charts
      </div>
    </div>
  );
}
