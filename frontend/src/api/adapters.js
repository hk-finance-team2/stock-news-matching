// 백엔드 응답 → 화면(DashboardPage)이 쓰는 모양으로 바꾸기
// 화면 조각(글 카드·상세·감성 막대 등)이 처음 만들어질 때 쓰던 칸 이름에 맞춤 → 화면 코드를 덜 고치고 연결
// 원칙: 백엔드에 없는 값은 지어내지 않음 (가짜 감성 %·가짜 연결 이유 금지) → 비워 두고 화면에서 "준비 중"

const EMPTY_RATIO = Object.freeze({ positive: 0, neutral: 0, negative: 0 });

/**
 * 화면 표기 (2026-11-10 "판단은 투자자, 보수적으로 정보만 제공"):
 * - 감성은 '기사 내용'의 긍정·부정·중립. 호재·악재(주가 판단)라고 쓰지 않음. null 은 판단하지 않은 것 → "판단 보류"
 * - 종목 연결은 관련도 % 대신 역할: MAIN 주인공 / MENTIONED 함께 언급
 * - 근거 문장의 사실 종류: 일어난 일 / 회사 계획 / 전망 / 소문
 */
export const SENTIMENT_LABEL = Object.freeze({ POSITIVE: '긍정', NEGATIVE: '부정', NEUTRAL: '중립' });
export const SENTIMENT_NONE_LABEL = '판단 보류';
export const ROLE_LABEL = Object.freeze({ MAIN: '주인공', MENTIONED: '함께 언급' });
export const FACT_TYPE_LABEL = Object.freeze({ FACT: '일어난 일', PLAN: '회사 계획', FORECAST: '전망', RUMOR: '소문' });

/** { articleCount, positive, neutral, negative } → 화면 비율. 센 글이 없으면 0 */
function toRatio(s) {
  return s && s.articleCount > 0
    ? { positive: s.positive, neutral: s.neutral, negative: s.negative }
    : EMPTY_RATIO;
}

/** "2026-11-02T09:04:19+09:00" → "2026-11-02 09:04" (화면 표기) */
export function toDisplayTime(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 16).replace('T', ' ');
}

/** "2026-11-02T09:04:19+09:00" → "09:04" */
export function toClock(iso) {
  return iso ? String(iso).slice(11, 16) : '';
}

/** 한국 시간 기준 오늘부터 며칠 전 글인지 (0 = 오늘). 기간 필터(오늘·7일·30일)에 씀 */
export function daysAgoKst(iso, now = new Date()) {
  if (!iso) return 0;
  const toKstDay = (d) => Math.floor((d.getTime() + 9 * 3600 * 1000) / 86400000);
  return Math.max(0, toKstDay(now) - toKstDay(new Date(iso)));
}

/**
 * 종목 사전 한 건 { stockCode, stockName, market, sector } → 화면 종목 모양
 * 시세·매칭 수·감성·요약은 이 API에 없음 → 비워 둠 (analysisReady: false). 다른 API로 채울 것:
 *   현재가 quoteApi, 오늘 글 수 stockApi.issues / watchlistApi.list, 감성·요약 stockApi.summary
 */
export function toUiStock(item) {
  return {
    code: item.stockCode,
    name: item.stockName,
    market: item.market || '',
    sector: item.sector || '',
    aliases: [],
    themes: [],
    price: null,
    changeRate: null,
    todayMatchedCount: 0,
    todayArticleCount: 0,
    // 같은 소식 묶음을 1건으로 센 오늘 소식 수 (이슈 순위 eventCount). 모르면 null → 화면에 안 보임
    todayEventCount: null,
    lastMatchedAt: '-',
    issueRank: '-',
    sentimentRatio: EMPTY_RATIO,
    sentiment: EMPTY_RATIO,
    headline: '',
    summary: '',
    newsSummary: '',
    snsSummary: '',
    analysisReady: false,
    dataSource: 'api',
  };
}

