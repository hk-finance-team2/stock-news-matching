# 한국어 뉴스 기업명 → 상장 종목 연결: 별칭·비상장 자회사의 모회사 매핑

조사일: 2026-11-03. 표기 규칙: 출처 링크가 있으면 해당 페이지에서 확인한 내용이고, `[미검증]`은 공식 원문이나 실제 응답으로 확인하지 못한 내용이다. `[직접 확인]`은 이번 조사에서 직접 호출하거나 계산한 결과다. API 키가 없어 DART·data.go.kr 실제 호출은 하지 않았고, 필드는 모두 명세 기준이다.

## 1. 관계·별칭·과거 사명을 얻을 수 있는 무료·공식 데이터는 무엇인가

### Takeaway
모회사-자회사 관계는 DART `otrCprInvstmntSttus`(타법인 출자현황), 그룹 소속은 공정위 `appnGroupAffiList`, 이름·코드 기준표는 DART `corpCode.xml`로 만드는 조합이 가장 현실적이다. 다만 공식 과거 사명 API는 찾지 못했고, 타법인 출자현황은 피출자 회사를 이름으로만 주므로 사람 검수가 필요하다.

### Cited Findings

**DART (공식 개발가이드에서 필드 확인)**

| 용도 | API·엔드포인트 | 핵심 필드 | 근거 |
|---|---|---|---|
| 이름·코드 기준표 | `https://opendart.fss.or.kr/api/corpCode.xml` (Zip 일괄) | `corp_code`, `corp_name`, `corp_eng_name`, `stock_code`, `modify_date` | [고유번호](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019018) |
| 회사별 상세 | `/api/company.json` | `corp_name`, `corp_name_eng`, `stock_name`(상장사는 종목명, 기타 법인은 약식명칭), `stock_code`, `corp_cls`(Y/K/N/E), `jurir_no`(법인등록번호), `bizr_no` | [기업개황](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019002) |
| 출자 관계 | `/api/otrCprInvstmntSttus.json` | `corp_code`(출자사), `inv_prm`(피출자 법인명), `invstmnt_purps`, `trmend_blce_qota_rt`(기말 지분율), `stlm_dt` 등 | [타법인 출자현황](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS002&apiId=2019015) |
| 공시 원문 | `/api/document.xml` (`rcept_no`로 Zip 수신) | 사업보고서 원문 | [공시서류원본파일](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019003) |

