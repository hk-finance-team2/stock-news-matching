// src/mocks/mockData.js

// 1. 시스템 수집·분석 상태 및 마지막 갱신 시각 (F-07, F-08, F-14, N-02)
export const INITIAL_SYSTEM_STATUS = {
  streamStatus: 'CONNECTED', // CONNECTED(정상 가동) | RECONNECTING(갱신 중) | DISCONNECTED(지연)
  analysisStatus: 'COMPLETED', // COMPLETED(분석 완료)
  collectIntervalMinutes: 5,
  lastUpdated: {
    quote: '13:10',
    newsSns: '13:10',
    summary: '13:05',
  },
};

// 2. 초기 관심종목 코드 목록 (F-15: 종목코드 6자리 문자열 보존)
export const INITIAL_WATCHLIST_CODES = [
  '005930',
  '000660',
  '003670',
  '012450',
  '005380',
  '035420',
  '373220',
];

// 3. 종목 사전(종목명·코드·시장·업종·별칭·테마) 및 시세·이슈 데이터 (F-02, F-11, F-14, F-15)
export const STOCKS_DATA = [
  {
    code: '005930',
    name: '삼성전자',
    market: 'KOSPI',
    sector: '반도체·IT',
    aliases: ['삼전', '삼ㅅ', '삼성', 'SEC'],
    themes: ['HBM3E', 'HBM4', 'AI반도체', '파운드리', '갤럭시AI'],
    price: 73200,
    changeRate: 1.67,
    todayMatchedCount: 28,
    lastMatchedAt: '13:09',
    issueRank: 1,
  },
  {
    code: '000660',
    name: 'SK하이닉스',
    market: 'KOSPI',
    sector: '반도체',
    aliases: ['하닉', '하이닉스', 'SK하닉'],
    themes: ['HBM3E', 'AI서버', '엔비디아', '고용량D램'],
    price: 198500,
    changeRate: 3.12,
    todayMatchedCount: 22,
    lastMatchedAt: '13:07',
    issueRank: 2,
  },
  {
    code: '003670',
    name: '포스코퓨처엠',
    market: 'KOSPI',
    sector: '2차전지·소재',
    aliases: ['포스코퓨처', '퓨처엠', '포스코소재'],
    themes: ['음극재', '양극재', '2차전지', '북미공급망'],
    price: 214500,
    changeRate: 2.88,
    todayMatchedCount: 16,
    lastMatchedAt: '13:04',
    issueRank: 3,
  },
  {
    code: '012450',
    name: '한화에어로스페이스',
    market: 'KOSPI',
    sector: '방위산업·항공',
    aliases: ['한화에어로', '에어로스페이스', '한화방산'],
    themes: ['방산수출', '중동이슈', '항공엔진', 'K9자주포'],
    price: 346000,
    changeRate: 4.22,
    todayMatchedCount: 14,
    lastMatchedAt: '12:58',
    issueRank: 4,
  },
  {
    code: '005380',
    name: '현대차',
    market: 'KOSPI',
    sector: '자동차',
    aliases: ['현대자동차', '현차', '현대'],
    themes: ['하이브리드', '북미수출', '전기차', '자율주행'],
    price: 241000,
    changeRate: 2.34,
    todayMatchedCount: 12,
    lastMatchedAt: '13:02',
    issueRank: 5,
  },
  {
    code: '035420',
    name: 'NAVER',
    market: 'KOSPI',
    sector: 'IT플랫폼',
    aliases: ['네이버', '네ㅇㅂ', '하이퍼클로바'],
    themes: ['생성형AI', 'AI검색', '클라우드', '커머스'],
    price: 176400,
    changeRate: -0.84,
    todayMatchedCount: 9,
    lastMatchedAt: '12:55',
    issueRank: 6,
  },
  {
    code: '373220',
    name: 'LG에너지솔루션',
    market: 'KOSPI',
    sector: '2차전지',
    aliases: ['엔솔', '엘지엔솔', 'LG엔솔'],
    themes: ['2차전지', '배터리', 'ESS전환', '전기차'],
    price: 389000,
    changeRate: -2.14,
    todayMatchedCount: 8,
    lastMatchedAt: '12:45',
    issueRank: 7,
  },
  {
    code: '035720',
    name: '카카오',
    market: 'KOSPI',
    sector: 'IT플랫폼',
    aliases: ['카카', 'ㅋ카오'],
    themes: ['플랫폼', 'AI서비스', '메신저', '콘텐츠'],
    price: 41250,
    changeRate: -1.55,
    todayMatchedCount: 7,
    lastMatchedAt: '12:40',
    issueRank: 8,
  },
  {
    code: '207940',
    name: '삼성바이오로직스',
    market: 'KOSPI',
    sector: '바이오·헬스케어',
    aliases: ['삼바', '삼성바이오'],
    themes: ['바이오', 'CDMO', '위탁생산', '의약품수주'],
    price: 965000,
    changeRate: 1.47,
    todayMatchedCount: 6,
    lastMatchedAt: '12:15',
    issueRank: 9,
  },
  {
    code: '247540',
    name: '에코프로비엠',
    market: 'KOSDAQ',
    sector: '2차전지·소재',
    aliases: ['에코비엠', '에코프로BM'],
    themes: ['양극재', '2차전지', '전고체소재'],
    price: 168400,
    changeRate: -1.17,
    todayMatchedCount: 6,
    lastMatchedAt: '12:12',
    issueRank: 10,
  },
  {
    code: '000270',
    name: '기아',
    market: 'KOSPI',
    sector: '자동차',
    aliases: ['기아차'],
    themes: ['자동차', '하이브리드SUV', '북미수출'],
    price: 102400,
    changeRate: 1.19,
    todayMatchedCount: 5,
    lastMatchedAt: '12:20',
    issueRank: 11,
  },
  {
    code: '196170',
    name: '알테오젠',
    market: 'KOSDAQ',
    sector: '바이오·신약',
    aliases: ['알테', 'ALT'],
    themes: ['제형변경', '기술수출', '바이오플랫폼'],
    price: 374500,
    changeRate: 3.45,
    todayMatchedCount: 5,
    lastMatchedAt: '12:05',
    issueRank: 12,
  },
  {
    code: '005490',
    name: 'POSCO홀딩스',
    market: 'KOSPI',
    sector: '철강·이차전지소재',
    aliases: ['포스코', '포스코홀딩스'],
    themes: ['철강', '리튬', '2차전지소재'],
    price: 356000,
    changeRate: 0.85,
    todayMatchedCount: 4,
    lastMatchedAt: '12:10',
    issueRank: 13,
  },
  {
    code: '006400',
    name: '삼성SDI',
    market: 'KOSPI',
    sector: '2차전지',
    aliases: ['삼성에스디아이', 'SDI'],
    themes: ['2차전지', '전고체배터리', '전기차'],
    price: 342000,
    changeRate: -1.15,
    todayMatchedCount: 4,
    lastMatchedAt: '11:50',
    issueRank: 14,
  },
  {
    code: '068270',
    name: '셀트리온',
    market: 'KOSPI',
    sector: '바이오',
    aliases: ['셀트'],
    themes: ['바이오시밀러', '신약', 'FDA승인'],
    price: 189200,
    changeRate: 0.53,
    todayMatchedCount: 3,
    lastMatchedAt: '11:40',
    issueRank: 15,
  },
  {
    code: '051910',
    name: 'LG화학',
    market: 'KOSPI',
    sector: '화학·첨단소재',
    aliases: ['엘지화학'],
    themes: ['석유화학', '양극재', '친환경소재'],
    price: 318000,
    changeRate: -0.62,
    todayMatchedCount: 3,
    lastMatchedAt: '11:20',
    issueRank: 16,
  },
  {
    code: '012330',
    name: '현대모비스',
    market: 'KOSPI',
    sector: '자동차부품',
    aliases: ['모비스'],
    themes: ['자동차부품', '전동화', '자율주행'],
    price: 238500,
    changeRate: 0.63,
    todayMatchedCount: 3,
    lastMatchedAt: '11:05',
    issueRank: 17,
  },
  {
    code: '105560',
    name: 'KB금융',
    market: 'KOSPI',
    sector: '금융',
    aliases: ['케이비', '국민은행'],
    themes: ['밸류업', '주주환원', '배당'],
    price: 91400,
    changeRate: 1.89,
    todayMatchedCount: 2,
    lastMatchedAt: '10:50',
    issueRank: 18,
  },
  {
    code: '055550',
    name: '신한지주',
    market: 'KOSPI',
    sector: '금융',
    aliases: ['신한', '신한은행'],
    themes: ['밸류업', '배당', '자사주 소각'],
    price: 56200,
    changeRate: 1.08,
    todayMatchedCount: 2,
    lastMatchedAt: '10:30',
    issueRank: 19,
  },
  {
    code: '066570',
    name: 'LG전자',
    market: 'KOSPI',
    sector: '가전·전장',
    aliases: ['엘지전자'],
    themes: ['AI가전', '전장부품', '데이터센터냉각'],
    price: 97800,
    changeRate: 0.41,
    todayMatchedCount: 1,
    lastMatchedAt: '10:15',
    issueRank: 20,
  },
];

