-- 화면 개발용 예시 기사 (진짜 기사 아님)
-- .env 에 FLYWAY_LOCATIONS 를 켠 PC에서만 실행됨 (docs/setup.md 2절). 발표용 PC에서는 켜지 않음
-- 반복 지시서(R__): 이 파일 내용이 바뀌면 다시 실행됨. 실행할 때마다 예시 기사를 지우고 다시 넣음
-- 구분: 제목 앞 [예시], 주소 sample://
-- 지우고 싶으면: DELETE FROM article WHERE url_key LIKE 'sample://%';  (종목 연결도 함께 지워짐)
--             DELETE FROM stock_daily_summary WHERE news_summary LIKE '[예시]%';

DELETE FROM article WHERE url_key LIKE 'sample://%';

INSERT INTO article (url_key, url, press, title, description, published_at, status, summary, model, summarized_at,
                     source_type, channel, keywords, sentiment) VALUES
    ('sample://article/1', 'sample://article/1', '예시일보', '[예시] 중동 긴장 고조에 국제유가 급등',
     '중동 지역 긴장이 높아지며 국제유가가 큰 폭으로 올랐다.', NOW() - INTERVAL 1 HOUR, 'DONE',
     '중동 지역 긴장으로 국제유가가 5% 급등했다. 정유주는 마진 개선 기대가, 항공주는 연료비 부담이 커졌다. 방산주에도 관심이 몰렸다.',
     'sample', NOW(), 'NEWS', 'RSS', '유가,중동,정유,항공', 'NEUTRAL'),
    ('sample://article/2', 'sample://article/2', '샘플경제', '[예시] 삼성전자, 고대역폭 메모리 공급 확대 계약',
     '삼성전자가 대형 고객사와 고대역폭 메모리 공급 계약을 맺었다.', NOW() - INTERVAL 2 HOUR, 'DONE',
     '삼성전자가 고대역폭 메모리 공급을 늘리는 계약을 맺었다. 하반기 반도체 실적 개선 기대가 커졌다. 경쟁사 주가도 함께 움직였다.',
     'sample', NOW(), 'NEWS', 'RSS', 'HBM,반도체,공급계약', 'POSITIVE'),
    ('sample://article/3', 'sample://article/3', '예시일보', '[예시] 방산 수출 계약 잇따라',
     '국내 방산 기업들의 해외 수출 계약이 이어지고 있다.', NOW() - INTERVAL 3 HOUR, 'DONE',
     '국내 방산 기업들이 연이어 해외 수출 계약을 따냈다. 수주 잔고가 늘며 실적 기대가 높아졌다. 부품 기업도 수혜가 예상된다.',
     'sample', NOW(), 'NEWS', 'RSS', '방산,수출,수주', 'POSITIVE'),
    ('sample://article/4', 'sample://article/4', '샘플경제', '[예시] 카카오, 새 AI 서비스 공개',
     '카카오가 새로운 AI 서비스를 공개했다.', NOW() - INTERVAL 5 HOUR, 'DONE',
     '카카오가 대화형 AI 서비스를 새로 공개했다. 메신저와 연결해 이용자를 늘릴 계획이다. 광고 수익 확대 기대가 나온다.',
     'sample', NOW(), 'NEWS', 'RSS', 'AI,플랫폼,메신저', 'POSITIVE'),
    ('sample://article/5', 'sample://article/5', '예시일보', '[예시] 전기차 수요 둔화에 배터리 업계 긴장',
     '전기차 판매 증가세가 꺾이며 배터리 업계가 긴장하고 있다.', NOW() - INTERVAL 8 HOUR, 'DONE',
     '전기차 판매 증가세가 둔화됐다. 배터리 업체들은 투자 속도를 조절하고 있다. 완성차 업체는 하이브리드 비중을 늘리고 있다.',
     'sample', NOW(), 'NEWS', 'RSS', '전기차,배터리,수요둔화', 'NEGATIVE'),
    ('sample://article/6', 'sample://article/6', '샘플경제', '[예시] 현대자동차, 미국 공장 증설 검토',
     '현대자동차가 미국 공장 증설을 검토하고 있다.', NOW() - INTERVAL 26 HOUR, 'DONE',
     '현대자동차가 미국 현지 공장 증설을 검토 중이다. 관세 부담을 줄이려는 목적이다. 부품 협력사도 함께 진출할 전망이다.',
     'sample', NOW(), 'NEWS', 'RSS', '미국,공장,관세', 'POSITIVE'),
    ('sample://article/7', 'sample://article/7', '예시 블로그', '[예시] 반도체 주식 요즘 어떻게 보세요?',
     '반도체 업황에 대한 개인 투자자 의견 글.', NOW() - INTERVAL 90 MINUTE, 'DONE',
     '반도체 업황 회복을 기대하는 의견이 많다. 다만 단기 급등에 대한 경계도 있다. 메모리 가격 흐름을 지켜보자는 글이다.',
     'sample', NOW(), 'SNS', 'NAVER_BLOG', '반도체,업황,메모리', 'NEUTRAL'),
    ('sample://article/8', 'sample://article/8', '예시 카페', '[예시] 유가 오르면 항공주는 피해야 할까',
     '유가와 항공주 관계에 대한 카페 글.', NOW() - INTERVAL 4 HOUR, 'DONE',
     '유가 상승이 항공사 비용 부담으로 이어진다는 의견이다. 환율도 함께 봐야 한다는 댓글이 많다. 단기 매수는 조심하자는 분위기다.',
     'sample', NOW(), 'SNS', 'NAVER_CAFE', '유가,항공,환율', 'NEGATIVE'),
    -- 화면에 나오면 안 되는 기사: 관련 종목 없음(NO_STOCK), 아직 처리 중(SUMMARIZED)
    ('sample://article/9', 'sample://article/9', '예시일보', '[예시] 오늘의 날씨와 출근길 교통',
     '종목과 관련 없는 기사.', NOW() - INTERVAL 30 MINUTE, 'NO_STOCK',
     '전국이 맑고 출근길 교통은 원활하다.', 'sample', NOW(), 'NEWS', 'RSS', '날씨,교통', 'NEUTRAL'),
    ('sample://article/10', 'sample://article/10', '샘플경제', '[예시] 아직 처리 중인 기사',
     '종목 연결 전인 기사.', NOW() - INTERVAL 10 MINUTE, 'SUMMARIZED',
     '요약은 끝났지만 종목 연결 전이다.', 'sample', NOW(), 'NEWS', 'RSS', NULL, NULL);

