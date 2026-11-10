-- 공시 연결의 관련도를 비움 (2026-11-10)
-- 관련도 = "이 기사에서 이 종목이 얼마나 중심인가" (0~1). 공시는 회사가 낸 자기 서류라 잴 것이 없는데 AI 공시 수집이 1.00 을 넣었음
-- → 관련도순 정렬 첫 페이지 20건이 전부 공시, 이슈 순위 동점 때 평균 관련도·급등락 날 상위 3개에서도 공시가 앞섬 (지승현 지적, 로컬 DB 공시 7,081건 전부 1.00)
-- 백엔드 SQL 은 이미 NULL 을 "점수 없음"으로 다룸: 관련도순은 COALESCE(…, 0) 로 맨 뒤, 평균(AVG)에서는 빠짐, 정렬은 relevance IS NULL 을 뒤로
-- 앞으로 들어오는 공시는 AI 쪽(ai/hk_llm/steps/dart.py)이 NULL 로 넣음. 근거: docs/decisions.md 2026-11-10
UPDATE article_stock s
    JOIN article a ON a.article_id = s.article_id
SET s.relevance = NULL
WHERE a.channel = 'DART';