// 4. 종목별 당일 AI 종합 요약 및 긍정·중립·부정 감성 비율 (F-06)
export const STOCK_SUMMARIES_DATA = {
  '005930': {
    updatedAt: '13:05',
    generatedAt: '13:05',
    headline: '차세대 HBM3E·HBM4 증설 및 북미 클라우드 CAPEX 확대로 메모리 실적 개선 기대감 집중',
    summary:
      '차세대 HBM3E·HBM4 양산 라인 증설 가속화와 북미 빅테크 클라우드 3사의 AI 데이터센터 설비투자(CAPEX) 확대 보도가 맞물리며 긍정 여론이 우세합니다. 커뮤니티에서도 외국인·기관 프로그램 순매수 유입을 반기는 반응이 많으나, 대규모 증설에 따른 감가상각비 추이를 점검하자는 의견도 일부 공존합니다.',
    newsSummary:
      '금일 삼성전자 관련 뉴스는 차세대 HBM4 패키징 라인 증설 가속화와 북미 클라우드 3사의 AI 데이터센터 설비투자(CAPEX) 확대에 따른 서버용 D램·기업용 SSD 수혜 전망이 핵심을 이루고 있습니다.',
    snsSummary:
      '블로그 및 카페 커뮤니티에서는 HBM 장비 반입 속도와 기관 프로그램 매수세 유입에 긍정적 기대감을 보이는 한편, 일부에서는 대규모 증설에 따른 감가상각비 추이를 지켜보자는 신중론도 제기되고 있습니다.',
    sentimentRatio: { positive: 68, neutral: 22, negative: 10 },
  },
  '000660': {
    updatedAt: '13:05',
    generatedAt: '13:05',
    headline: 'HBM3E 출하 호조와 글로벌 AI 인프라 투자 확대로 분기 최대 실적 전망 우세',
    summary:
      'AI 서버향 고대역폭메모리(HBM3E) 출하량 호조와 북미 빅테크 데이터센터 투자 확대 뉴스에 힘입어 직접 매칭 기사와 긍정 감성 비율(76%)이 높게 형성되었습니다. 고부가 서버용 D램 단가 상승 효과가 하반기에도 지속될 것이라는 분석이 주를 이룹니다.',
    newsSummary:
      'SK하이닉스는 AI 서버 수요 급증에 대응한 HBM3E·HBM4 양산 준비 및 글로벌 하이퍼스케일러들의 AI 인프라 투자 확대로 실적 상향 기대감이 집중되고 있습니다.',
    snsSummary:
      'SNS에서는 HBM 시장 주도권 유지와 장중 3%대 강세에 따른 외국인·기관 동반 수급 개선을 반기는 반응이 대다수를 차지하고 있습니다.',
    sentimentRatio: { positive: 76, neutral: 17, negative: 7 },
  },
  '003670': {
    updatedAt: '13:04',
    generatedAt: '13:04',
    headline: '베트남 3,570억 규모 인조흑연 음극재 공장 착공으로 탈중국 북미 공급망 수주 경쟁력 부각',
    summary:
      '베트남 북부 산업단지에 3,570억 원 규모 음극재 생산시설을 착공하며 북미 IRA 보조금 요건(FEOC 회피)을 충족하는 공급망 다변화 모멘텀이 부각되었습니다. 유럽 전기차 수요 둔화 우려 속에서도 중장기 수주 실익이 크다는 긍정 평가가 우세합니다.',
    newsSummary:
      '포스코퓨처엠이 베트남 인조흑연 음극재 공장 착공을 통해 탈중국 공급망 경쟁력을 확보하며 북미 완성차·셀 업체향 수주 확대에 나선다는 보도가 중심입니다.',
    snsSummary:
      '커뮤니티에서는 베트남 음극재 거점 확보에 따른 추가 장기공급계약 가능성을 높게 평가하는 분석글이 활발히 공유되고 있습니다.',
    sentimentRatio: { positive: 64, neutral: 22, negative: 14 },
  },
  '012450': {
    updatedAt: '12:58',
    generatedAt: '12:58',
    headline: '중동·동유럽 지정학적 긴장 재점화에 따른 K-방산 추가 수주 기대감 및 항공엔진 모멘텀 지속',
    summary:
      '중동 지정학적 불확실성 확대로 유럽·중동 국가들의 국방비 증액 기조가 부각되며 K9 자주포·천무 등 지상 방산 수출 협상 가속화 기대감이 커졌습니다. 직접 수주 공시뿐 아니라 매크로 지정학 뉴스에서도 높은 빈도로 간접 매칭되고 있습니다.',
    newsSummary:
      '글로벌 지정학적 긴장 고조에 따른 방위산업 수출 확대 전망과 루마니아·중동향 후속 수주 협상 소식이 주요 뉴스로 다뤄지고 있습니다.',
    snsSummary:
      '블로그·카페에서는 방산 수출 수주잔고 추이와 4분기 인도 물량 증가에 따른 영업이익 레버리지 효과를 긍정적으로 분석하고 있습니다.',
    sentimentRatio: { positive: 66, neutral: 24, negative: 10 },
  },
  '005380': {
    updatedAt: '13:02',
    generatedAt: '13:02',
    headline: '북미 하이브리드 SUV 판매 급증으로 10월 역대 최대 판매 실적 경신 및 4분기 호실적 기대',
    summary:
      '현대차가 북미 시장에서 투싼·싼타페 등 하이브리드 SUV 판매 호조에 힘입어 10월 역대 최대 판매량을 달성했습니다. 전기차 캐즘을 하이브리드 혼류 생산으로 극복하고 우호적 환율 효과가 더해져 4분기 실적 컨센서스 상회가 기대됩니다.',
    newsSummary:
      '현대차는 북미 시장 하이브리드 SUV 판매 급증에 힘입어 10월 역대 최대 실적을 경신했으며, 고환율 효과와 맞물려 4분기 호실적이 전망됩니다.',
    snsSummary:
      '투자자 커뮤니티에서는 전기차 수요 둔화를 하이브리드 혼류 생산으로 극복한 점과 밸류업 자사주·배당 매력에 주목하는 반응이 많습니다.',
    sentimentRatio: { positive: 72, neutral: 20, negative: 8 },
  },
  '035420': {
    updatedAt: '12:55',
    generatedAt: '12:55',
    headline: '생성형 AI 통합 검색 브리핑 개편으로 쇼핑·광고 전환율 제고 추진, AI 인프라 비용에는 관망세',
    summary:
      'NAVER가 자체 생성형 AI를 결합한 통합 검색 개편을 공개하며 플랫폼 체류시간과 커머스 거래액 확대를 추진하고 있습니다. 신규 AI 서비스의 수익화 기대감과 AI 인프라 운영 비용 부담에 대한 관망세가 균형을 이루고 있습니다.',
    newsSummary:
      'NAVER는 자체 생성형 AI를 결합한 통합 검색 개편을 통해 쇼핑 전환율과 광고 단가 상승을 추진하고 있습니다.',
    snsSummary:
      'SNS에서는 AI 검색 개편의 편의성에 기대를 걸면서도 AI 인프라 비용 증가가 단기 마진율에 미칠 영향을 관망하는 중립적 의견이 우세합니다.',
    sentimentRatio: { positive: 46, neutral: 40, negative: 14 },
  },
  '373220': {
    updatedAt: '12:45',
    generatedAt: '12:45',
    headline: '유럽 전기차 보조금 축소에 따른 재고 조정 지속, 북미·유럽 생산라인 ESS 전환으로 돌파구 모색',
    summary:
      '유럽 주요국의 전기차 보조금 축소 여파로 완성차 업체들의 배터리 재고 조정이 이어지고 있으나, LG에너지솔루션은 기존 전기차 배터리 라인 일부를 전력망용 ESS 생산으로 전환하며 가동률 방어에 나서고 있습니다.',
    newsSummary:
      '유럽 전기차 보조금 축소 여파로 배터리 재고 조정이 이어지는 가운데, LG에너지솔루션은 북미·유럽 라인의 ESS 전환으로 대응하고 있습니다.',
    snsSummary:
      '커뮤니티에서는 전방 전기차 수요 회복 시점이 내년 상반기로 늦춰질 수 있다는 우려와 북미 ESS 수주 확대를 기대하는 시각이 엇갈리고 있습니다.',
    sentimentRatio: { positive: 32, neutral: 33, negative: 35 },
  },
  default: {
    updatedAt: '13:00',
    generatedAt: '13:00',
    headline: '당일 수집된 뉴스 및 커뮤니티 게시글 기반 AI 종목 이슈·감성 종합 분석 요약',
    summary:
      '최근 5분 주기로 수집된 뉴스와 블로그·카페 게시글을 종합 분석한 결과, 업종 내 수급 변화와 실적 모멘텀을 중심으로 투자자 관심이 이어지고 있습니다.',
    newsSummary: '업종 수급 및 분기 실적 전망과 관련된 주요 언론 보도가 이어지고 있습니다.',
    snsSummary: '블로그 및 카페 커뮤니티에서 실적 추정치와 기관·외국인 수급 흐름을 점검하는 글이 공유되고 있습니다.',
    sentimentRatio: { positive: 55, neutral: 30, negative: 15 },
  },
};

