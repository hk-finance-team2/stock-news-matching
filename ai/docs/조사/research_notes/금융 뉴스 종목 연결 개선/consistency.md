# 저가 LLM 구조화 추출의 일관성·규칙 준수 개선과 정답 라벨 없는 평가

조회일 2026-11-03. 이번 조사에서 유료 API 호출은 0회다.

표기 규칙:
- **[공식]** OpenAI·LangChain 공식 문서를 직접 읽음
- **[논문]** 원문을 읽음
- **[초록만]**, **[검색 요약만]** 원문 수치를 확인하지 못함
- **[로컬]** 팀 코드·설치 패키지에서 확인함 (API 호출 없음)
- **[계산]** 내가 계산함
- **[미검증]** 근거가 부족함

방법 종합 목록과 40건 평가 절차는 마지막 질문의 끝에 있다.

## 1. gpt-5.4-nano / GPT-5 계열에 실제로 있는 API 파라미터는?

### Takeaway
reasoning 기본값이 `none`이고 코드가 temperature를 보내지 않으므로, 가장 싼 첫 실험은 `temperature=0` 이다. 추가 비용이 없다. 단, 이 조합의 허용 여부는 2차 출처로만 확인했으므로 1회 호출로 확인해야 한다. 별도로 **gpt-5.4-nano는 이미 deprecated이고 2027-04-01에 종료된다.** 1차 마감(11-20)에는 영향이 없다.

### Cited Findings