/** 글 목록·상세 한 건 → 화면 글 모양 (normalizeArticle 결과와 같은 칸) */
export function toUiArticle(item) {
  const relatedStocks = (item.stocks || [])
    .map((s) => {
      // role 칸이 아직 없는 서버면 isMain 으로 같은 값을 만듦 (백엔드도 role = isMain ? MAIN : MENTIONED)
      const role = s.role === 'MAIN' || s.role === 'MENTIONED' ? s.role : s.isMain ? 'MAIN' : 'MENTIONED';
      const factType = FACT_TYPE_LABEL[s.factType] ? s.factType : null;
      return {
        code: s.stockCode,
        name: s.stockName,
        relationType: s.matchType === 'DIRECT' ? '직접' : s.matchType === 'INDIRECT' ? '간접' : '',
        matchType: s.matchType || null,
        relevance: s.relevance ?? null,
        sentiment: s.sentiment || null,
        isMain: Boolean(s.isMain),
        role,
        roleLabel: ROLE_LABEL[role],
        factType,
        factTypeLabel: factType ? FACT_TYPE_LABEL[factType] : '',
        matchedKeywords: s.matchedKeywords || [],
        // 목록 API에는 없고 상세 API(articleApi.get)에만 있음. 없으면 빈 값 (가짜 문장을 채우지 않음)
        reason: s.reason || '',
        evidence: s.evidence || '',
      };
    })
    // 주인공 먼저 (서버는 관련도 순으로 줌. 같은 역할 안에서는 그 순서를 그대로)
    .sort((a, b) => (a.role === 'MAIN' ? 0 : 1) - (b.role === 'MAIN' ? 0 : 1));
  // 글 전체 감성은 상세에만 있음. 목록에서는 주인공 종목(isMain)에 대한 감성으로 대신함
  const main = relatedStocks.find((s) => s.isMain) || relatedStocks[0];
  // AI 요약은 2~3문장이 한 줄로 옴 → 문장마다 한 줄 (화면의 "3줄 요약"). 줄바꿈이 있으면 그대로
  const rawSummary = String(item.summary || '').trim();
  const summaryLines = (rawSummary.includes('\n') ? rawSummary.split('\n') : rawSummary.split(/(?<=[.!?])\s+/))
    .map((line) => line.trim())
    .filter(Boolean);

  const isDisclosure = item.channel === 'DART';
  return {
    id: String(item.articleId),
    sourceType: item.sourceType === 'SNS' ? 'SNS' : 'NEWS',
    channelType: item.channel || item.sourceType,
    // 공시(DART)인가, 공시 유형 이름(자기주식 취득 …, 모르면 null), 목적·방식에 따라 해석이 갈리는 공시인가
    isDisclosure,
    disclosureType: isDisclosure ? item.disclosureType || null : null,
    contextDependent: Boolean(item.contextDependent),
    // 제목이 주가가 이미 움직인 뒤 쓴 기사인가 (특징주·급등 …). 칸이 없는 서버면 false → 표시 안 함
    priceMoveTitle: item.priceMoveTitle === true,
    press: item.press || '',
    title: item.title || '',
    publishedAt: toDisplayTime(item.publishedAt),
    publishedAtIso: item.publishedAt || null,
    daysAgo: daysAgoKst(item.publishedAt),
    url: item.url || '',
    analysisStatus: 'COMPLETED',
    summary: summaryLines.slice(0, 3),
    // AI 요약이 없는 글 (AI 활용 금지 언론사·제목만 있는 공시 등) → 화면 "AI 요약 없음 · 원문 보기"
    hasSummary: summaryLines.length > 0,
    keywords: item.keywords || [],
    // 감성이 없으면 null (AI 활용 금지 언론사 기사는 제목만 연결하고 감성을 판단하지 않음. 중립으로 채우면 '중립 판단'과 구별이 안 됨)
    sentiment: item.sentiment || main?.sentiment || null,
    relatedStocks,
    matchedStocks: relatedStocks,
    relatedSns: (item.relatedSns || []).map((s) => ({
      id: String(s.articleId),
      press: s.press || s.channel || 'SNS',
      channel: s.channel || 'SNS',
      title: s.title || '',
      publishedAt: toDisplayTime(s.publishedAt),
      time: toClock(s.publishedAt),
      sentiment: null,
      url: s.url || '',
    })),
  };
}

/** 종합 요약 응답 → 화면 요약 모양. 요약이 아직 없으면 ready: false */
export function toUiSummary(res) {
  const s = res?.sentiment;
  const ratio = toRatio(s);
  // 같은 소식 묶음을 1표로 센 비율 (2026-11-09). 칸이 없는 서버면 null → 화면에 안 보임
  const byEvent = res?.sentimentByEvent;
  const time = toClock(res?.generatedAt);
  return {
    ready: Boolean(res?.newsSummary || res?.snsSummary),
    updatedAt: time || '-',
    generatedAt: time || '-',
    headline: res?.newsSummary || '',
    summary: res?.newsSummary || '',
    newsSummary: res?.newsSummary || '',
    snsSummary: res?.snsSummary || '',
    sentimentRatio: ratio,
    sentiment: ratio,
    // 감성 비율을 센 글 수. 0이면 비율이 없으므로 화면에서 "오늘 글 없음"
    sentimentCount: s?.articleCount ?? 0,
    sentimentByEvent: byEvent ? toRatio(byEvent) : null,
    // 감성을 센 소식 수 (글 수가 아님)
    sentimentByEventCount: byEvent?.articleCount ?? 0,
  };
}

/**
 * 종목 토론 게시판 글 → 화면 댓글 모양 (화면은 댓글형, 서버는 게시판: 댓글 하나 = 게시판 글 하나, 내용은 제목 칸)
 * likedByMe 는 목록 API에 없어서 처음에는 false, 공감을 누르면 서버 답으로 바뀜
 */
export function toUiBoardComment(item, stockCode) {
  return {
    commentId: item.postId,
    id: item.postId,
    stockCode,
    author: item.authorLoginId,
    content: item.title,
    createdAt: item.createdAt,
    likes: item.likeCount,
    likedByMe: false,
  };
}

/** 언급량 응답 → 화면 그래프 점 [{ label, news, sns }]. 시간 칸이면 "09시", 날짜 칸이면 "11/02" */
export function toUiMentionSeries(res) {
  return (res?.items || []).map((pt) => ({
    label: res.unit === 'HOUR' ? `${String(pt.time).slice(11, 13)}시` : `${String(pt.time).slice(5, 7)}/${String(pt.time).slice(8, 10)}`,
    news: pt.newsCount,
    sns: pt.snsCount,
  }));
}