// 5. 뉴스 및 SNS 통합 글 데이터 (F-01, F-03, F-04, F-05, F-07, F-09, F-10)
export const ARTICLES_DATA = [
  {
    id: 'art-101',
    sourceType: 'NEWS',
    press: '한국경제',
    title: '삼성전자·SK하이닉스, 차세대 HBM3E·HBM4 양산 라인 증설 속도…AI 서버 수요 폭증 대응',
    publishedAt: '2026-11-02 13:05',
    daysAgo: 0,
    url: 'https://n.news.naver.com/article/sample101',
    analysisStatus: 'COMPLETED',
    summary: [
      '빅테크 기업들의 AI 데이터센터 투자 확대로 차세대 HBM3E 및 HBM4 메모리 선주문 물량이 예상치를 크게 웃돌고 있습니다.',
      '삼성전자와 SK하이닉스는 내년 상반기 차세대 물량 양산을 목표로 패키징 공정 증설 및 수율 안정화에 역량을 집중하고 있습니다.',
      '증권가에서는 고부가 메모리 비중 확대에 힘입어 반도체 업종의 4분기 및 내년 영업이익 전망치를 잇따라 상향 조정했습니다.',
    ],
    keywords: ['HBM3E', 'HBM4', 'AI서버', '패키징증설', '반도체수출'],
    sentiment: 'POSITIVE',
    relatedStocks: [
      {
        code: '005930',
        name: '삼성전자',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 96,
        matchedKeywords: ['삼성전자', 'HBM4', '패키징증설'],
        reason: '본문에 삼성전자의 차세대 HBM3E·HBM4 양산 라인 증설과 빅테크 공급 협의가 핵심 주제로 직접 언급되었습니다.',
        evidence: '"삼성전자는 평택 및 천안 패키징 라인의 HBM3E·HBM4 전환 투자를 앞당기며 글로벌 AI 가속기 고객사 물량 대응에 나섰다."',
      },
      {
        code: '000660',
        name: 'SK하이닉스',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 93,
        matchedKeywords: ['SK하이닉스', 'HBM3E', 'AI서버'],
        reason: 'SK하이닉스의 HBM3E 출하 호조와 차세대 선주문 물량 확대 및 양산 목표가 직접 서술되었습니다.',
        evidence: '"SK하이닉스 역시 HBM3E 공급 확대에 이어 HBM4 샘플 공급 일정을 조율하며 고부가 메모리 시장 주도권 수성에 속도를 내고 있다."',
      },
    ],
    relatedSns: [
      {
        id: 'sns-201',
        press: '네이버 블로그 · 반도체인사이트',
        channel: '네이버 블로그',
        title: '평택·천안 패키징 장비 반입 일정 정리 및 HBM4 수혜 분석',
        publishedAt: '2026-11-02 13:09',
        time: '13:09',
        sentiment: 'POSITIVE',
        url: 'https://blog.naver.com/sample201',
      },
      {
        id: 'sns-202',
        press: '네이버 카페 · 가치투자연구소',
        channel: '네이버 카페',
        title: '삼전·하닉 HBM 뉴스 뜨고 기관 프로그램 매수세 바로 유입되네요',
        publishedAt: '2026-11-02 13:07',
        time: '13:07',
        sentiment: 'POSITIVE',
        url: 'https://cafe.naver.com/sample202',
      },
      {
        id: 'sns-204',
        press: '네이버 카페 · 주린이탈출방',
        channel: '네이버 카페',
        title: '반도체 설비투자 늘리는 건 좋은데 감가상각비 부담은 없을까요?',
        publishedAt: '2026-11-02 12:35',
        time: '12:35',
        sentiment: 'NEUTRAL',
        url: 'https://cafe.naver.com/sample204',
      },
    ],
  },
  {
    id: 'art-102',
    sourceType: 'NEWS',
    press: '매일경제',
    title: '포스코퓨처엠, 베트남 3,570억 규모 인조흑연 음극재 공장 착공…북미 공급망 대응',
    publishedAt: '2026-11-02 12:48',
    daysAgo: 0,
    url: 'https://n.news.naver.com/article/sample102',
    analysisStatus: 'COMPLETED',
    summary: [
      '포스코퓨처엠이 베트남 북부 산업단지에 3,570억 원 규모의 인조흑연 음극재 공장을 착공했습니다.',
      '탈중국 공급망 요건(FEOC)을 충족해 북미 완성차 및 배터리 셀 업체 수주 경쟁력이 크게 높아질 전망입니다.',
      '양산 개시 후 연간 3만 톤 규모의 생산 능력을 확보해 글로벌 음극재 점유율을 끌어올릴 계획입니다.',
    ],
    keywords: ['음극재', '베트남공장', 'FEOC회피', '북미공급망'],
    sentiment: 'POSITIVE',
    relatedStocks: [
      {
        code: '003670',
        name: '포스코퓨처엠',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 97,
        matchedKeywords: ['포스코퓨처엠', '음극재', '북미공급망'],
        reason: '베트남 3,570억 원 규모 인조흑연 음극재 공장 착공의 당사자로 직접 보도되었습니다.',
        evidence: '"포스코퓨처엠은 베트남 인조흑연 음극재 공장 착공을 통해 총 3,570억 원을 투자하고 북미 배터리 고객사 수주 확대에 나선다."',
      },
      {
        code: '005490',
        name: 'POSCO홀딩스',
        relationType: '간접',
        matchType: 'INDIRECT',
        relevance: 76,
        matchedKeywords: ['2차전지소재', '리튬'],
        reason: '그룹 차원의 이차전지 소재 밸류체인 수직계열화 경쟁력 강화에 따른 지주사 간접 수혜가 연결됩니다.',
        evidence: '"포스코그룹은 리튬·니켈 원료부터 양극재·음극재에 이르는 북미 친환경 배터리 소재 공급망을 완성해 가고 있다."',
      },
      {
        code: '005380',
        name: '현대차',
        relationType: '간접',
        matchType: 'INDIRECT',
        relevance: 64,
        matchedKeywords: ['전기차', '북미수출'],
        reason: '북미 IRA 보조금 요건을 충족하는 배터리 소재 공급망 확대에 따른 전방 완성차 간접 수혜가 예상됩니다.',
        evidence: '"FEOC 규제를 피한 음극재 조달이 가능해지면서 북미 현지 전기차 생산 완성차 업체들의 보조금 수혜도 확대될 전망이다."',
      },
    ],
    relatedSns: [
      {
        id: 'sns-206',
        press: '네이버 카페 · 스마트개미모임',
        channel: '네이버 카페',
        title: '포스코퓨처엠 베트남 음극재 투자 공시 정리 및 향후 수주 일정 요약',
        publishedAt: '2026-11-02 12:55',
        time: '12:55',
        sentiment: 'POSITIVE',
        url: 'https://cafe.naver.com/sample206',
      },
    ],
  },
  {
    id: 'art-103',
    sourceType: 'NEWS',
    press: '서울경제',
    title: '중동 지정학적 긴장 재점화…유럽·중동 국방비 증액에 K-방산 수출 협상 주목',
    publishedAt: '2026-11-02 12:15',
    daysAgo: 0,
    url: 'https://n.news.naver.com/article/sample103',
    analysisStatus: 'COMPLETED',
    summary: [
      '중동 지역의 지정학적 불확실성이 다시 부각되며 유럽 및 중동 국가들의 방공망·지상무기 도입 수요가 확대되고 있습니다.',
      '납기 경쟁력과 실전 배치 검증을 마친 국내 방산 기업들의 후속 수출 계약 협상이 탄력을 받을 것으로 전망됩니다.',
      '글로벌 공급망 리스크 점검과 함께 방위산업 섹터의 하반기 수주 잔고 성장이 주목받고 있습니다.',
    ],
    keywords: ['중동이슈', '방산수출', 'K9자주포', '국방비증액'],
    sentiment: 'POSITIVE',
    relatedStocks: [
      {
        code: '012450',
        name: '한화에어로스페이스',
        relationType: '간접',
        matchType: 'INDIRECT',
        relevance: 85,
        matchedKeywords: ['방산수출', '중동이슈', 'K9자주포'],
        reason: '중동 지정학적 긴장 고조 및 유럽·중동 국방비 증액에 따른 K9 자주포·천무 수출 확대 기대감으로 간접 연결되었습니다.',
        evidence: '"중동 및 동유럽 지역의 안보 수요 급증으로 K9 자주포와 천무 등 국내 주력 지상 방산 무기체계 수출 협상이 가속화될 전망이다."',
      },
    ],
    relatedSns: [
      {
        id: 'sns-207',
        press: '네이버 블로그 · 글로벌매크로노트',
        channel: '네이버 블로그',
        title: '중동 지정학 이슈 재부각에 따른 국내 방산 수출 수주잔고 체크',
        publishedAt: '2026-11-02 12:30',
        time: '12:30',
        sentiment: 'POSITIVE',
        url: 'https://blog.naver.com/sample207',
      },
    ],
  },
  {
    id: 'art-104',
    sourceType: 'NEWS',
    press: '머니투데이',
    title: '글로벌 클라우드 3사, AI 데이터센터 설비투자(CAPEX) 역대 최대 규모 발표',
    publishedAt: '2026-11-02 11:40',
    daysAgo: 0,
    url: 'https://n.news.naver.com/article/sample104',
    analysisStatus: 'COMPLETED',
    summary: [
      '북미 주요 클라우드 서비스 기업들이 올해와 내년 AI 인프라 설비투자 규모를 기존 계획 대비 25% 확대하기로 결정했습니다.',
      '고성능 GPU 및 기업용 eSSD, 고용량 서버 D램 모듈 수요가 동반 급증할 것으로 전망됩니다.',
      '이에 따라 국내 메모리 반도체 공급사들의 서버용 D램 및 낸드 가격 협상력이 한층 강화될 것으로 분석됩니다.',
    ],
    keywords: ['데이터센터', 'CAPEX', '서버D램', '기업용SSD'],
    sentiment: 'POSITIVE',
    relatedStocks: [
      {
        code: '005930',
        name: '삼성전자',
        relationType: '간접',
        matchType: 'INDIRECT',
        relevance: 84,
        matchedKeywords: ['AI반도체', '기업용SSD', '서버D램'],
        reason: '회사명이 제목에 직접 등장하지는 않으나, 글로벌 AI 데이터센터 설비투자 확대에 따른 서버용 D램·기업용 eSSD 수요 수혜가 예상됩니다.',
        evidence: '"북미 하이퍼스케일러들의 AI 서버 증설 경쟁으로 고용량 서버 D램과 기업용 eSSD 공급 부족 현상이 심화될 전망이다."',
      },
      {
        code: '000660',
        name: 'SK하이닉스',
        relationType: '간접',
        matchType: 'INDIRECT',
        relevance: 82,
        matchedKeywords: ['AI서버', '고용량D램'],
        reason: 'AI 인프라 투자 확대로 주력 제품인 서버용 D램 및 HBM 수요 증가라는 간접적 산업 수혜가 연결됩니다.',
        evidence: '"AI 데이터센터향 고성능 메모리 채택 비중이 기존 서버 대비 3배 이상 높아 메모리 제조사 실적 개선을 견인하고 있다."',
      },
    ],
    relatedSns: [
      {
        id: 'sns-203',
        press: '네이버 블로그 · 테크트렌드읽기',
        channel: '네이버 블로그',
        title: '북미 클라우드 CAPEX 25% 상향, 국산 메모리에는 확실한 호재',
        publishedAt: '2026-11-02 12:05',
        time: '12:05',
        sentiment: 'POSITIVE',
        url: 'https://blog.naver.com/sample203',
      },
    ],
  },
  {
    id: 'art-105',
    sourceType: 'NEWS',
    press: '한국경제',
    title: '현대차·기아, 북미 하이브리드 및 친환경차 판매 호조…월간 기준 역대 최대 실적 경신',
    publishedAt: '2026-11-02 10:50',
    daysAgo: 0,
    url: 'https://n.news.naver.com/article/sample105',
    analysisStatus: 'COMPLETED',
    summary: [
      '현대차와 기아가 북미 시장에서 하이브리드 SUV 라인업 판매 급증에 힘입어 10월 역대 최대 판매량을 기록했습니다.',
      '전기차 수요 둔화 우려를 하이브리드 혼류 생산 체제로 극복하며 높은 대당 수익성을 유지하고 있습니다.',
      '우호적인 환율 효과와 고부가 차종 비중 확대가 맞물려 4분기 실적 컨센서스를 상회할 것으로 기대됩니다.',
    ],
    keywords: ['현대차', '하이브리드', '북미수출', '최대실적'],
    sentiment: 'POSITIVE',
    relatedStocks: [
      {
        code: '005380',
        name: '현대차',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 96,
        matchedKeywords: ['현대차', '하이브리드', '북미수출'],
        reason: '현대차의 북미 월간 최대 판매 실적과 하이브리드 수익성 개선이 기사의 핵심 주제입니다.',
        evidence: '"현대차는 투싼·싼타페 하이브리드 판매량이 전년 동월 대비 38% 급증하며 북미 시장 점유율을 확대했다."',
      },
      {
        code: '000270',
        name: '기아',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 91,
        matchedKeywords: ['기아', '하이브리드SUV', '북미수출'],
        reason: '기아의 북미 친환경차 및 SUV 판매 호조가 현대차와 함께 직접 다뤄졌습니다.',
        evidence: '"기아 역시 스포티지·쏘렌토 하이브리드 모델을 앞세워 북미 월간 판매 신기록을 달성했다."',
      },
      {
        code: '012330',
        name: '현대모비스',
        relationType: '간접',
        matchType: 'INDIRECT',
        relevance: 76,
        matchedKeywords: ['전동화', '자동차부품'],
        reason: '완성차 북미 판매 호조 및 하이브리드 물량 확대에 따른 핵심 전동화 부품 공급 증가가 기대됩니다.',
        evidence: '"완성차 그룹의 북미 하이브리드·전동화 생산 물량 증가로 핵심 모듈 및 부품 계열사의 가동률도 동반 상승하고 있다."',
      },
    ],
    relatedSns: [
      {
        id: 'sns-205',
        press: '네이버 블로그 · 오토모티브랩',
        channel: '네이버 블로그',
        title: '현대차 북미 하이브리드 점유율 상승이 갖는 실적 방어 의미',
        publishedAt: '2026-11-02 11:15',
        time: '11:15',
        sentiment: 'POSITIVE',
        url: 'https://blog.naver.com/sample205',
      },
    ],
  },
  {
    id: 'art-106',
    sourceType: 'NEWS',
    press: '이데일리',
    title: '네이버, 자체 생성형 AI 검색 서비스 개편 공개…커머스·광고 체류시간 확대 노린다',
    publishedAt: '2026-10-31 16:20',
    daysAgo: 2,
    url: 'https://n.news.naver.com/article/sample106',
    analysisStatus: 'COMPLETED',
    summary: [
      'NAVER가 생성형 AI를 결합한 차세대 통합 검색 요약 기능을 모바일 메인을 중심으로 순차 도입합니다.',
      '사용자 맞춤형 쇼핑 추천과 로컬 비즈니스 연결을 강화해 광고 단가와 커머스 전환율을 높인다는 전략입니다.',
      '다만 AI 인프라 운영 비용 증가가 단기 마진율에 미치는 영향에 대해서는 시장의 관망세가 이어지고 있습니다.',
    ],
    keywords: ['생성형AI', 'AI검색', '커머스', '비용통제'],
    sentiment: 'NEUTRAL',
    relatedStocks: [
      {
        code: '035420',
        name: 'NAVER',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 94,
        matchedKeywords: ['네이버', '생성형AI', 'AI검색'],
        reason: '네이버의 AI 검색 서비스 개편 및 커머스·광고 수익화 전략을 직접 다루고 있습니다.',
        evidence: '"네이버는 하반기 AI 브리핑 검색 적용 범위를 확대해 플랫폼 체류시간과 쇼핑 거래액을 동시에 끌어올릴 계획이다."',
      },
      {
        code: '035720',
        name: '카카오',
        relationType: '간접',
        matchType: 'INDIRECT',
        relevance: 58,
        matchedKeywords: ['플랫폼', 'AI서비스'],
        reason: '국내 양대 플랫폼 기업의 생성형 AI 서비스 수익화 경쟁 구도가 간접 비교되었습니다.',
        evidence: '"국내 주요 플랫폼 기업들이 일제히 AI 에이전트 기능을 도입하며 초기 시장 선점 경쟁이 치열해지고 있다."',
      },
    ],
    relatedSns: [],
  },
  {
    id: 'art-107',
    sourceType: 'NEWS',
    press: '파이낸셜뉴스',
    title: '유럽 전기차 보조금 축소 여파 지속…2차전지 셀·소재 업계 ESS 라인 전환으로 돌파구',
    publishedAt: '2026-10-20 14:15',
    daysAgo: 13,
    url: 'https://n.news.naver.com/article/sample107',
    analysisStatus: 'COMPLETED',
    summary: [
      '유럽 주요국의 전기차 구매 보조금 축소 이후 완성차 업체들의 배터리 발주 속도 조절이 이어지고 있습니다.',
      'LG에너지솔루션 등 국내 배터리 셀 및 양극재 기업들은 북미·유럽 전력망용 ESS(에너지저장장치) 라인 전환으로 돌파구를 모색 중입니다.',
      '본격적인 전기차용 배터리 출하량 반등 시점은 신차 출시가 집중되는 내년 상반기 이후가 될 것이라는 전망이 우세합니다.',
    ],
    keywords: ['2차전지', '전기차보조금', '재고조정', 'ESS전환'],
    sentiment: 'NEGATIVE',
    relatedStocks: [
      {
        code: '373220',
        name: 'LG에너지솔루션',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 92,
        matchedKeywords: ['LG에너지솔루션', '배터리', 'ESS전환'],
        reason: '유럽 전기차 수요 둔화에 따른 LG에너지솔루션의 가동률 영향 및 ESS 전환 대응이 직접 언급되었습니다.',
        evidence: '"LG에너지솔루션은 전기차용 배터리 재고 조정에 대응해 북미·유럽 라인 일부를 전력망용 ESS 생산으로 전환하고 있다."',
      },
      {
        code: '247540',
        name: '에코프로비엠',
        relationType: '간접',
        matchType: 'INDIRECT',
        relevance: 72,
        matchedKeywords: ['양극재', '2차전지'],
        reason: '전방 셀 업체들의 재고 조정에 따른 양극재 출하량 둔화 우려가 간접적으로 연결됩니다.',
        evidence: '"셀 메이커들의 보수적인 재고 운영 기조가 이어지면서 양극재 등 핵심 소재 업계의 단기 가동률 부담도 커지고 있다."',
      },
    ],
    relatedSns: [],
  },

  // --- SNS 게시글 (블로그 / 카페: sourceType = 'SNS', F-05에 따라 참고용 표시 및 관련도 산정) ---
  {
    id: 'sns-201',
    sourceType: 'SNS',
    channelType: 'BLOG',
    press: '네이버 블로그 · 반도체인사이트',
    title: '평택·천안 패키징 장비 반입 일정 정리 및 HBM4 수혜 분석',
    publishedAt: '2026-11-02 13:09',
    daysAgo: 0,
    url: 'https://blog.naver.com/sample201',
    analysisStatus: 'COMPLETED',
    summary: [
      '오늘 자 HBM3E·HBM4 증설 기사와 관련해 실제 후공정 장비 발주 타임라인을 정리한 개인 분석글입니다.',
      '삼성전자와 SK하이닉스 모두 내년 1분기 전에 차세대 테스트 물량 검증을 마칠 것으로 예상된다는 의견입니다.',
      '외국인 수급이 반도체 대형주로 다시 유입되는 흐름을 긍정적으로 평가하고 있습니다.',
    ],
    keywords: ['HBM4', '후공정장비', '외국인수급'],
    sentiment: 'POSITIVE',
    relatedStocks: [
      {
        code: '005930',
        name: '삼성전자',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 84,
        matchedKeywords: ['삼성전자', 'HBM4'],
        reason: '삼성전자 HBM4 증설 뉴스 직후 작성된 후공정 일정 및 수급 분석 블로그 게시글입니다.',
        evidence: '"삼전 평택·천안 HBM4 패키징 라인 증설 기사 나왔는데 이번엔 실제 장비 반입 속도가 꽤 빠르다는 이야기가 돈다."',
      },
      {
        code: '000660',
        name: 'SK하이닉스',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 81,
        matchedKeywords: ['SK하이닉스', 'HBM3E'],
        reason: 'SK하이닉스 HBM 선주문 물량과 관련한 투자자 반응을 담고 있습니다.',
        evidence: '"하닉은 이미 빅테크 물량 꽉 차 있어서 내년에도 단가 협상에서 계속 우위를 가져갈 듯."',
      },
    ],
    relatedSns: [],
  },
  {
    id: 'sns-202',
    sourceType: 'SNS',
    channelType: 'CAFE',
    press: '네이버 카페 · 가치투자연구소',
    title: '삼전·하닉 HBM 뉴스 뜨고 기관 프로그램 매수세 바로 유입되네요',
    publishedAt: '2026-11-02 13:07',
    daysAgo: 0,
    url: 'https://cafe.naver.com/sample202',
    analysisStatus: 'COMPLETED',
    summary: [
      '오후 1시 HBM 증설 보도 직후 삼성전자와 SK하이닉스에 프로그램 순매수가 강하게 유입되고 있다는 게시글입니다.',
      '단기 박스권 돌파 여부는 장 마감 외국인 수급 지속성에 달려 있다는 댓글 반응이 이어지고 있습니다.',
    ],
    keywords: ['프로그램매수', '삼전', '박스권돌파'],
    sentiment: 'POSITIVE',
    relatedStocks: [
      {
        code: '005930',
        name: '삼성전자',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 79,
        matchedKeywords: ['삼전', 'HBM3E'],
        reason: '삼성전자 HBM 뉴스 보도 직후의 수급 반응을 공유한 카페 게시글입니다.',
        evidence: '"1시 5분 한경 HBM 증설 기사 뜨자마자 삼전 프로그램 매수세 바로 플러스로 전환됐네요."',
      },
      {
        code: '000660',
        name: 'SK하이닉스',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 76,
        matchedKeywords: ['하닉', 'HBM3E'],
        reason: 'SK하이닉스 동반 강세 흐름을 언급한 커뮤니티 반응입니다.',
        evidence: '"하닉도 장중 +3% 넘기면서 반도체 투톱이 코스피 지수를 끌어올리는 중입니다."',
      },
    ],
    relatedSns: [],
  },
  {
    id: 'sns-206',
    sourceType: 'SNS',
    channelType: 'CAFE',
    press: '네이버 카페 · 스마트개미모임',
    title: '포스코퓨처엠 베트남 음극재 투자 공시 정리 및 향후 수주 일정 요약',
    publishedAt: '2026-11-02 12:55',
    daysAgo: 0,
    url: 'https://cafe.naver.com/sample206',
    analysisStatus: 'COMPLETED',
    summary: [
      '오늘 나온 베트남 인조흑연 음극재 공장 착공 소식과 기존 양극재 수주 잔고를 비교 정리한 게시글입니다.',
      '단기 설비투자비 부담보다 북미 FEOC 회피에 따른 중장기 수주 실익이 훨씬 크다는 평가입니다.',
    ],
    keywords: ['포스코퓨처엠', '음극재공시', '북미공급망'],
    sentiment: 'POSITIVE',
    relatedStocks: [
      {
        code: '003670',
        name: '포스코퓨처엠',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 86,
        matchedKeywords: ['포스코퓨처엠', '음극재'],
        reason: '음극재 투자 공시 및 북미 수주 일정 분석의 중심 종목입니다.',
        evidence: '"포스코퓨처엠이 베트남 음극재 거점을 확보하면서 북미 배터리 셀 업체들과의 추가 장기계약 가능성이 한층 높아졌다."',
      },
    ],
    relatedSns: [],
  },
  {
    id: 'sns-204',
    sourceType: 'SNS',
    channelType: 'CAFE',
    press: '네이버 카페 · 주린이탈출방',
    title: '반도체 설비투자 늘리는 건 좋은데 감가상각비 부담은 없을까요?',
    publishedAt: '2026-11-02 12:35',
    daysAgo: 0,
    url: 'https://cafe.naver.com/sample204',
    analysisStatus: 'COMPLETED',
    summary: [
      '대규모 라인 증설이 향후 고정비(감가상각비) 증가로 이어질 수 있다는 신중론 게시글입니다.',
      '실제 출하 가격(ASP)이 유지되는지 분기별로 확인해야 한다는 의견입니다.',
    ],
    keywords: ['감가상각비', '설비투자', '신중론'],
    sentiment: 'NEUTRAL',
    relatedStocks: [
      {
        code: '005930',
        name: '삼성전자',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 71,
        matchedKeywords: ['삼전', 'AI반도체'],
        reason: '증설 투자에 따른 비용 측면을 점검하는 투자자 의견입니다.',
        evidence: '"증설 속도가 빨라지는 만큼 내년도 감가상각비 증가 폭을 뛰어넘는 ASP 상승이 나와주는지가 핵심일 듯합니다."',
      },
    ],
    relatedSns: [],
  },
  {
    id: 'sns-207',
    sourceType: 'SNS',
    channelType: 'BLOG',
    press: '네이버 블로그 · 글로벌매크로노트',
    title: '중동 지정학 이슈 재부각에 따른 국내 방산 수출 수주잔고 체크',
    publishedAt: '2026-11-02 12:30',
    daysAgo: 0,
    url: 'https://blog.naver.com/sample207',
    analysisStatus: 'COMPLETED',
    summary: [
      '중동 지정학적 긴장 뉴스 직후 국내 주요 방산 기업의 수주잔고와 4분기 인도 일정을 점검한 블로그 글입니다.',
      '한화에어로스페이스의 지상 방산 수출 비중 확대가 밸류에이션 리레이팅으로 이어지고 있다는 분석입니다.',
    ],
    keywords: ['한화에어로', '방산수출', '수주잔고'],
    sentiment: 'POSITIVE',
    relatedStocks: [
      {
        code: '012450',
        name: '한화에어로스페이스',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 83,
        matchedKeywords: ['한화에어로', '방산수출'],
        reason: '방산 수출 수주잔고 및 4분기 실적 분석의 핵심 종목으로 다뤄졌습니다.',
        evidence: '"한화에어로스페이스는 폴란드·루마니아에 이어 중동향 방공·지상무기 수출 모멘텀까지 겹치며 실적 가시성이 매우 높다."',
      },
    ],
    relatedSns: [],
  },
  {
    id: 'sns-203',
    sourceType: 'SNS',
    channelType: 'BLOG',
    press: '네이버 블로그 · 테크트렌드읽기',
    title: '북미 클라우드 CAPEX 25% 상향, 국산 메모리에는 확실한 호재',
    publishedAt: '2026-11-02 12:05',
    daysAgo: 0,
    url: 'https://blog.naver.com/sample203',
    analysisStatus: 'COMPLETED',
    summary: [
      '빅테크의 AI 설비투자 확대 발표로 AI 거품론이 완화되었다는 블로그 리뷰입니다.',
      '일반 서버 D램과 기업용 SSD 수요까지 온기가 퍼지면서 삼성전자 실적 레버리지가 커질 것으로 전망합니다.',
    ],
    keywords: ['클라우드CAPEX', 'eSSD', 'AI거품론완화'],
    sentiment: 'POSITIVE',
    relatedStocks: [
      {
        code: '005930',
        name: '삼성전자',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 77,
        matchedKeywords: ['삼성전자', '서버D램'],
        reason: '클라우드 CAPEX 확대 뉴스와 연결해 삼성전자 eSSD·D램 수혜를 분석한 글입니다.',
        evidence: '"클라우드 3사 설비투자 상향은 결국 고용량 eSSD 점유율 1위인 삼성전자에 가장 큰 낙수효과로 이어진다."',
      },
    ],
    relatedSns: [],
  },
  {
    id: 'sns-205',
    sourceType: 'SNS',
    channelType: 'BLOG',
    press: '네이버 블로그 · 오토모티브랩',
    title: '현대차 북미 하이브리드 점유율 상승이 갖는 실적 방어 의미',
    publishedAt: '2026-11-02 11:15',
    daysAgo: 0,
    url: 'https://blog.naver.com/sample205',
    analysisStatus: 'COMPLETED',
    summary: [
      '북미 시장에서 하이브리드 차량이 전기차 캐즘을 완벽히 메우고 있다는 분석글입니다.',
      '고환율 기조 유지 시 현대차의 4분기 영업이익이 시장 기대치를 상회할 것으로 보고 있습니다.',
    ],
    keywords: ['하이브리드', '고환율수혜', '북미판매'],
    sentiment: 'POSITIVE',
    relatedStocks: [
      {
        code: '005380',
        name: '현대차',
        relationType: '직접',
        matchType: 'DIRECT',
        relevance: 81,
        matchedKeywords: ['현대차', '하이브리드'],
        reason: '현대차 북미 판매 호조 기사와 시각이 가까운 블로그 분석글입니다.',
        evidence: '"전기차 보조금 변수에도 하이브리드 SUV 라인업이 워낙 탄탄해서 현대차 실적 방어력이 돋보인다."',
      },
    ],
    relatedSns: [],
  },
];

