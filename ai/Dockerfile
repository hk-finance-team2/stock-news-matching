# AI 파트(뉴스 수집·요약·매칭, "다시 생성" 서버)를 Docker 상자로 포장하는 설명서
# 사용: 저장소 최상위에서 docker compose --profile ai up -d --build  (OpenAI 비용이 나가므로 데이터 담당 PC만)
# 같은 상자로 두 가지를 켬 (docker-compose.yml): ai = 자동 수집(loop.py), ai-api = "다시 생성" 서버(api.py)

# AI 파트가 쓰는 Python 3.12 (ai/docs/README.md). slim = 꼭 필요한 것만 든 작은 상자
FROM python:3.12.16-slim
WORKDIR /app

# 출력이 바로바로 로그에 보이게, .pyc 파일을 만들지 않게
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

# 라이브러리 목록부터 설치 → 코드만 바뀌면 이 단계는 재사용되어 빨라짐
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY hk_llm ./hk_llm

# 관리자(root)가 아닌 전용 계정으로 실행 (보안). 로그 폴더만 쓰기 가능하게
RUN useradd --system --create-home app && mkdir -p hk_llm/logs && chown -R app:app hk_llm/logs
USER app

# 기본은 자동 수집. "다시 생성" 서버는 docker-compose.yml 에서 command 로 바꿔 켬
CMD ["python", "-m", "hk_llm.loop"]