- 타법인 출자현황의 요청 인자는 `crtfc_key`, `corp_code`, `bsns_year`(2015년 이후), `reprt_code`(사업보고서 11011 등)다. 응답에는 피출자 회사의 `corp_code`나 종목코드가 없고 `inv_prm` 이름만 있다 — [타법인 출자현황](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS002&apiId=2019015)
- 정기보고서 주요정보 API 30개 목록에 '계열회사'라는 이름의 API는 없다 — [DS002 목록](https://opendart.fss.or.kr/guide/main.do?apiGrpCd=DS002)
- 호출 제한: 상태코드 020은 "요청 제한 초과 (일반적으로 20,000건 이상)"이다. 공식 페이지 문구에는 '일 단위'가 명시돼 있지 않다 — [기업개황](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019002). 제3자 자료는 [일 20,000건](https://apify.com/nexgendata/korea-dart-opendart-filings)과 [일 10,000건](https://mcpservers.org/vi/servers/songhyojun0228/opendart-mcp-server)으로 서로 어긋난다.

**공정위 기업집단포털 (data.go.kr)**

- 사용자가 말한 OPNI는 공정위 대규모기업집단 정보 포털 '오프니'(groupopni.ftc.go.kr)로 보도된 바 있다 — [이투데이](https://www.etoday.co.kr/news/view/133610). 이 기사는 오래된 것으로, 현재 접속 여부는 `[미검증]`이다. 프로그램용 접근은 아래 data.go.kr API를 쓰면 된다.
- `https://apis.data.go.kr/1130000/appnGroupAffiList` (지정된 대규모기업집단 소속회사 조회). 필수 인자는 `ServiceKey`, `pageNo`, `numOfRows`, `presentnYear`(예: 202105)이고 `unityGrupCode`는 선택이다. 응답에 기업집단명, 소속회사명, 법인등록번호, 대표자, 설립일, 계열편입일이 포함된다. 이용허락범위는 "제한 없음" — [15091891](https://www.data.go.kr/data/15091891/openapi.do)
- `https://apis.data.go.kr/1130000/affiliationCompSttusList` (소속회사 개요). 무료, 이용허락범위 제한 없음. 5월 1일 기준 자료이며, 호출 전 `publicYmList`로 가능한 연월을 확인하라고 안내한다 — [15091894](https://www.data.go.kr/data/15091894/openapi.do)
- 기업집단명·코드·동일인·대표회사·계열회사 수를 주는 별도 API가 있다 — [15091886](https://www.data.go.kr/data/15091886/openapi.do). 소속회사 주주현황 API도 있다 — [15091902](https://www.data.go.kr/data/15091902/openapi.do) (이 두 건은 검색 요약으로만 확인)
- 트래픽: 같은 포털의 내부지분 API는 개발계정 10,000건으로 안내한다 — [15093666](https://www.data.go.kr/data/15093666/openapi.do). 소속회사 API 자체의 한도는 확인한 페이지에 없었다.
- 2026년 5월 1일 기준 공시대상기업집단은 102개, 소속회사 3,538개다 — [서울신문](https://newsseoul.co.kr/news/view/1065586216922456)

**KRX·금융위**

- `https://apis.data.go.kr/1160100/GetKrxListedInfoService_V2`: `basDt`, `beginBasDt`, `endBasDt`, `likeSrtnCd`, `crno`, `corpNm`, `itmsNm` 등으로 조회하며, 단축코드·시장구분·종목명·법인등록번호·법인명을 제공한다 — [15094775](https://www.data.go.kr/data/15094775/openapi.do)
- 이 API의 라이선스는 공공누리 제4유형(출처표시, 상업적 이용 금지, 변경 금지)이고, 재배포 금지, 상업 이용은 KRX Data Marketplace 유료 구매라고 안내한다 — [15094775](https://www.data.go.kr/data/15094775/openapi.do)
- KIND는 상장법인 공시와 기업상세정보를 제공한다 — [mKIND](https://apps.apple.com/us/app/-/id642680762). 상호변경 이력을 일괄로 받는 공식 경로는 찾지 못했다.

**Wikidata**

- P749(parent organization)의 역관계는 P355이고, P127(owned by)의 하위 속성이다 — [P749](https://www.wikidata.org/wiki/Property:P749). 데이터는 전부 CC0 — [Wikidata:Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)
- `[직접 확인]` SPARQL로 5개 이름을 조회했다(한국어 라벨 정확 일치, 한국어 라벨이 있는 P749, P414의 P249 한정자). LG CNS만 부모(LG)와 티커(064400)가 나왔다. 하나은행·KB국민카드·포스코이앤씨·DL케미칼은 항목은 있지만 이 조건의 부모·티커가 없었고, 하나은행은 항목이 2개(Q484047, Q11326583) 잡혔다 — [Wikidata Query Service](https://query.wikidata.org/). 표본이 5개뿐이고 부모 라벨을 한국어로 제한했으므로 전체 커버리지 추정치로 쓰면 안 된다.

### Inferences
- **문자열 대신 법인등록번호로 조인할 수 있다.** 공정위 소속회사의 법인등록번호를 DART `company.json`의 `jurir_no`나 금융위 API의 `crno`에 맞추면 그룹 내 상장사가 이름 비교 없이 나온다. 다만 그룹 소속만 알려 주지 어느 상장사가 모회사인지는 알려 주지 않는다.
- **역할 분담:** 타법인 출자현황은 직접 지분 관계(방향·지분율)를, 공정위는 그룹 소속을 맡는다. 둘은 대체재가 아니라 교차검증 관계다.
- **호출량:** 상장사 2,655개의 최근 사업보고서 1건씩이면 약 2,655회로, 어느 쪽 한도(1만·2만)로 봐도 하루에 끝난다. `corpCode.xml`은 1회면 된다.
- **라이선스:** 금융위 API는 변경 금지·재배포 금지 조건이 있으므로 팀 저장소에 원본을 커밋하지 않는 편이 안전하다. 같은 정보(`jurir_no`+`stock_code`)를 DART로도 얻을 수 있어 금융위 API를 꼭 쓸 이유는 적다.
- **과거 사명 우회:** 금융위 API는 기간 조회(`beginBasDt`~`endBasDt`)가 되므로 단축코드별 `itmsNm`·`corpNm` 변화를 비교해 이력을 만들 수 있을 것이다. 제공 기간 깊이는 미확인이다.

| 데이터 | 얻는 것 | 난이도 | 적합도 | 주의 |
|---|---|---|---|---|
| DART `corpCode.xml` | 공식명·영문명·종목코드 | 하 | 높음 | 키 1개, Zip 파싱 |
| DART `company.json` | 약식명칭, 법인등록번호 | 하 | 높음 | 회사당 1회 호출 |
| DART `otrCprInvstmntSttus` | 직접 자회사·지분율 | 중 | 높음 | 피출자사가 이름뿐, 정리·검수 필요 |
| 공정위 `appnGroupAffiList` | 그룹 소속 | 중하 | 높음 | 대기업집단만, 연 1회 기준 |
| Wikidata | 별칭 후보 | 중 | 보조 | 커버리지 불균일 |
| 금융위 API | 일별 종목명 | 중 | 보조 | 공공누리 4유형 |

### Gaps
- OpenDART 공식 이용약관 원문을 확보하지 못했다. 데이터 저작권, 재배포, 일 단위 한도는 `[미검증]`이다. 제3자 페이지의 "[약관 §5 사용자별 키](https://apify.com/nexgendata/korea-dart-opendart-filings)" 주장도 원문 미확인이다.
- `inv_prm`의 실제 표기 품질(㈜ 포함 여부, 해외법인 비중)과 소액 출자 생략 여부는 실제 응답을 봐야 안다.
- 공정위 API의 XML 세부 태그명은 활용가이드 문서를 받아 확인해야 한다.
- 상호변경 공시를 DART 공시검색 API로 안정적으로 걸러낼 수 있는지 확인하지 못했다.

## 2. 한국어 기업명은 어떻게 정규화하고, 공개된 별칭 목록은 있는가

### Takeaway
규칙 정규화는 공백·법인 표기·대소문자까지만 하고, POSCO↔포스코 같은 영한 변환은 음차 알고리즘 대신 별칭표로 처리한다. 약칭·별칭까지 담은 공개 한국 종목 사전은 찾지 못했으므로 직접 만들어야 한다.

### Cited Findings
- 미국 금융 뉴스 파이프라인(기사 5,530건)은 비교 전에 소문자화와 일반 접미사 제거를 수행한다. 문자열로 풀 수 없는 Google→Alphabet 같은 경우는 자주 실패하는 이름을 모니터링해 사람이 별칭을 추가한다 — [Dolphin et al. 2024](https://arxiv.org/html/2407.15788)
- `corpCode.xml`이 공식 국문·영문명을 함께 제공한다 — [고유번호](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019018)
- `kr-company-registry`(MIT, CSV·Parquet, 주간 갱신)는 3,949개사의 corp_code·종목코드·사업자번호·법인번호를 연결한다. 상장폐지 1,181개를 포함하지만 페이지에 별칭·과거 사명 포함 여부는 명시돼 있지 않다 — [설명 페이지](https://ronanwrites.vercel.app/manuals/korean-company-identifier-crosswalk). 저장소 본문은 직접 확인하지 못했다.
- 이름→코드 조회 도구로 [go-krx](https://www.github.com/dojinkimm/go-krx), [krx-hj3415](https://pypi.org/project/krx-hj3415/0.1.3), [dartlab](https://awesome.ecosyste.ms/projects/github.com%2Feddmpython%2Fdartlab)이 검색됐으나, 비공식 약칭까지 매핑한다는 설명은 확인하지 못했다.
- **LIG D&A는 미상 건이 아니라 사명 변경 건이다.** LIG넥스원이 2026년 3월 31일 주총에서 사명을 LIG D&A로 변경했다 — [CEO스코어데일리](https://www.ceoscoredaily.com/page/view/2026033113293825368), [아시아경제](https://view.asiae.co.kr/article/2026033111350234682)

### Inferences
- **정규화 순서 제안 (난이도 하, 적합도 높음):**
  1. 유니코드 NFKC로 ㈜ 등 호환 문자를 정리한다.
  2. `주식회사`, `(주)`, `㈜`, `Co., Ltd.`, `Inc.`를 제거한다.
  3. 공백을 제거하고 영문을 대문자로 통일한다(LG CNS = LGCNS).
  4. 정규화된 키로 정확 일치한다.
  - `홀딩스`, `그룹` 같은 말은 **지우지 않는다.** `그룹`을 지우면 그룹 전체 기사가 한 종목으로 합쳐지고, `홀딩스`를 지우면 지주사와 사업회사가 합쳐질 수 있다.
- **영한 변환:** POSCO홀딩스/포스코홀딩스처럼 소수 토큰이 반복되므로 `POSCO→포스코` 수준의 작은 토큰 치환표나 별칭 행으로 충분하다. 범용 음차는 만들지 않는다.
- **별칭표 시드:** `stock_name`, `corp_name`, `corp_eng_name`을 자동 투입하고, 실제 미매칭 이름을 사람이 승인해 더한다. 정규화 충돌(서로 다른 종목이 같은 키)이 생기면 자동 연결하지 않고 목록으로 뽑는다.
- **LIG D&A 교훈:** 사전이 최신이 아니어서 생긴 실패다. `stock_info`의 갱신 시점과 해당 종목 표기를 먼저 확인해야 한다. 종목코드는 [블로그 URL](https://www.mydailybyte.com/littlebit/plus/weekly-report-079550-2026-04-06)에서 079550으로 보이나 `corpCode.xml`로 재확인이 필요하다.
- `kr-company-registry`의 상장 건수(KOSPI 841+KOSDAQ 1,817=2,658)는 현재 사전 2,655개와 비슷해 대조용으로 쓸 만하다. 원자료가 DART이므로 원자료 이용 조건은 저장소의 MIT와 별개로 봐야 한다.

### Gaps
- 한국어 기업명 정규화 규칙의 효과를 비교한 평가 연구는 찾지 못했다. 위 순서는 일반 관행과 이 프로젝트 사례에서 추론한 것이다.
- 정규화 키 충돌 건수는 `stock_info`로 직접 세어 봐야 한다.

## 3. 임베딩·LLM 재순위 엔티티 링킹이 짧은 회사명에 통하는가

### Takeaway
후보 생성 후 LLM이 고르는 구조는 일반 벤치마크에서 효과가 있지만, 짧은 한국어 회사명을 층화해 평가한 근거는 찾지 못했다. 이번 실패 대부분은 유사도가 아니라 지식 부재(관계·사명 변경) 문제이므로, BLINK·ReFinED나 임베딩 도입은 이 프로젝트에 맞지 않는다.

### Cited Findings
- `[직접 확인]` 포스코→포스코엠텍과 현대차그룹→현대차는 모두 3글자 대 5글자에 앞 3글자 일치이므로 Jaro=(1+0.6+1)/3=0.8667, Jaro-Winkler=0.8667+3×0.1×0.1333=0.9067로 **정확히 같은 점수**다. 임계값으로는 원리상 둘을 가를 수 없다.
- 같은 구조의 문제가 다른 곳에서도 보고된다. Neo4j 문서는 이름과 그 확장형은 동일 개체 여부와 무관하게 비슷하게 임베딩된다고 설명한다. all-MiniLM-L6-v2 기준 다른 개체인 "Acme Bank"/"Acme Corp"가 0.76으로, 같은 개체 예시인 "Northwind"/"Northwind Logistics"의 0.73보다 높다. RapidFuzz는 토큰 단위 접두 쌍에 0.90을 주므로 별도 규칙을 둔다고 한다. 임계값은 도메인 라벨로 정하라고 권한다 — [Neo4j](https://neo4j.com/labs/agent-memory/explanation/resolution-deduplication/) (벤더 문서이며 영어 사례, 이 모델은 범용 모델)
- JPMorgan은 규칙·퍼지 기반 SNOAR가 "Acma"→"Acma Global Retail Inc" 같은 사례를 처리하지 못했다고 보고한다 — [JEL](https://arxiv.org/pdf/2411.02695) (검색 요약 기준)
- ReFinED는 Wikipedia/Wikidata 약 3,300만 개체에 링크하고 커스텀 개체 추가와 파인튜닝을 지원한다. Apache-2.0이며 저장소 페이지에 다국어 지원 언급은 없고 예시는 영어다 — [ReFinED](https://github.com/amazon-science/ReFinED)
- EntGPT는 Prior 모델과 BLINK로 상위 10개 후보를 만들고 각 후보의 설명과 "None" 선택지를 줘 LLM이 고르게 한다. 6개 벤치마크 평균 micro-F1은 0.819로 일반 GPT-3.5의 0.749보다 높다. 오류는 주로 선택 단계에서 나왔다고 한다. 환각 감소율 수치는 없다 — [EntGPT](https://ar5iv.labs.arxiv.org/html/2402.06738)
- ARTER는 쉬운 언급은 저비용 링커, 어려운 언급만 LLM으로 보낸다. 전부 LLM을 쓰는 방식과 비슷한 성능에 토큰은 약 절반이고, ReFinED 대비 5/6 데이터셋에서 평균 +2.53%다 — [ARTER](https://arxiv.org/abs/2510.20098)
- LLMAEL은 조정 없는 LLM이 정확한 KB 개체명을 자주 생성하지 못한다고 지적한다 — [LLMAEL](https://arxiv.org/abs/2407.04020). 또한 비슷한 후보명과 많은 후보 수가 LLM을 혼란스럽게 할 수 있다고 한다 — [LLMAEL PDF](https://arxiv.org/pdf/2407.04020) (검색 요약 기준)

### Inferences

| 방법 | 난이도 | 적합도 | 판단 |
|---|---|---|---|
| 정규화 + 별칭 정확 일치 | 하 | 매우 높음 | 1순위, 오연결 위험 최소 |
| 관계표(DART·공정위) | 중 | 높음 | 27건 중 최대 유형(10건)을 직접 겨냥 |
| 퍼지 자동 연결 | 하 | 부적합 | 로컬 테스트와 위 계산이 모두 부정적 |
| 퍼지 후보 + LLM 검증 | 중 | 조건부 | 미매칭만 호출, 오타·표기 흔들림에 한정 |
| 임베딩 후보 생성 | 중상 | 낮음 | 정답 라벨 없이 임계값 설정 불가, 관계 지식 없음 |
| BLINK·ReFinED | 상 | 부적합 | KB·언어가 다르고 재학습 부담, 마감 2026-11-20에 무리 |

- 27건에 대입하면 퍼지·임베딩이 맞힐 대상은 거의 없다. 10건은 관계표 문제, 3건(LG CNS, 현대차그룹, LIG D&A)은 별칭·사명 문제, 14건(해외·비상장, 공공기관)은 **연결하지 않는 것이 정답**이다.
- 따라서 '미매칭률'을 목표로 삼으면 안 된다. 14건은 줄어들 수 없는 값이고 억지로 줄이면 오연결이 된다.
- 정답 라벨이 없어 임계값을 튜닝할 근거 자체가 없다는 점도 퍼지·임베딩에 불리하다.

### Gaps
- 언급 길이별·한국어 회사명 대상 성능을 층화한 논문은 찾지 못했다. 짧은 이름에 대한 근거는 영어 사례와 위 계산으로부터의 유추다.
- JEL과 LLMAEL PDF의 일부 내용은 검색 요약으로만 확인했고 본문 수치는 검증하지 않았다.

## 4. 기사에서 뽑은 사전 후보를 LLM이 고르게 해야 하는가, 일반어 종목명 오탐은 어떻게 막는가

### Takeaway
기사 전체에 Aho-Corasick을 돌려 곧바로 연결하면 안 되고, 후보로만 쓰는 것이 맞다. 다만 회사명 뉴스에서 효과를 측정한 벤치마크를 찾지 못했으므로, 먼저 비용 없는 사후 대조(LLM 추출명 정규화 + 별칭)를 적용한 뒤 미해결 건에만 LLM 선택을 시험하는 순서를 권한다.

### Cited Findings
- 가장 가까운 사례인 Dolphin et al.의 흐름은 다음과 같다 — [Dolphin et al. 2024](https://arxiv.org/html/2407.15788)
  1. LLM이 회사·티커를 추출한다.
  2. LLM이 회사명과 티커의 등록명을 비교한다.
  3. 불일치 건만 42,000여 개 이름-티커 쌍과 알고리즘으로 매칭한다(최장공통부분문자열, 공유 단어 수, Levenshtein).
  4. LLM이 최상위 후보를 다시 확인하고, 미확인이면 **버린다.**
- 이 시스템에서 데이터 제공사 대비 누락 티커가 없는 기사는 90%다. 수동 검토 결과 '누락'의 상당수는 지나가는 언급을 의도적으로 뺀 것이었다. 숫자 임계값, 모델명, 비용은 논문에 없다 — [같은 논문](https://arxiv.org/html/2407.15788). 제공사 대비 비교이지 정답 라벨 평가는 아니다.
- GDELT는 후보를 LLM이 매번 다르게 생성하면 후단 판별 성능이 무의미해진다고 하고, 정규화 표기가 실행마다 달라지는 사례와 프롬프트의 작은 변화로 결과가 크게 바뀌는 사례를 보고한다 — [GDELT](https://blog.gdeltproject.org/experiments-in-entity-extraction-using-llms-hallucination-how-a-single-apostrophe-can-change-the-results/). 이 프로젝트의 POSCO홀딩스/포스코홀딩스 현상과 같은 유형이며, 지명·인명 사례다.
- LELA는 LLM 생성 후보명을 KB와 대조해, 근거 없는 생성 개체를 직접 받아들이지 않는다 — [LELA](https://arxiv.org/html/2601.05192)
- EntGPT는 후보를 10개로 제한하고 "None"을 제공한다 — [EntGPT](https://ar5iv.labs.arxiv.org/html/2402.06738)
- Aho-Corasick은 다수 패턴을 한 번의 순회로 찾는다 — [Hackernoon](https://hackernoon.com/a-1975-algorithm-still-beats-brute-force-in-modern-keyword-search). `pyahocorasick` 2.3.1은 Python ≥3.10, BSD-3-Clause, Windows 지원이다 — [PyPI](https://pypi.org/project/pyahocorasick/)
- 영어권 뉴스 API 문서도 단순 키워드 검색은 관련 없는 기사를 섞는다고 설명한다 — [NewsCatcher](https://www.newscatcherapi.com/docs/news-api/guides-and-concepts/entity-disambiguation). 기업명 중의성에 문맥(뉴스 말뭉치의 토픽 시그니처)을 활용한 국내 연구도 있다 — [KoreaScience](https://koreascience.or.kr/article/JAKO201609636668929.page?&lang=ko) (트윗 대상, 초록 수준 확인)

### Inferences

**권장 3단계 (Dolphin 구조의 저비용 변형)**

| 단계 | 내용 | LLM 비용 | 난이도 |
|---|---|---|---|
| A | 기존 추출명을 정규화 + 별칭 + 관계표로 사후 연결, 실패 이름 누적·승인 | 0 | 하 |
| B | A에서 실패한 이름만 사전 후보 ≤10개 + "None"으로 LLM 선택 | 미해결 건에만 발생 | 중 |
| C | 기사 Aho-Corasick 후보를 추출 프롬프트에 함께 제공 | 전 기사 입력 토큰 증가 | 중 |

- **A부터 한다.** 저장된 추출 결과에 재실행(replay)만 하면 되므로 추가 비용이 없고 27건으로 즉시 검증된다.
- **C는 효과가 비용을 넘을 때만 한다.** 표기 흔들림(POSCO/포스코)은 C를 쓰면 줄겠지만 A의 별칭으로도 흡수된다. C의 추가 토큰은 후보 수에 비례하므로 건당 $0.0006 예산 대비 증가분을 기사 표본으로 재야 한다. 일부 수치를 추측해 넣지 않았다.
- **환각 처리:** 어떤 경로든 LLM 출력은 후보 ID 또는 None으로 제한하고, 코드에서 사전에 있는 ID인지 검증한다. 후보 밖 답은 버린다.
- **검증 호출 방향:** 미확인 건은 버리는 쪽(precision 우선)으로 둔다.

**일반어 종목명(영광, 대상, 한화) 오탐 처리 (근거가 약한 제안)**
- 한국어는 띄어쓰기로 단어 경계를 잡기 어렵다. '투자 대상', '영광스러운', 통화로서의 '한화'는 부분 문자열로 매칭된다.
- 사전만으로 잡힌 후보는 자동 연결하지 않고, LLM이 회사로 추출하거나 후보 중 선택한 경우만 연결한다.
- 위험 목록(`common_word_stock`)을 만든다. 이름이 짧은 종목(예: 2글자 이하)을 뽑아 사람이 검토하는 것이 시작점이다.
- 위험 목록 종목은 `㈜`, `주가`, `그룹`, 종목코드, 같은 그룹 계열사 동시 언급 같은 문맥 단서 중 하나를 요구한다.
- 후보 수집은 최장 일치를 우선해 '포스코엠텍' 안의 '포스코'를 별도 후보로 내지 않는다. 다만 포스코→포스코엠텍 같은 **접두 일치 연결은 금지한다.**

**정답 라벨 없는 평가**
- 40건을 사람이 표시해 '연결 정밀도'와 사유별 미연결(연결 대상 아님/사전 부족)을 센다. 40건은 구간 추정에는 부족하므로 회귀 확인 수준으로만 해석한다.
- 같은 기사를 재실행했을 때의 일치율은 안정성 지표가 된다. LLM 재호출이 필요하므로 비용을 먼저 산정한 뒤 진행한다.

### Gaps
- 사전 후보 제약 유무의 회사명 뉴스 정확도·환각·토큰 비용을 직접 비교한 연구를 찾지 못했다.
- 한국 증권사·핀테크의 뉴스-종목 매핑 공개 사례나 일반어 종목명 처리 사례도 찾지 못했다.
- `stock_info`에서 일반어와 겹치는 종목의 실제 규모는 미측정이다.

## 5. 자회사 뉴스를 상장 모회사에 연결해야 하는가, 타사는 어떻게 하며 감정·관련도는 어떻게 할인하는가

### Takeaway
연결은 하되 직접 언급과 구분되는 별도 유형으로 저장하고, 모회사의 감정 점수에 그대로 합산하지 않는 편이 안전하다. 네이버·Bloomberg의 실제 규칙과, 자회사→모회사 소유 관계의 할인율 근거는 찾지 못했으므로 숫자 가중치를 근거 있는 값처럼 쓰면 안 된다.

### Cited Findings
- RavenPack은 기사-기업 연결 강도를 0~100 관련도로 제공하며, 75 이상을 유의미한 관련으로 본다는 설명이 있다 — [arXiv 2307.02673](https://arxiv.org/pdf/2307.02673), [WRDS 안내](https://wrds-www.wharton.upenn.edu/documents/1395/RavenPack.pdf) (검색 요약 기준). 언급 사실과 관련도를 분리해 다룬다는 점이 시사점이다. 자회사 기사의 모회사 귀속 규칙은 확인하지 못했다.
- 언급된 회사가 기사의 주제가 아닐 수 있어 별도 확인이 필요하다는 실무 설명이 있다 — [Sacra Docs](https://docs.sacra.com/concepts/news). Dolphin et al.의 수동 검토도 지나가는 언급을 빼는 쪽이 의도적일 수 있음을 보여 준다 — [논문](https://arxiv.org/html/2407.15788)
- 뉴스 영향은 관련 회사로 번진다는 근거가 있다. 공급망 기업에서 공시 전후로 주가와 뉴스 감정의 연관이 관찰된다 — [arXiv 2409.06255](https://arxiv.org/abs/2409.06255v5). 뉴스 동시 언급 네트워크에서도 그룹 감정 연관이 있으나 섹터별로 다르고, 금융 섹터는 부정 감정이 더 크게 번진다는 분석이 있다 — [Man Institute](https://www.man.com/insights/network-effect-in-markets). 모두 공급망·동시 언급이며 **소유 관계나 재벌 계열 연구가 아니다.**
- 네이버 증권은 언론사 종목 기사 수를 집계·순위화한다고 밝혔지만 — [아주경제 2015](https://www.ajunews.com/view/20150415110351825) — 자회사 기사의 귀속 규칙은 공개 자료에서 찾지 못했다.

### Inferences
- **저장 구조 제안 (난이도 하~중):** 기사-종목 연결에 `link_type`을 둔다.
  - `direct`: 상장사 이름이 직접 언급됨.
  - `alias`: 별칭·사명 변경을 통한 직접 연결. `direct`와 동급으로 본다.
  - `subsidiary`: 비상장 자회사를 거친 연결. 경로와 `trmend_blce_qota_rt`, 기준일을 함께 저장한다.
  - `group`: 현대차그룹처럼 그룹 전체를 가리킴.
- **`현대차그룹` 재분류 제안.** 입력 분류는 '별칭 누락'이지만 현대차그룹을 현대차(005380)의 별칭으로 넣으면 기아·현대모비스 기사나 그룹 전체 기사가 현대차로 몰린다. `group` 유형으로 대표회사에 약하게 연결하거나 연결을 보류하는 편이 낫다. 이 건은 팀 결정 사항이다.
- **자회사 연결 조건 초안:** 지분율 과반(예: >50%)이고 상장 주주가 하나로 정해질 때만 자동 연결하고, 나머지는 검수한다. 50%는 경영권의 일반 기준일 뿐 뉴스 영향 근거가 아니다. 소수 지분 지배와 손자회사는 빠지며, 직접 출자 데이터이므로 다단계는 체인을 따라가야 한다.
- **할인:** 근거 있는 수치가 없으므로 감정 점수는 원값을 유지하고, 집계 때 `link_type`별로 분리해 보여 준다. 필터 기본값은 팀이 정한다. 나중에 가중치를 쓰면 근거 없는 설계값임을 표시하고 파라미터로 둔다.
- **27건의 기대치(추정):** 별칭·사명 3건(현대차그룹은 정책 결정 대상)과 관계표 최대 10건을 합쳐 최대 약 13건이 연결 후보이고 14건은 미연결이 정답이다. 10건이 실제 표에서 잡히는지는 DART 호출로 확인해야 한다. 예상 모회사(하나은행→하나금융지주, KB국민카드→KB금융, 포스코이앤씨→POSCO홀딩스, DL케미칼→DL)는 상식 수준 추정이고 데이터로 미확인이다.
- **보통주·우선주:** Dolphin et al.은 CIK가 같은 티커를 함께 붙인다 — [논문](https://arxiv.org/html/2407.15788). 이 프로젝트에서 우선주를 어떻게 처리할지도 같은 문제이므로 결정이 필요하다.

### Gaps
- Bloomberg·네이버 증권의 자회사 뉴스 귀속 규칙 공식 문서를 찾지 못했다. [LSEG Intelligent Tagging 팩트시트](https://www.lseg.com/content/dam/data-analytics/en_us/documents/fact-sheets/intelligent-tagging-fact-sheet.pdf)는 본문 추출에 실패해 내용을 확인하지 못했다.
- 한국 상장 모회사에 대한 자회사 뉴스 효과, 할인율, 지분율별 차이를 측정한 연구를 찾지 못했다. 필요하면 "business group", "tunneling", "group affiliation news"로 SSRN·학술지를 추가 탐색해야 한다.
