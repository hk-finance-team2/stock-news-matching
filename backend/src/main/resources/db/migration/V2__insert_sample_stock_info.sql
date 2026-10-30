-- 개발·연결 확인용 예시 종목 (업종은 예시 값)
-- 나중에 KIS 종목 마스터 파일을 넣을 때는 "이미 있으면 덮어쓰기"로 넣어 겹치지 않게 함
INSERT INTO stock_info (stock_code, stock_name, market, sector) VALUES
    ('005930', '삼성전자', 'KOSPI', '반도체'),
    ('000660', 'SK하이닉스', 'KOSPI', '반도체'),
    ('010950', 'S-Oil', 'KOSPI', '정유'),
    ('012450', '한화에어로스페이스', 'KOSPI', '방산'),
    ('003490', '대한항공', 'KOSPI', '항공');
