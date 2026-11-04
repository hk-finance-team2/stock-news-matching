# 프론트(React)를 Docker 상자로 포장하는 설명서 — 시연·통합용
# 사용: 저장소 최상위에서 docker compose --profile full up -d --build → http://localhost:5173
# 개발할 때는 지금처럼 npm run dev 를 쓰면 됨 (이 파일은 "한 번에 켜기"용)

# ---------- 1단계: 빌드 (Node 24 LTS 로 dist 만들기, frontend-ci 와 같은 버전) ----------
FROM node:24.22.2-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- 2단계: 제공 (nginx 가 dist 를 보여 주고 /api 는 백엔드로 넘김) ----------
FROM nginx:1.30.6-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