// 6. 뉴스·SNS 언급량 추이 데이터 (F-13: 오늘 1시간 단위 / 7일·30일 1일 단위)
export const MENTION_TRENDS_DATA = {
  '005930': {
    today: [
      { label: '09시', news: 2, sns: 4 },
      { label: '10시', news: 3, sns: 6 },
      { label: '11시', news: 4, sns: 8 },
      { label: '12시', news: 3, sns: 7 },
      { label: '13시', news: 8, sns: 14 },
      { label: '14시', news: 5, sns: 9 },
      { label: '15시', news: 3, sns: 6 },
    ],
    '7d': [
      { label: '10/27', news: 14, sns: 28 },
      { label: '10/28', news: 16, sns: 31 },
      { label: '10/29', news: 12, sns: 24 },
      { label: '10/30', news: 21, sns: 42 },
      { label: '10/31', news: 19, sns: 36 },
      { label: '11/01', news: 15, sns: 29 },
      { label: '11/02', news: 28, sns: 54 },
    ],
    '30d': [
      { label: '10/05', news: 42, sns: 88 },
      { label: '10/10', news: 51, sns: 104 },
      { label: '10/15', news: 48, sns: 96 },
      { label: '10/20', news: 63, sns: 128 },
      { label: '10/25', news: 58, sns: 119 },
      { label: '11/02', news: 76, sns: 152 },
    ],
  },
  '000660': {
    today: [
      { label: '09시', news: 2, sns: 3 },
      { label: '10시', news: 4, sns: 6 },
      { label: '11시', news: 5, sns: 8 },
      { label: '12시', news: 3, sns: 5 },
      { label: '13시', news: 6, sns: 11 },
      { label: '14시', news: 4, sns: 7 },
      { label: '15시', news: 3, sns: 5 },
    ],
    '7d': [
      { label: '10/27', news: 11, sns: 19 },
      { label: '10/28', news: 14, sns: 23 },
      { label: '10/29', news: 18, sns: 29 },
      { label: '10/30', news: 15, sns: 25 },
      { label: '10/31', news: 20, sns: 33 },
      { label: '11/01', news: 12, sns: 18 },
      { label: '11/02', news: 22, sns: 38 },
    ],
    '30d': [
      { label: '10/05', news: 34, sns: 62 },
      { label: '10/10', news: 41, sns: 78 },
      { label: '10/15', news: 39, sns: 74 },
      { label: '10/20', news: 52, sns: 95 },
      { label: '10/25', news: 49, sns: 91 },
      { label: '11/02', news: 64, sns: 118 },
    ],
  },
  '003670': {
    today: [
      { label: '09시', news: 1, sns: 2 },
      { label: '10시', news: 2, sns: 4 },
      { label: '11시', news: 3, sns: 5 },
      { label: '12시', news: 5, sns: 9 },
      { label: '13시', news: 3, sns: 6 },
      { label: '14시', news: 2, sns: 4 },
    ],
    '7d': [
      { label: '10/27', news: 6, sns: 11 },
      { label: '10/28', news: 8, sns: 14 },
      { label: '10/29', news: 9, sns: 16 },
      { label: '10/30', news: 11, sns: 19 },
      { label: '10/31', news: 9, sns: 15 },
      { label: '11/01', news: 7, sns: 12 },
      { label: '11/02', news: 16, sns: 28 },
    ],
    '30d': [
      { label: '10/05', news: 22, sns: 40 },
      { label: '10/10', news: 27, sns: 49 },
      { label: '10/15', news: 31, sns: 58 },
      { label: '10/20', news: 29, sns: 53 },
      { label: '10/25', news: 35, sns: 64 },
      { label: '11/02', news: 44, sns: 82 },
    ],
  },
  '012450': {
    today: [
      { label: '09시', news: 1, sns: 2 },
      { label: '10시', news: 2, sns: 3 },
      { label: '11시', news: 2, sns: 4 },
      { label: '12시', news: 5, sns: 8 },
      { label: '13시', news: 3, sns: 5 },
      { label: '14시', news: 2, sns: 3 },
    ],
    '7d': [
      { label: '10/27', news: 7, sns: 10 },
      { label: '10/28', news: 8, sns: 13 },
      { label: '10/29', news: 10, sns: 15 },
      { label: '10/30', news: 12, sns: 18 },
      { label: '10/31', news: 9, sns: 14 },
      { label: '11/01', news: 6, sns: 9 },
      { label: '11/02', news: 14, sns: 22 },
    ],
    '30d': [
      { label: '10/05', news: 19, sns: 32 },
      { label: '10/10', news: 24, sns: 41 },
      { label: '10/15', news: 28, sns: 47 },
      { label: '10/20', news: 32, sns: 54 },
      { label: '10/25', news: 30, sns: 51 },
      { label: '11/02', news: 39, sns: 66 },
    ],
  },
  default: {
    today: [
      { label: '09시', news: 1, sns: 2 },
      { label: '10시', news: 2, sns: 3 },
      { label: '11시', news: 3, sns: 5 },
      { label: '12시', news: 2, sns: 4 },
      { label: '13시', news: 4, sns: 7 },
      { label: '14시', news: 2, sns: 4 },
    ],
    '7d': [
      { label: '10/27', news: 5, sns: 11 },
      { label: '10/28', news: 6, sns: 13 },
      { label: '10/29', news: 4, sns: 9 },
      { label: '10/30', news: 8, sns: 17 },
      { label: '10/31', news: 7, sns: 15 },
      { label: '11/01', news: 5, sns: 10 },
      { label: '11/02', news: 9, sns: 20 },
    ],
    '30d': [
      { label: '10/05', news: 16, sns: 34 },
      { label: '10/10', news: 21, sns: 44 },
      { label: '10/15', news: 19, sns: 39 },
      { label: '10/20', news: 25, sns: 52 },
      { label: '10/25', news: 22, sns: 47 },
      { label: '11/02', news: 29, sns: 61 },
    ],
  },
};