| 항목 | 확인 내용 | 수준 |
|---|---|---|
| 상태 | `gpt-5.4-nano`와 스냅샷 `gpt-5.4-nano-2026-03-17` 모두 Deprecated — [모델 페이지](https://developers.openai.com/api/docs/models/gpt-5.4-nano). 2027-04-01 제거, 권장 대체는 `gpt-6-luna` — [Deprecations](https://developers.openai.com/api/docs/deprecations) | 공식 |
| 가격 | 100만 토큰당 입력 $0.20, 캐시 입력 $0.02, 출력 $1.25 — [모델 페이지](https://developers.openai.com/api/docs/models/gpt-5.4-nano) | 공식 |
| reasoning effort | `none`(기본), `low`, `medium`, `high`, `xhigh` — [모델 페이지](https://developers.openai.com/api/docs/models/gpt-5.4-nano). `minimal`은 이 목록에 없음 (Vercel 게이트웨이 문서에는 있다고 나와 공식과 충돌, [Vercel](https://vercel.com/ai-gateway/models/gpt-5.4-nano/api)) | 공식 |
| 지원 기능 | 구조화 출력, function calling, 프롬프트 캐싱, 스트리밍. Chat Completions·Responses·Batch 엔드포인트 — [모델 페이지](https://developers.openai.com/api/docs/models/gpt-5.4-nano) | 공식 |
| temperature / top_p | 모델 페이지에 언급 없음. API 레퍼런스는 범위 0~2만 설명하고 모델별 조건은 적지 않음 — [Chat 레퍼런스](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create). "GPT-5.4는 effort `none`일 때만 temperature·top_p·logprobs 지원, 그 외에는 오류"라는 OpenAI 문구는 제3자 PR이 URL 없이 인용한 것 — [Dify PR](https://github.com/langgenius/dify-official-plugins/pull/2829). LangChainGo 이슈도 같은 규칙을 전함 — [이슈](https://github.com/tmc/langchaingo/issues/1497). OpenAI 포럼 호환표는 커뮤니티 작성이며 공식 답변 없음 — [포럼](https://community.openai.com/t/request-for-compatibility-matrix-reasoning-effort-sampling-parameters-across-gpt-5-series/1371738) | **nano 기준 공식 미확인** |
| 후속 모델 규칙 | GPT-6 계열은 "effort가 none이 아니면 temperature·top_p·top_logprobs 제거". GPT-6 Luna는 `none` 지원 — [Latest model](https://developers.openai.com/api/docs/guides/latest-model) | 공식 |
| seed | Beta, "best effort로 결정적 샘플링", `system_fingerprint`와 함께 사용. 모델별 조건 미기재 — [Chat 레퍼런스](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) | 공식(보장 없음) |
| verbosity | `low`/`medium`/`high`, 기본 `medium`. 모델별 조건 미기재 — [Chat 레퍼런스](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) | 공식(nano 적용은 미확인) |
| strict 모드 | 지원 타입에 Enum, anyOf 포함. String은 `pattern`·`format`, Array는 `minItems`·`maxItems` 지원. 모든 필드 required, `additionalProperties:false` 필수. 출력 키 순서는 스키마 순서를 따름 — [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) | 공식 |
| `minLength`/`maxLength` | 지원 목록에 없음. "fine-tuned 모델에서 미지원" 목록에는 있음. 일반 모델에서 되는지 문서만으로 불명확 — [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) | **미확인** |
| 첫 요청 지연 | 스키마별 첫 요청에 추가 지연, 이후 없음 — [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) | 공식 |
| 프롬프트 캐싱 | 전체 prefix가 같아야 재사용. `text.format` 스키마도 prefix에 영향. GPT-5.6 이전 모델의 최소 길이는 도구·스키마·effort·verbosity에 따라 달라지며 구체 수치 없음. 보존 옵션은 `in_memory`/`24h` — [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) | 공식 |
| 현재 코드 | `ChatOpenAI(model=model, timeout=60, max_retries=2, max_tokens=2000)`. temperature·seed·effort 미설정 — `ai/hk_llm/steps/step5_summary.py` | 로컬 |
| LangChain 기본값 | 공식 문서는 "기본이 function calling"이라 쓰고 — [LangChain 문서](https://docs.langchain.com/oss/python/integrations/chat/openai) — 설치된 `langchain-openai==1.7.3`의 시그니처는 `method='json_schema'`. **설치본 기준으로는 json_schema.** Pydantic을 OpenAI SDK 변환 함수에 넣으면 `strict:true`, `max_length=40`은 `maxLength:40`, `list` 길이 제한은 `maxItems`로 나감 (변환 함수 수준 확인, 실제 전송 본문은 미확인) | 로컬 |
| 파라미터 통과 | 설치본 `ChatOpenAI`에 `temperature`, `seed`, `top_p`, `logprobs`, `reasoning_effort`, `reasoning`, `verbosity`, `use_responses_api` 필드 존재 | 로컬 |

temperature의 효과 근거:
- gpt-4o-mini 동일 프롬프트 반복(프롬프트 100개×30회 등)에서 고유 출력 비율은 T=0일 때 0.240, T=0.7일 때 0.987. 평균 Jaccard는 0.893 대 0.518 — [Nicholson 2026](https://arxiv.org/html/2601.19934). 자유 텍스트이며 gpt-5.4-nano가 아니다.
- T=0, top_p=1, seed 고정에서도 비결정성이 남고 어떤 모델도 이상값에 닿지 못함. 정확도 max-min 차이는 일부 과제에서 5~15% — [Atil et al.](https://arxiv.org/html/2408.04667v3).
- 로컬 GPU에서 최적화 없이 돌린 Llama-3-8B만 결정적이었고, 저자들은 호스팅 API의 배칭·캐싱을 원인으로 추정 — [Atil et al.](https://arxiv.org/html/2408.04667v3).
- 샘플링을 끄면 사람 라벨과의 균형 정확도가 소폭 하락 (58.4 vs 59.1, 69.3 vs 69.8, 79.2 vs 79.4) — [Rating Roulette](https://arxiv.org/html/2510.27106). 자체 호스팅 모델, 평가(judge) 과제다.

### Inferences
- 현재 측정치(5, 5, 1 등)는 서버 기본 temperature 상태에서 나온 값일 가능성이 높다. 측정 스크립트도 같은 `chain()`을 썼다는 전제다.
- effort를 올리면 temperature를 못 쓰게 되는 쪽이 유력하므로, nano에서는 "T=0 + effort none"과 "effort low" 중 하나를 골라야 한다. 먼저 T=0을 시험한다.
- 시스템 프롬프트 474토큰 + 스키마 JSON 약 420토큰 ([로컬], tiktoken `o200k_base`, 실제 렌더링과 다를 수 있음)이므로 고정 prefix는 약 900토큰이다. 캐시가 현재 안 걸릴 수 있다. 응답 `usage`의 cached 토큰으로 확인한다.
- 대체 모델 전환 시 모델이 바뀌므로 일관성 측정을 다시 해야 한다. 40건 평가 세트를 만들어 두면 그때 재사용할 수 있다.

### Gaps
- gpt-5.4-nano에서 `temperature=0`이 받아들여지는지 공식 문서로 확인 못 함. **1회 호출(약 $0.0006)로 확인 가능.**
- `maxLength`를 일반 모델에서 수락·강제하는지 미확인. 1회 호출로 확인 가능.
- seed와 verbosity가 nano에서 측정 가능한 효과를 내는지, seed가 Responses API에서도 동작하는지 근거 없음.
- 캐싱이 출력 내용에 영향을 주는지 이번 조회에서 확인 못 함.
- `gpt-6-luna` 가격·파라미터는 조회하지 않음.

## 2. few-shot, 필드 순서, 이유 먼저, article_type, 2단계 추출은 일관성을 높이는가?

### Takeaway
few-shot은 정확도 근거는 있으나 **일관성 향상 근거는 약하다.** 필드 순서는 근거가 충돌하지만 비용이 0이라 시험할 만하다. article_type 필드를 1회 호출 안에 넣는 안은 직접 근거 없이 추론에 기대지만, 2단계보다 훨씬 싸다.

### Cited Findings

**few-shot**
- 임상 SDOH 추출: 0-shot 0.786 → 10-shot 0.824 → 30-shot 0.872 → 50-shot 0.881 → **100-shot 0.756** (micro-F1, 평가 30건) — [Dogan et al.](https://arxiv.org/abs/2604.13502) [논문]. 많을수록 좋은 것이 아니다.
- 인보이스 추출: zero-shot과 최선 few-shot 차이 19%p 초과 — [arXiv 2604.25927](https://arxiv.org/html/2604.25927) [검색 요약만].
- 중국어 오픈소스 LLM 정보추출: 4개 중 3개 경우에서 few-shot F1이 높고 주로 정밀도 상승, 한 파이프라인은 예시를 늘려도 효과 없음 — [arXiv 2406.02079](https://arxiv.org/pdf/2406.02079) [검색 요약만].
- **일관성 쪽 반대 근거:** Qwen3의 자기 일치도 alpha는 기본 0.7883, few-shot 0.7804, CoT 0.7796, 둘 다 0.7801로 변화 미미 — [Rating Roulette](https://arxiv.org/html/2510.27106). 평가 과제다.
- zero-shot과 few-shot의 비결정성 수준이 비슷 — [Atil et al.](https://arxiv.org/html/2408.04667v3).
- 실무 블로그의 "few-shot이 오류 40~70% 감소" 주장은 출처가 없어 제외 — [theneuralbase](https://theneuralbase.com/instructor/learn/intermediate/what-few-shot-does-for-extraction/).
- 팀 자체 측정: 키워드 규칙 위반 72/146(49.3%, Wilson 95% 41.3~57.3%) → 5/106(4.7%, 2.0~10.6%) [계산]. 개수도 줄었다. 30회 기준 회당 4.9개 → 3.5개 [계산]. 3~5개 규칙 안이지만 "규칙 하나가 다른 결과도 바꾼" 사례다.

**필드 순서 / 이유 먼저**
- 키 순서는 스키마 순서를 따름 — [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) [공식].
- 이유 먼저 순서는 자유 형식과 같거나 더 낫고, 답 먼저 순서는 특히 작은 모델에서 크게 하락, 보정(calibration)도 개선 — [Structure Tax, arXiv 2610.12056](https://arxiv.org/abs/2610.12056) [초록만, 수치 없음].
- 반대: pydantic-evals로 그림 화풍 분류를 비교했더니 차이가 미미 — [CO/AI 요약](https://getcoai.com/news/why-field-order-may-not-improve-model-reasoning) [2차 요약, 원문 접속 실패].
- 현재 스키마의 `Company`는 name, is_main, sentiment, long_term, reason 순으로 **답 먼저 구조**다 — `step5_summary.py` [로컬].

**article_type / 2단계**
- 자동차 질의 이해: 분류+추출 단일 단계보다 분류 후 특화 프롬프트로 추출이 효율·정확도 모두 나음(정성). 분류 오류 시 잘못된 스키마로 추출되는 위험 — [arXiv 2604.16301](https://arxiv.org/html/2604.16301v1) [검색 요약만].
- 법률 정보추출: 분류 후 해당 유형 예시만 넣는 방식이 전체 유형 예시를 넣는 방식보다 낫고 토큰도 감소 — [Classify First, NLLP 2024](https://aclanthology.org/2024.nllp-1.25) [초록]. 검색 요약상 GPT-4o mini 개체 77.05 vs 75.53, 사건 70.67 vs 68.30 — **수치는 원문 미확인.**
- 금융 뉴스에서 공동 추출과 2단계를 직접 비교한 연구는 찾지 못함.

### Inferences
- few-shot의 역할은 일관성 자체보다 **경계 사례 판단 교정**으로 보는 편이 맞다. 2~3개만 넣되 "명단 기사 → 회사 빈 목록", "시황 기사 사례 회사 → is_main false"처럼 흔들리는 경계를 고른다. 예시는 합성 기사로 쓴다(기사 저작권 규칙).
- 회사 수 5, 5, 1은 모델이 내부적으로 "이 기사가 명단·시황 기사인가"를 매번 다르게 판단한 결과일 수 있다. 가설이며 해당 기사 3회 답을 읽어 확인해야 한다. 맞다면 `article_type` Literal을 `companies` 앞에 두어 판단을 명시하고, 결과를 코드 규칙에 연결할 수 있다.
- 다른 가설: `check()`의 `c.name in text_` 필터가 표기가 달라진 회사를 지웠을 수 있다. 측정이 check 뒤에서 이뤄졌다면 raw와 비교해 구분한다.
- `reason`을 `sentiment` 앞으로 옮기는 것은 비용 없는 실험이다. 다만 짧은 이유 문장이 "추론"을 얼마나 대신하는지는 불명확하다.
- 2단계는 호출이 사실상 2배이므로 1회 호출 article_type이 효과 없을 때만 검토한다.

### Gaps
- 필드 순서·few-shot·article_type이 **구조화 추출의 실행 간 일관성**에 주는 효과를 직접 잰 연구는 찾지 못함.
- Structure Tax의 모델·수치 미확인. 작은 모델의 "큰 하락"이 nano에 해당하는지 알 수 없음.
- 한국어 뉴스 대상 근거 없음.

## 3. 다수결/자기 일관성은 비용을 정당화하는가?

### Takeaway
3회 다수결은 측정된 효과가 있으나 비용이 3배다. 지금 운영에 상시 적용할 근거는 부족하다. T=0과 코드 규칙을 먼저 쓰고, 다수결은 평가용 또는 규칙으로 고른 일부 기사에만 쓴다.

### Cited Findings
- 임상 추출 3회 다수결: micro-F1 0.842 → 0.903(+0.063), 후처리 추가 시 0.929(+0.026). 정밀도 0.802 → 0.886 → 0.948 (평가 30건) — [Dogan et al.](https://arxiv.org/abs/2604.13502) [논문].
- 평가 과제 3회 다수결: 59.1 → 61.4, 69.8 → 72.3, 79.4 → 80.6 (+1.2~2.5%p) — [Rating Roulette](https://arxiv.org/html/2510.27106) [논문].
- 상품 속성 추출: 여러 번 반복해 최빈값을 택하고 일치 비율이 낮으면 사람에게 넘김 — [Kyyrö & Fränti 2026](https://www.aimspress.com/article/doi/10.3934/aci.2026010) [검색 요약만, 원문 접속 실패].
- 표준 자기 일관성은 문자열 완전 일치에 의존해 적용이 제한됨 — [arXiv 2508.18395](https://arxiv.org/pdf/2508.18395v3) [검색 요약만].
- 이웃 근거: GPT-5.4(reasoning-low, nano 아님)는 합성 인터뷰 150건 코딩에서 7회 반복 성능이 일관됐다고 보고(정성) — [arXiv 2606.26541](https://arxiv.org/pdf/2606.26541) [논문].

비용 [계산, 코드 주석의 실측 $0.0006/건, 1,000건/일, 월 약 $19 기준]:

| 방식 | 건당 | 월 |
|---|---|---|
| 1회 | $0.0006 | 약 $19 |
| 전체 3회 | $0.0018 | 약 $57 |
| 전체 2회 (불일치 시 1회 추가) | $0.0012~ | 약 $38~ |
| 기사 20%만 규칙으로 골라 2회 추가 | $0.00084 | 약 $27 |

코드 주석에 예산 5만원이 있다. 환율은 확인하지 않았으나 전체 3회는 초과 가능성이 크다.

독립 가정 시 항목이 p 확률로 나올 때 3회 다수결이 맞을 확률 p³+3p²(1−p): p=0.8 → 0.896, p=0.9 → 0.972 [계산]. 실제로는 같은 체계적 오류를 공유하므로 **정확도 이득은 이보다 작을 수 있다.**

### Inferences
- 1회 호출에서는 불일치 신호가 없다. "불일치할 때만 재호출"은 최소 2회를 뜻한다. 호출 없이 고르려면 규칙(명단·시황 기사, 회사 수 많음)을 트리거로 쓴다.
- 투표는 회사 단위로 한다. 이름 정규화 후 2/3 이상 등장 회사 채택, 감성은 회사별 최빈값. summary와 reason은 투표가 안 되므로 투표 결과에 가장 가까운 회차를 통째로 쓴다. 필드를 섞으면 요약과 회사 목록이 어긋날 수 있다.
- 다수결은 일관되게 틀린 답도 안정화한다. 안정성 지표만으로 성공을 선언하면 안 된다.

### Gaps
- 금융 뉴스나 한국어 추출에서 다수결의 효과·비용 대비 수치는 찾지 못함.
- 위 효과 수치는 모두 다른 도메인이고 Dogan은 표본 30건이다.

## 4. 어떤 제약을 프롬프트에서 코드로 옮겨야 하는가?

### Takeaway
기계적으로 판정되는 규칙(길이, 개수, 숫자 포함, 기사 내 존재, 연도)은 코드로 옮기고 프롬프트는 의미 판단에 쓴다. 재시도는 위반율이 낮고 치명적인 규칙에만 쓴다. **`reason`에 Pydantic `max_length=40`을 바로 넣으면 안 된다.**

### Cited Findings
- `minItems`/`maxItems`, `pattern`, Enum은 strict 스키마 지원 — [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) [공식].
- 거절(refusal)은 status가 completed여도 올 수 있고, `max_output_tokens`로 `incomplete`면 JSON이 잘릴 수 있어 앱에서 처리 필요 — [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) [공식].
- 임상 추출의 후처리만으로 micro-F1 +0.026, 정밀도 0.886 → 0.948 — [Dogan et al.](https://arxiv.org/abs/2604.13502) [논문].
- 팀 코드 `check()`: 기사에 없는 연도면 ValueError → `retry_count` 증가 → 3회 후 FAILED. 회사는 기사에 등장하는 이름만 남기고 10개로 자름. `reason[:200]`, `keywords[:5]`, `summary[:1000]` — `step5_summary.py` [로컬]. **40자 제한은 코드가 전혀 강제하지 않는다.**
- reason 위반 49/58 = 84.5% (Wilson 73.1~91.6%) [계산].

### Inferences

| 규칙 | 권장 위치 | 이유 |
|---|---|---|
| 연도 환각 | 코드 거부+재시도 유지 | 사실 오류이고 위반이 드문 것으로 보임. 재시도 값이 있음 |
| reason 40자 | 프롬프트 지시+코드 처리, **재시도 금지** | 84.5% 위반이라 재시도하면 호출이 크게 늘고 또 위반할 가능성이 큼 |
| reason의 Pydantic `max_length` | 넣지 않음 | 서버가 강제하지 않으면 파싱 오류 → `ValueError` → 정상 기사가 FAILED로 감 (코드 흐름에서 추론, 1회 호출로 확인) |
| keywords 개수 | 스키마 `minItems=3, maxItems=5` + 기존 자르기 | 공식 지원, 비용 없음 |
| 숫자 포함 키워드 | 코드 필터(숫자 포함 제거) | 재시도 불필요. 프롬프트 예시도 효과가 있었으므로 유지 |
| companies 개수 | 스키마 `maxItems=10` + 기존 자르기 | 공식 지원 |
| 회사 실존/표기 | 코드(기사 내 등장 + `stock_info` 사전 대조) | 사전 대조가 표기 흔들림을 흡수해 일관성도 올림 |
| 명단·시황 기사 is_main | article_type을 받아 코드로 강제 | 효과 있으면 프롬프트 규칙을 지울 수 있음 |
| 감성 판단 | 프롬프트 + few-shot | 코드로 판정 불가 |
| 사실 외 추측, 프롬프트 인젝션 방어 | 프롬프트 유지 + 기존 `_strip_tag` | 의미 영역 |

reason 처리 순서:
1. 40자가 정말 필요한지 화면 요구를 확인한다. 실측 길이 분포를 보고 현실적인 값으로 올리는 것이 가장 쉽다.
2. 제한이 꼭 필요하면 40자 뒤 문장을 어절 경계에서 자르는 대신, 초과 시 화면에서 말줄임 처리한다. 저장 데이터는 온전히 둔다.
3. 40자에 맞춘 예시 1~2개를 넣는다. 키워드 규칙에서 효과가 났던 방식이다.

추가 수정 후보: `out["raw"]`의 refusal·incomplete를 별도 사유로 기록하면 실패 원인 구분이 쉬워진다. 현재는 모두 같은 "형식 안 맞음"으로 처리된다.

### Gaps
- 글자 수 제약을 코드로 옮겼을 때의 효과를 잰 공개 연구는 찾지 못함. 위 표는 비용·구조 기반 판단이다.
- 재시도 시 오류 메시지를 프롬프트에 넣어 다시 묻는 방식의 효과 수치는 이번에 찾지 못함.

## 5. 라벨 없이 평가하는 방법, 도구, 표본 크기, 3회 표본의 한계

### Takeaway
도구를 새로 들이지 말고 기존 `tests/`와 파이썬 스크립트 하나로 시작한다. 40건×3회($0.072)로 큰 변화는 판별할 수 있으나 작은 개선은 판별하지 못한다. **일치도는 정확도가 아니므로** 회사 목록 소량 골드를 함께 둔다.

### Cited Findings

**지표**
- Krippendorff alpha는 반복 실행의 자기 일치도에 쓰이며 관례 기준은 0.800, 잠정 결론 허용 하한 0.667 — [arXiv 2510.27106](https://arxiv.org/html/2510.27106) 및 [검색 요약](https://arxiv.org/pdf/2510.06658).
- 3회 alpha 예: Llama 3.1 0.3263/0.265, DeepSeek-R1 0.6278/0.507, Qwen3 0.7883/0.563. Qwen3가 MT-Bench에서 3회 모두 같은 판단을 낸 비율은 61.3% — [Rating Roulette](https://arxiv.org/html/2510.27106).
- 같은 논문은 5~10회로 늘려도 유의한 변화가 없었다고 하나 그 수치는 미제시. 가장 일관된 모델이 가장 정확했으나 상관계수는 계산하지 않음 — [Rating Roulette](https://arxiv.org/html/2510.27106).
- 사람 대 사람 일치도도 함께 보고 인간 상한을 잡으라고 권고 — [Rating Roulette](https://arxiv.org/html/2510.27106).
- 출력이 길수록 TARa·TARr이 낮고, few-shot에서 중앙 정확도와 TARa는 강한 양의 상관(계수 미제시) — [Atil et al.](https://arxiv.org/html/2408.04667v3).
- 입력의 작은 어휘 변경은 반복 잡음보다 영향이 큼: gpt-4o-mini T=0에서 고유 비율 exact 0.240 vs perturbed 0.572, Jaccard 0.893 vs 0.632 — [Nicholson 2026](https://arxiv.org/html/2601.19934). **"규칙 추가가 다른 결과를 바꾸는" 현상과 방향이 맞다.** 프롬프트가 아니라 사용자 입력 변형을 측정한 자유 텍스트 결과다.
- 단일 실행 대신 다회 실행 보고와 기준선 측정을 권고 — [Nicholson 2026](https://arxiv.org/html/2601.19934).

**표본 크기**
- 검증된 "LLM 재검사 alpha 최소 표본" 근거는 찾지 못함. Bloch-Kraemer 공식으로 N=32를 쓴 사례가 있으나 부트스트랩 표본 크기다 — [arXiv 2510.06658](https://arxiv.org/pdf/2510.06658) [검색 요약만]. Gwet 방식으로 오차 0.10, 신뢰 90% 표본을 구하는 틀이 있음 — [chatpaper 요약](https://chatpaper.com/paper/139434) [검색 요약만].

40건의 해상도 [계산, Wilson 95%, 기사 단위 비율]:

| 결과 | 구간 |
|---|---|
| 40/40 | 91.2~100% |
| 38/40 | 83.5~98.6% |
| 36/40 | 76.9~96.0% |
| 32/40 | 65.2~89.5% |
| 20/40 | 35.2~64.8% |

- 관측 위반 0건이어도 실제 위반율 상한은 약 7.5% (3의 법칙) [계산].
- 같은 기사로 전후 비교(부호 검정, 양측 p<0.05) 시 필요한 개선:악화 기사 수는 6:0, 8:1, 10:2 [계산]. 변화 없는 기사는 제외한다. 이 숫자에 못 미치면 "차이 불명"으로 기록한다.

3회 반복의 한계 [계산, 독립 가정]: 각 실행에서 p 확률로 나오는 항목이 3회 모두 같게 보일 확률은 p³+(1−p)³.

| p | 3회 모두 같음 |
|---|---|
| 0.95 | 85.8% |
| 0.90 | 73.0% |
| 0.80 | 52.0% |
| 0.50 | 25.0% |

- 3회로는 기사별 "불안정"을 놓치기 쉽다. 전체 평균 추세용으로 쓰고 개별 항목 진단에는 쓰지 않는다.
- 기존 9/27(33.3%, Wilson 18.6~52.2%)은 회사가 기사에 묶여 있어 실제 불확실성은 더 크다. "5, 5, 1"은 1건 사례다.

**도구**
- promptfoo: `repeat`(테스트별 지정 가능), 반복마다 별도 캐시 항목이므로 `--no-cache` 필요, `is-json` 스키마 검사, 파이썬 사용자 assert — [config reference](https://www.promptfoo.dev/docs/configuration/reference), [test cases](https://promptfoo.dev/docs/configuration/test-cases/), [사용기](https://www.timdeschryver.dev/blog/testing-ai-prompts-and-comparing-models-with-promptfoo) [검색 요약만].
- Inspect: 다중 scorer, majority/mode 축약 지원 — [Multiple Scorers](https://inspect.aisi.org.uk/multiple-scorers.html). `--epochs`는 제3자 튜토리얼에서만 확인 — [qaskills](https://qaskills.sh/blog/inspect-ai-evals-tutorial-2026).
- LangSmith: 무료 1석, 월 5,000 trace, 기본 보존 14일 — [wavect](https://wavect.io/blog/langsmith-trace-retention-sampling-cost/) [제3자, 요금표 공식 미확인]. 반복 옵션은 확인 못 함.

### Inferences

**도구 선택:** 복합 지표(회사 집합 Jaccard, alpha, 기사별 diff)는 어느 도구든 사용자 코드가 필요하다. `ai/tests/`와 스크립트 1개로 시작하고, 화면 비교가 필요해지면 promptfoo를 붙인다. Inspect는 안전성 평가 지향으로 보여 과하고, LangSmith는 이미 trace를 쓰는 경우에만 가치가 있다.

**프롬프트 회귀 규칙:** 한 번에 규칙 하나만 바꾼다. 기준선의 자체 변동(run 간 diff)과 비교해 그보다 큰 변화만 "프롬프트 효과"로 본다.

### 종합: 방법 목록 (시도 순서)

| # | 방법 | 효과 근거 | 비용 영향 | 난이도 | 적합도 |
|---|---|---|---|---|---|
| 1 | 평가 스크립트 + 기준선 | 측정 전제, 권고 근거 있음 | 1회 $0.072 | 낮음 | 높음 |
| 2 | `temperature=0` (+seed) | T=0 vs 0.7 Jaccard 0.893/0.518 (다른 모델). 허용 여부 1회 확인 필요 | 없음 | 매우 낮음 | 높음 |
| 3 | 기계적 규칙 코드 이전, 스키마 `maxItems` 등 | 후처리 +0.026 (임상). 규칙 위반은 정의상 제거됨 | 없음 | 낮음 | 높음 |
| 4 | reason 제한 재설정 | 근거 없음, 84.5% 위반 측정치 기반 판단 | 없음 | 낮음 | 높음 |
| 5 | `stock_info` 사전으로 이름 정규화 | 직접 근거 없음 | 없음 | 낮음~중간 | 높음 (담당 경계 확인) |
| 6 | 필드 순서 변경 (reason 먼저) | 충돌 | 없음 | 매우 낮음 | 중간, 측정 후 유지 결정 |
| 7 | few-shot 2~3개 | 정확도 +, 일관성은 불명. 팀 키워드 측정 49.3%→4.7% | 800토큰 가정 시 건당 +$0.00016 (+27%), 월 +약 $4.8. 캐시 시 더 낮음 [계산] | 낮음 | 중간~높음 |
| 8 | 스키마 `article_type` | 직접 근거 없음, 인접 근거 정성 | 소량 | 낮음 | 중간, 회사 수 흔들림 원인 확인 후 |
| 9 | 고정 내용을 앞에 두고 캐시 확인 | 입력 90% 할인 (공식 가격) | 절감 | 낮음 | 7을 할 때 같이 |
| 10 | 규칙 트리거 다수결 | 3회 다수결 +0.063 (임상), +1.2~2.5%p (평가) | 약 ×1.4 (20% 가정) | 중간 | 낮음~중간, 7까지 부족할 때 |
| 11 | `reasoning_effort=low` | nano 근거 없음. temperature 사용 불가 가능성 | 숨은 추론 토큰, 양 미측정 | 낮음 | 낮음, 1~2건으로 토큰 먼저 확인 |
| 12 | 2단계 추출 | 인접 도메인 소폭 | 약 ×2 | 중간 | 낮음 |
| 13 | 전체 3회 다수결 | 위와 같음 | ×3, 월 약 $57 | 중간 | 낮음 |
| 14 | verbosity | 근거 없음 | 불명 | 낮음 | 낮음, reason 길이 실험에 한해 |

Batch 엔드포인트 지원은 공식 확인. 할인율은 이번에 확인하지 않음.

### 40건 무라벨 평가 절차

**비용:** 40건×3회 = 120회 ≈ $0.072, A/B면 $0.144 [계산]. 사람 라벨은 별도. 실행 전 비용을 알리고 승인받는다. 처음에는 후보마다 2~3건으로 오류부터 확인한다.

1. **표본 고정.** 수집 기사에서 유형별로 고르고(실적, 시황, 명단·순위, 단일 기업, 모음 기사 등) article_id 목록을 저장한다. 본문은 `data/` 아래에만 둔다. 이후 프롬프트가 바뀌어도 같은 40건을 쓴다.
2. **기록.** 후보별 3회의 raw와 check 후 결과를 JSONL로 저장한다. 프롬프트 해시, 모델, 파라미터, `system_fingerprint`, 토큰을 같이 남긴다.
3. **지표 계산.** 코드만으로 계산한다.

   | 지표 | 정의 | 기사 단위 |
   |---|---|---|
   | 회사 집합 일치 | 이름 정규화 후 3회 평균 쌍별 Jaccard, 3회 완전 일치 여부 | O |
   | 회사 수 범위 | max − min (5, 5, 1 → 4) | O |
   | 주인공 일치 | is_main 집합 완전 일치 여부 | O |
   | 감성 일치 | 2회 이상 나온 회사의 sentiment·long_term에 % 일치 + Krippendorff alpha(명목, 결측 허용) | O |
   | 규칙 준수 | 코드로 판정: 연도 환각, reason 길이, 키워드 숫자·개수, 기사 내 회사명 | O |
   | 드리프트 | 기준선 대비 회사 집합이 바뀐 기사 수. 기준선 내부 변동과 비교 | O |
   | 비용 | 평균 입력·캐시·출력 토큰 | O |

   회사 없는 기사가 많으면 Jaccard를 1로 처리한다고 명시한다. NEUTRAL이 많으면 alpha가 낮게 나올 수 있으니 % 일치와 라벨 분포를 함께 쓴다. 구간은 기사 단위 부트스트랩으로 구한다(회사 단위로 뽑으면 구간이 과도하게 좁아진다).
4. **판정.** 미리 적어 둔다.
   - 규칙 위반: 코드로 옮긴 규칙은 0이어야 한다.
   - 일치도: 개선:악화 기사 수가 6:0, 8:1, 10:2 이상이면 개선으로 본다. 그 밑이면 "차이 불명"이며 비용·단순성으로 결정한다.
   - 다른 필드 악화가 같은 기준을 넘으면 기각한다.
   - alpha 0.8/0.667은 참고만 한다. 40건에서는 구간이 넓을 수 있다.
5. **질적 확인.** 드리프트가 난 기사를 사람이 읽는다. 변경이 개선인지 악화인지 구분하는 유일한 단계다.
6. **소량 골드.**
   - 범위: 회사 목록과 is_main만 라벨링한다. 감성은 사람도 흔들리므로 이후 단계로 둔다.
   - 대상: 40건 전체 또는 무작위 20건 + 불일치 상위 10건. 불일치 기사만 쓰면 편향되므로 지표는 무작위 부분에서 따로 낸다.
   - 방법: 3회 결과 합집합을 후보로 보여 주되 어느 후보가 몇 번 나왔는지는 숨긴다.
   - 신뢰도: 10건은 2명이 독립 라벨링해 사람 일치도를 낸다.
   - 지표: 회사 단위 정밀도·재현율 + 기사별 완전 일치. 일치도가 올랐는데 골드 재현율이 떨어지면 "일관되게 놓치는" 상태다.
   - 합의는 팀 결정 사항이므로 라벨 규칙을 합의 체크리스트로 남긴다.
7. **고정.** 40건을 `tests/` 회귀 세트로 등록하되 평상시 CI에서는 호출하지 않고 프롬프트 변경 때만 수동 실행한다. 코드 규칙 검사는 저장된 JSONL로 호출 없이 테스트한다.

**구현 규모:** 스크립트 1개와 JSONL로 충분하다. 웹 UI나 추가 프레임워크는 필요할 때 붙인다.

### Gaps
- "구조화 추출에서 일치도가 정확도를 예측한다"를 직접 보여 주는 연구는 못 찾음. 관련 근거는 평가 과제의 정성 관찰과 일반 과제의 상관이다.
- 40건에서 alpha 구간의 실제 폭은 데이터 분포에 달려 있어 사전 수치를 제시하지 않음. 기준선 측정 후 부트스트랩으로 구한다.
- 프롬프트 문구 변경이 구조화 추출 결과를 얼마나 움직이는지 직접 잰 논문은 못 찾음.
- 접속 실패로 원문을 못 읽은 곳: promptfoo 문서 일부, aimspress(Kyyrö), LangChain 레퍼런스, tiny.write.as(필드 순서 실험 원문).
- 라벨링 소요 시간 근거는 없으므로 수치를 제시하지 않음.
