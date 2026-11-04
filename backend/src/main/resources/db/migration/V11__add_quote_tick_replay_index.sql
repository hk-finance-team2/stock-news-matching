-- 다시 보기(QuoteMapper findReplayTicks) 전용 인덱스
-- 쿼리: WHERE stock_code = ? AND trade_date = ? AND traded_at >= ? AND tick_id > ? ORDER BY tick_id LIMIT ?
-- 없을 때: 맞는 인덱스가 없어 DB가 표 전체를 tick_id 순(PRIMARY)으로 훑으며 거름
--   → 첫 쪽을 찾으려면 지난 날짜 체결을 전부 지나침. 11/04 삼성전자 첫 쪽 500건에 31,720행 읽음 (쿼리 테스트 QT-57)
--   → 표가 하루 약 20만 행씩 늘어 날이 갈수록 느려짐
-- 있을 때: 종목·날짜로 바로 찾고 그 안에서 tick_id 순서 그대로 읽어 LIMIT 만큼만 봄
CREATE INDEX idx_quote_tick_replay ON quote_tick (stock_code, trade_date, tick_id);