// 7. 종목 상세 화면 하단 '실시간 종목토론' 댓글 초기 데이터 (F-17)
// content 앞의 [뉴스]/[SNS]/[언급량] 말머리는 작성한 탭을 뜻합니다 (단일 문자열 백엔드 호환).
export const INITIAL_STOCK_COMMENTS = {
  '005930': [
    {
      commentId: 101,
      stockCode: '005930',
      author: '반도체장투',
      content: '[뉴스] HBM4 패키징 라인 증설 기사 원문 문장까지 바로 확인되니 판단하기 훨씬 편하네요.',
      createdAt: '2026-11-02T13:06:00+09:00',
      likes: 8,
      likedByMe: false,
    },
    {
      commentId: 102,
      stockCode: '005930',
      author: '가치투자자',
      content: '[SNS] 동감합니다. 커뮤니티 반응 봐도 외국인·기관 프로그램 수급이 동시에 돌아서는 중이네요.',
      createdAt: '2026-11-02T13:08:00+09:00',
      likes: 5,
      likedByMe: false,
    },
    {
      commentId: 103,
      stockCode: '005930',
      author: '차트분석가',
      content: '[언급량] 13시에 뉴스랑 SNS 언급량이 동시에 피크 찍은 게 장중 수급 유입 시점이랑 정확히 일치합니다.',
      createdAt: '2026-11-02T13:10:00+09:00',
      likes: 11,
      likedByMe: true,
    },
  ],
  '000660': [
    {
      commentId: 201,
      stockCode: '000660',
      author: '메모리러버',
      content: '[뉴스] 북미 데이터센터 CAPEX 상향 뉴스 나올 때마다 관련도 80~90% 이상으로 바로 매칭되네요.',
      createdAt: '2026-11-02T13:02:00+09:00',
      likes: 6,
      likedByMe: false,
    },
  ],
  '003670': [
    {
      commentId: 301,
      stockCode: '003670',
      author: '배터리랩',
      content: '[뉴스] 베트남 3,570억 음극재 공장 착공으로 북미 FEOC 규제 회피 수혜가 본격화될 듯합니다.',
      createdAt: '2026-11-02T12:56:00+09:00',
      likes: 4,
      likedByMe: false,
    },
  ],
  '012450': [
    {
      commentId: 401,
      stockCode: '012450',
      author: '매크로트레이더',
      content: '[뉴스] 중동 지정학 뉴스에서 K-방산 간접 매칭 근거까지 깔끔하게 잡아주네요.',
      createdAt: '2026-11-02T12:40:00+09:00',
      likes: 3,
      likedByMe: false,
    },
  ],
  '005380': [
    {
      commentId: 501,
      stockCode: '005380',
      author: '오토매니아',
      content: '[SNS] 북미 하이브리드 SUV 판매가 생각보다 훨씬 강하네요. 4분기 실적 기대됩니다.',
      createdAt: '2026-11-02T11:20:00+09:00',
      likes: 5,
      likedByMe: false,
    },
  ],
};

