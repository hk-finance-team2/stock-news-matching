-- article에 LLM이 뽑은 회사 목록 칸 추가 (AI 파트 요청, 2026-11-02)
-- AI 처리 순서: ① LLM 요약 때 "기사에 나온 회사 이름 + 회사별 감성·이유"를 뽑음 → ② 매칭 단계에서 종목코드로 바꿔 article_stock에 저장
-- article_stock은 종목코드가 정해져야 넣을 수 있어서(FK) ①의 결과를 둘 곳이 필요함
-- 저장해 두면 매칭 규칙(별칭·오탐·점수)을 고칠 때 LLM을 다시 부르지 않아도 됨 (비용 N-04)
-- 값 예: [{"name": "포스코퓨처엠", "is_main": true, "sentiment": "POSITIVE", "reason": "..."}]
-- AI 내부용 중간 결과라 백엔드·화면은 조회하지 않음

ALTER TABLE article
    ADD COLUMN companies JSON NULL
        COMMENT 'LLM 이 뽑은 회사 목록 (종목 매칭 입력). 백엔드·화면은 조회하지 않음'
        AFTER sentiment;