SET @a1 = (SELECT article_id FROM article WHERE url_key = 'sample://article/1');
SET @a2 = (SELECT article_id FROM article WHERE url_key = 'sample://article/2');
SET @a3 = (SELECT article_id FROM article WHERE url_key = 'sample://article/3');
SET @a4 = (SELECT article_id FROM article WHERE url_key = 'sample://article/4');
SET @a5 = (SELECT article_id FROM article WHERE url_key = 'sample://article/5');
SET @a6 = (SELECT article_id FROM article WHERE url_key = 'sample://article/6');
SET @a7 = (SELECT article_id FROM article WHERE url_key = 'sample://article/7');
SET @a8 = (SELECT article_id FROM article WHERE url_key = 'sample://article/8');

-- 6번은 AI가 아직 [확장] 칸(직접/간접, 관련도, 근거)을 안 채운 상태를 흉내 냄
INSERT INTO article_stock (article_id, stock_code, is_main, sentiment, reason, match_type, relevance, evidence) VALUES
    (@a1, '010950', TRUE,  'POSITIVE', '유가 상승은 정유사 마진에 유리', 'INDIRECT', 0.85, '국제유가가 5% 급등했다'),
    (@a1, '096770', FALSE, 'POSITIVE', '유가 상승은 정유 부문 이익에 유리', 'INDIRECT', 0.80, '국제유가가 5% 급등했다'),
    (@a1, '012450', FALSE, 'POSITIVE', '중동 긴장은 방산 수요를 키움', 'INDIRECT', 0.78, '중동 지역 긴장이 높아지며'),
    (@a1, '003490', FALSE, 'NEGATIVE', '유가 상승은 항공 연료비 부담', 'INDIRECT', 0.72, '항공주는 연료비 부담이 커졌다'),
    (@a2, '005930', TRUE,  'POSITIVE', '기사 주인공. 공급 계약으로 실적 개선 기대', 'DIRECT', 0.95, '삼성전자가 고대역폭 메모리 공급 계약을 맺었다'),
    (@a2, '000660', FALSE, 'NEUTRAL',  '같은 메모리 업종 경쟁사', 'INDIRECT', 0.60, '경쟁사 주가도 함께 움직였다'),
    (@a3, '012450', TRUE,  'POSITIVE', '해외 수출 계약 당사자', 'DIRECT', 0.92, '방산 기업들의 해외 수출 계약이 이어지고 있다'),
    (@a3, '047810', FALSE, 'POSITIVE', '해외 수출 계약 당사자', 'DIRECT', 0.88, '방산 기업들의 해외 수출 계약이 이어지고 있다'),
    (@a3, '079550', FALSE, 'POSITIVE', '방산 부품·체계 기업으로 수혜 예상', 'INDIRECT', 0.75, '부품 기업도 수혜가 예상된다'),
    (@a4, '035720', TRUE,  'POSITIVE', '새 AI 서비스 공개 당사자', 'DIRECT', 0.93, '카카오가 새로운 AI 서비스를 공개했다'),
    (@a5, '373220', TRUE,  'NEGATIVE', '배터리 수요 둔화 영향', 'INDIRECT', 0.82, '배터리 업계가 긴장하고 있다'),
    (@a5, '006400', FALSE, 'NEGATIVE', '배터리 수요 둔화 영향', 'INDIRECT', 0.79, '배터리 업계가 긴장하고 있다'),
    (@a5, '005380', FALSE, 'NEUTRAL',  '하이브리드 비중 확대로 영향 제한', 'INDIRECT', 0.55, '완성차 업체는 하이브리드 비중을 늘리고 있다'),
    (@a6, '005380', TRUE,  'POSITIVE', '미국 공장 증설 검토 당사자', NULL, NULL, NULL),
    (@a7, '005930', FALSE, 'NEUTRAL',  '반도체 업황 의견 글에서 언급', 'DIRECT', 0.70, '반도체 업황 회복을 기대하는 의견이 많다'),
    (@a7, '000660', FALSE, 'NEUTRAL',  '반도체 업황 의견 글에서 언급', 'DIRECT', 0.68, '메모리 가격 흐름을 지켜보자'),
    (@a8, '003490', TRUE,  'NEGATIVE', '유가 상승은 항공사 비용 부담', 'INDIRECT', 0.66, '유가 상승이 항공사 비용 부담으로 이어진다');