// 8. 보류된 독립 종목토론 게시판 초기 데이터 (하위 호환용 보존)
export const INITIAL_BOARD_POSTS = {
  '005930': [
    {
      id: 'post-1',
      author: '반도체장투',
      title: 'HBM4 패키징 라인 증설 기사 보면 내년 상반기 기대되네요',
      content: '클라우드 3사 CAPEX 상향이랑 맞물려서 서버 D램이랑 HBM 둘 다 물량 계속 늘어날 듯합니다.',
      createdAt: '13:06',
      likes: 12,
      likedByMe: false,
      comments: [],
    },
  ],
};

// ============================================================================
// 양방향 데이터 정규화 헬퍼 함수 (백엔드 API 응답 ↔ 로컬 목업 완벽 호환)
// ============================================================================

export function normalizeSentimentLabel(raw) {
  const val = String(raw || '').toUpperCase().trim();
  if (val === 'POSITIVE' || val === '긍정' || val === 'POS') return 'POSITIVE';
  if (val === 'NEGATIVE' || val === '부정' || val === 'NEG') return 'NEGATIVE';
  return 'NEUTRAL';
}

export function normalizeSentimentRatio(raw) {
  const pos = Number(raw?.positive ?? 60);
  const neu = Number(raw?.neutral ?? 25);
  const neg = Number(raw?.negative ?? Math.max(0, 100 - pos - neu));
  const sum = pos + neu + neg;
  if (sum <= 0) return { positive: 60, neutral: 25, negative: 15 };
  if (sum === 100) return { positive: pos, neutral: neu, negative: neg };
  const normPos = Math.round((pos / sum) * 100);
  const normNeu = Math.round((neu / sum) * 100);
  return {
    positive: normPos,
    neutral: normNeu,
    negative: Math.max(0, 100 - normPos - normNeu),
  };
}

