# 치킨이닭 운영 컨테이너 — multi-stage build.
# - 1단계: Vite로 프론트 빌드 → dist/
# - 2단계: production 의존성만 따로 (node_modules 슬림화)
# - 3단계: node:20-alpine 런타임에 백엔드 코드 + dist + node_modules 조립
# Express는 server/app.js에서 DIST_PATH=/app/dist를 통해 SPA 정적 서빙 + fallback.
# (P0-1 Codex 리뷰 — 2026-05-15 추가)

# ===== 1단계 — 프론트 빌드 =====
FROM node:20-alpine AS frontend-build
WORKDIR /app

# better-sqlite3 네이티브 빌드 fallback용 — Alpine은 musl이라 prebuild 누락 잦음.
# 같은 단계 안에서만 쓰이고 최종 런타임 이미지엔 안 따라가므로 cleanup 불요.
RUN apk add --no-cache python3 make g++

# 의존성 캐시 최적화 — package*.json만 먼저 복사 후 ci
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# 빌드에 필요한 소스만 선택적으로 복사 (서버 코드는 별도 단계에서)
COPY index.html vite.config.js tailwind.config.js postcss.config.js ./
COPY src ./src
COPY public ./public
COPY config ./config

RUN npm run build

# ===== 2단계 — production 의존성만 =====
FROM node:20-alpine AS prod-deps
WORKDIR /app

# 동일 — prod 의존성에도 better-sqlite3가 들어있으므로 빌드 도구 필요.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ===== 3단계 — 런타임 =====
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DIST_PATH=/app/dist

# 백엔드 코드
COPY server ./server

# 프론트 빌드 결과 — Express SPA 정적 서빙용 (server/app.js).
COPY --from=frontend-build /app/dist ./dist

# production node_modules
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./

# SQLite 등 데이터 디렉터리 — docker-compose의 named volume이 마운트
RUN mkdir -p /data && chown -R node:node /data
USER node

EXPOSE 3000

# busybox wget이 node:20-alpine 기본 포함 — 추가 패키지 X
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

CMD ["node", "server/server.js"]