-- 종목 종합 요약 (AI가 1시간마다 만드는 것을 흉내). 오늘 날짜로 3종목만
-- 삼성전자: 뉴스·SNS 요약 둘 다, 한화에어로스페이스: 뉴스 요약만, 대한항공: 둘 다. 나머지 종목은 요약 없음 (준비 중 화면 시험용)
-- 구분: 요약이 [예시]로 시작. INSERT IGNORE: AI가 만든 진짜 요약이 이미 있으면 덮어쓰지 않음
DELETE FROM stock_daily_summary WHERE news_summary LIKE '[예시]%';

INSERT IGNORE INTO stock_daily_summary (stock_code, summary_date, news_summary, sns_summary,
                                        pos_count, neg_count, neu_count, generated_at) VALUES
    ('005930', CURDATE(), '[예시] 고대역폭 메모리 공급 계약으로 하반기 반도체 실적 개선 기대가 커졌다.',
     '[예시] 반도체 업황 회복을 기대하는 글이 많지만 단기 급등을 경계하는 의견도 있다.', 1, 0, 1, NOW()),
    ('012450', CURDATE(), '[예시] 해외 수출 계약과 중동 긴장으로 방산 수요 기대가 이어졌다.',
     NULL, 2, 0, 0, NOW()),
    ('003490', CURDATE(), '[예시] 국제유가 급등으로 항공사 연료비 부담 우려가 커졌다.',
     '[예시] 유가가 오르면 항공주를 피해야 하냐는 질문이 나왔다.', 0, 2, 0, NOW());