export function normalizeRelatedStock(raw) {
  if (!raw) return null;
  const isDirect =
    raw.relationType === '직접' ||
    String(raw.matchType || '').toUpperCase() === 'DIRECT' ||
    String(raw.relationType || '').toUpperCase() === 'DIRECT';
  return {
    code: String(raw.code || raw.stockCode || '005930').padStart(6, '0'),
    name: raw.name || raw.stockName || '종목',
    relationType: isDirect ? '직접' : '간접',
    matchType: isDirect ? 'DIRECT' : 'INDIRECT',
    relevance: Math.min(100, Math.max(0, Number(raw.relevance ?? raw.score ?? 75))),
    matchedKeywords: Array.isArray(raw.matchedKeywords) ? raw.matchedKeywords : [],
    reason: raw.reason || '본문 핵심 키워드 및 산업 맥락 분석을 통해 연결되었습니다.',
    evidence: raw.evidence || raw.quote || '"관련 근거 문장이 본문에서 추출되었습니다."',
  };
}

export function normalizeArticle(raw, idx = 0) {
  if (!raw) return null;
  const rawSource = String(raw.sourceType || 'NEWS').toUpperCase();
  const isNews = rawSource === 'NEWS';
  const rawStocks = Array.isArray(raw.relatedStocks)
    ? raw.relatedStocks
    : Array.isArray(raw.matchedStocks)
      ? raw.matchedStocks
      : [];
  const relatedStocks = rawStocks
    .map(normalizeRelatedStock)
    .filter(Boolean)
    .sort((a, b) => b.relevance - a.relevance);

  const publishedAt = raw.publishedAt || '2026-11-02 13:00';
  let daysAgo = Number(raw.daysAgo ?? 0);
  if (Number.isNaN(daysAgo)) {
    daysAgo = raw.periodTag === '30d' ? 14 : raw.periodTag === '7d' ? 3 : 0;
  }

  return {
    id: String(raw.id || raw.articleId || `art-${idx + 1}`),
    sourceType: isNews ? 'NEWS' : 'SNS',
    channelType: raw.channelType || (isNews ? 'NEWS' : rawSource),
    press: raw.press || raw.source || (isNews ? '경제뉴스' : '커뮤니티'),
    title: raw.title || '제목 없음',
    publishedAt,
    daysAgo,
    url: raw.url || 'https://news.naver.com',
    analysisStatus: raw.analysisStatus || raw.status || 'COMPLETED',
    summary: Array.isArray(raw.summary)
      ? raw.summary.slice(0, 3)
      : typeof raw.summary === 'string'
        ? [raw.summary]
        : [],
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
    sentiment: normalizeSentimentLabel(raw.sentiment),
    relatedStocks,
    matchedStocks: relatedStocks,
    relatedSns: Array.isArray(raw.relatedSns)
      ? raw.relatedSns.slice(0, 5).map((s, sIdx) => ({
          id: String(s.id || `rs-${sIdx}`),
          press: s.press || s.channel || 'SNS',
          channel: s.channel || s.press || 'SNS',
          title: s.title || '',
          publishedAt: s.publishedAt || s.time || '',
          time: (s.time || s.publishedAt || '').slice(-5),
          sentiment: normalizeSentimentLabel(s.sentiment),
          url: s.url || 'https://section.blog.naver.com',
        }))
      : [],
  };
}

export function normalizeArticles(rawInput) {
  const list = Array.isArray(rawInput)
    ? rawInput
    : rawInput?.ARTICLES_DATA || rawInput?.articles || ARTICLES_DATA;
  return (Array.isArray(list) ? list : ARTICLES_DATA).map(normalizeArticle).filter(Boolean);
}

export function normalizeSummaries(rawInput = STOCK_SUMMARIES_DATA) {
  const source = rawInput?.STOCK_SUMMARIES_DATA || rawInput || STOCK_SUMMARIES_DATA;
  const result = {};
  Object.keys(source).forEach((code) => {
    const item = source[code] || {};
    const ratio = normalizeSentimentRatio(item.sentimentRatio || item.sentiment);
    const time = item.updatedAt || item.generatedAt || '13:05';
    result[code] = {
      updatedAt: time,
      generatedAt: time,
      headline: item.headline || item.summary || item.newsSummary || '',
      summary: item.summary || item.newsSummary || item.headline || '',
      newsSummary: item.newsSummary || item.summary || '',
      snsSummary: item.snsSummary || '커뮤니티 내 종목 수급 및 실적 관련 의견이 공유되고 있습니다.',
      sentimentRatio: ratio,
      sentiment: ratio,
    };
  });
  return result;
}

export function normalizeMentionTrends(rawInput = MENTION_TRENDS_DATA) {
  const source = rawInput?.MENTION_TRENDS_DATA || rawInput || MENTION_TRENDS_DATA;
  const result = {};
  Object.keys(source).forEach((code) => {
    const item = source[code] || {};
    const today = Array.isArray(item.today) ? item.today : MENTION_TRENDS_DATA.default.today;
    const d7 = Array.isArray(item['7d'])
      ? item['7d']
      : Array.isArray(item.days7)
        ? item.days7
        : MENTION_TRENDS_DATA.default['7d'];
    const d30 = Array.isArray(item['30d'])
      ? item['30d']
      : Array.isArray(item.days30)
        ? item.days30
        : MENTION_TRENDS_DATA.default['30d'];
    result[code] = {
      today,
      '7d': d7,
      days7: d7,
      '30d': d30,
      days30: d30,
    };
  });
  return result;
}

export function normalizeStocks(
  rawInput = STOCKS_DATA,
  summariesMap = STOCK_SUMMARIES_DATA,
  trendsMap = MENTION_TRENDS_DATA
) {
  const list = Array.isArray(rawInput)
    ? rawInput
    : rawInput?.STOCKS_DATA || rawInput?.stocks || STOCKS_DATA;
  const normSummaries = normalizeSummaries(summariesMap);
  const normTrends = normalizeMentionTrends(trendsMap);

  return (Array.isArray(list) ? list : STOCKS_DATA).map((item, idx) => {
    const code = String(item.code || item.stockCode || '005930').padStart(6, '0');
    const sumEntry = normSummaries[code] || normSummaries.default;
    const trendEntry = normTrends[code] || normTrends.default;
    const ratio = normalizeSentimentRatio(
      item.sentimentRatio || item.sentiment || sumEntry?.sentimentRatio
    );
    const matchedCount = Number(
      item.todayMatchedCount ?? item.todayArticleCount ?? item.articleCount ?? 0
    );
    const rawPrice = item.price ?? item.currentPrice ?? null;
    const rawRate = item.changeRate ?? item.fluctuationRate ?? null;

    return {
      code,
      name: item.name || item.stockName || '종목',
      market: item.market || 'KOSPI',
      sector: item.sector || '기타',
      aliases: Array.isArray(item.aliases) ? item.aliases : [],
      themes: Array.isArray(item.themes) ? item.themes : [],
      price: rawPrice !== null && rawPrice !== undefined ? Number(rawPrice) : null,
      changeRate: rawRate !== null && rawRate !== undefined ? Number(rawRate) : null,
      todayMatchedCount: matchedCount,
      todayArticleCount: matchedCount,
      lastMatchedAt: item.lastMatchedAt || item.generatedAt || item.updatedAt || '13:00',
      issueRank: Number(item.issueRank ?? idx + 1),
      sentimentRatio: ratio,
      sentiment: ratio,
      generatedAt: item.generatedAt || item.updatedAt || sumEntry?.updatedAt || '13:05',
      updatedAt: item.updatedAt || item.generatedAt || sumEntry?.updatedAt || '13:05',
      headline: item.headline || sumEntry?.headline || '',
      summary: item.summary || sumEntry?.summary || '',
      newsSummary: item.newsSummary || sumEntry?.newsSummary || '',
      snsSummary: item.snsSummary || sumEntry?.snsSummary || '',
      mentions: trendEntry,
    };
  });
}

export function normalizeComments(rawInput = INITIAL_STOCK_COMMENTS) {
  const source = rawInput?.INITIAL_STOCK_COMMENTS || rawInput || INITIAL_STOCK_COMMENTS;
  const map = {};

  const normalizeOne = (c, idx) => {
    const code = String(c.stockCode || '005930').padStart(6, '0');
    const rawContent = String(c.content || '').trim();
    const hasPrefix = /^\[(뉴스|SNS|언급량)\]/.test(rawContent);
    let prefix = '';
    if (!hasPrefix && c.tabBadge) {
      if (String(c.tabBadge).includes('SNS')) prefix = '[SNS] ';
      else if (String(c.tabBadge).includes('언급')) prefix = '[언급량] ';
      else prefix = '[뉴스] ';
    }
    return {
      commentId: c.commentId ?? c.id ?? `c-${idx + 1}`,
      id: c.id ?? c.commentId ?? `c-${idx + 1}`,
      stockCode: code,
      author: c.author || '익명',
      content: `${prefix}${rawContent}`,
      createdAt: c.createdAt || '2026-11-02T13:00:00+09:00',
      likes: Number(c.likes ?? 0),
      likedByMe: Boolean(c.likedByMe),
    };
  };

  if (Array.isArray(source)) {
    source.forEach((c, idx) => {
      const item = normalizeOne(c, idx);
      if (!map[item.stockCode]) map[item.stockCode] = [];
      map[item.stockCode].push(item);
    });
    return map;
  }

  Object.keys(source).forEach((code) => {
    const arr = Array.isArray(source[code]) ? source[code] : [];
    map[code] = arr.map((c, idx) => normalizeOne({ ...c, stockCode: code }, idx));
  });
  return map;
}
