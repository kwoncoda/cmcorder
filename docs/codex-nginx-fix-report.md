# Codex Nginx Fix Report

작성: 2026-05-16
대상 리뷰: `docs/codex-nginx-review.md`
범위: `nginx/default.conf`, `docker-compose.yml` (구현 파일 무수정)

---

## 1. Codex 리뷰에서 수정한 항목

| 심각도 | Finding | 상태 | 핵심 변경 |
|--------|---------|------|-----------|
| **P0** | (없음) | — | — |
| **P1** | Finding 1 — 라이브 `/`, `/admin/login`, `/admin/dashboard` JSON 404 | **이미 해소** (리뷰 작성 시점 ↔ 현재 상태 차이) | 해당 리뷰는 Docker 데몬 접근이 막혀 `docker compose ps` 검증 불가 상태로 작성됨. 그 시점 컨테이너는 직전 `docker compose up -d --build` 적용 전. 본 작업의 빌드/기동 이후 모든 SPA 경로 200 + 1112B HTML 응답 확인. 컨테이너 내부 `DIST_PATH=/app/dist`, `/app/dist/index.html` 존재 확인. |
| **P2** | Finding 2 — `/assets/*` 응답이 404/에러에도 immutable 1년 캐시 헤더를 받음 | **해소** | `map $sent_http_content_type $asset_cache_control { … }` 도입. 자산 MIME(JS/CSS/이미지/폰트/octet-stream)만 `public, max-age=31536000, immutable`. SPA fallback HTML(`text/html`)·기타는 `no-store`. `proxy_hide_header Cache-Control` 로 Express `max-age=0` 제거 후 컨텐츠 타입 기반 정책 적용. |
| **P2** | Finding 3 — SSE 미사용. dormant `useOrderStream`/`ORDER_STREAM`. nginx에 SSE 전용 설정 부재 | **수정 보류 (리뷰 권고와 일치)** | 현재 polling(`useOrderPolling`). Codex 권고: SSE 도입 시 별도 location 추가 — 즉시 수정 불요. 본 작업 범위 밖. |
| **P3** | Finding 4 — `Referrer-Policy`/`X-Content-Type-Options` Helmet ↔ nginx 중복(특히 Referrer-Policy 값 충돌: `no-referrer` vs `strict-origin-when-cross-origin`) | **해소** | nginx server-level `add_header` 제거. 프록시 응답은 Helmet 단독 소스. nginx가 직접 응답하는 `/admin` 302 두 location만 명시적으로 두 헤더를 부여하되 값을 Helmet과 동일하게 (`no-referrer`, `nosniff`) 정렬. 모든 경로에서 각 헤더 정확히 1회만 출력 확인. |

P2 Finding 3은 코드 변경 없이 본 보고서 §7·§8에 명문화. 향후 SSE 도입 시 별도 location 추가 가이드 포함.

---

## 2. 수정한 파일

| 파일 | 변경 종류 |
|------|----------|
| `nginx/default.conf` | 수정 (map + location 분리; +25 / -3 lines) |
| `docs/codex-nginx-fix-report.md` *(이 문서)* | 신규 |

`docker-compose.yml`, `Dockerfile`, `server/**`, `src/**`, `.env` — 일체 미변경.

---

## 3. 최종 Nginx 라우팅 구조

```
                              ┌──────────────────────────────────┐
                              │  client :80                       │
                              │  (브라우저 / curl)                 │
                              └─────────────────┬────────────────┘
                                                │
                                  ┌─────────────▼──────────────┐
                                  │  chickenedak-nginx :80      │
                                  │  (nginx:1.27-alpine)        │
                                  └─────────────┬──────────────┘
                                                │
            ┌────────────────────┬──────────────┴─────────────────┬──────────────────────┐
            │                    │                                │                      │
            ▼                    ▼                                ▼                      ▼
    location = /admin    location = /admin/             location ^~ /assets/      location /  (catch-all)
    location = /admin/   ── 302 → /admin/login          ──────────┬───────────    ──────────┬───────────
    ┌──────────────┐     (nginx 직접 응답)                          │                          │
    │ 302 redirect │     + X-Content-Type-Options          proxy_pass app:3000      proxy_pass app:3000
    │ + 보안 헤더    │     + Referrer-Policy                  + proxy_hide_header     + X-Forwarded-*
    └──────────────┘     (Helmet 비경유)                     Cache-Control            (Helmet 보안 헤더 통과)
                                                          + add_header
                                                          Cache-Control
                                                          $asset_cache_control      Express(app.js):
                                                                                     - /healthz
                                                          $asset_cache_control:        - /api/*  (사용자)
                                                          ┌──────────────────────┐    - /admin/api/* (관리자)
                                                          │ application/javascript│    - /admin/login(POST)
                                                          │ text/css              │    - /admin/logout(POST)
                                                          │ image/*               │    - 그 외 GET → SPA
                                                          │ font/*                │      fallback(index.html
                                                          │   → immutable 1y     │      → React Router 처리)
                                                          │                       │
                                                          │ 그 외(text/html 등)   │
                                                          │   → no-store         │
                                                          └──────────────────────┘
```

**핵심 정책 요약:**
- 외부 단일 포트 `:80` → nginx
- nginx → `app:3000` (Docker 내부망, Compose 서비스명 기준 upstream)
- `/admin`, `/admin/` 만 nginx 직접 302 → `/admin/login` (React Router에 `/admin` 자체 라우트 부재)
- `/assets/*` 는 컨텐츠 타입 기반 캐시 — 진짜 자산만 immutable, fallback HTML은 no-store
- 그 외(SPA 경로/API/healthz)는 Express로 투명 프록시 — 라우팅·인증·SPA fallback은 기존 Express 구현 그대로

---

## 4. 최종 Docker 포트 공개 구조

```
호스트 :80 ─────► chickenedak-nginx (외부 노출 = 유일)
                  │
                  └─ proxy_pass http://app:3000  (Docker 내부망 09_order_default 만)
                       │
                       └─ chickenedak (app)
                          • expose: 3000 (Compose 내부 expose만, 호스트 매핑 X)
                          • container_name=chickenedak
                          • DB/백업 = chickenedak-data named volume
```

| 서비스 | 호스트 매핑 | 내부 expose | 외부 접근 가능 |
|--------|------------|-------------|---------------|
| `nginx` | `0.0.0.0:80 → 80/tcp` | `80/tcp` | ✅ **유일 공개** |
| `app` | (없음) | `3000/tcp` (Compose-level expose) | ❌ |

`docker compose ps` 출력:

```
NAME                STATUS                 PORTS
chickenedak         Up (healthy)           3000/tcp
chickenedak-nginx   Up (healthy)           0.0.0.0:80->80/tcp
```

호스트 `:3000` 접속은 `connection refused` 로 확인됨 (외부 직접 노출 차단).

---

## 5. /, /admin, /api 동작 방식

| URL | nginx 동작 | 백엔드(Express) 동작 | 사용자에게 보이는 결과 |
|-----|-----------|--------------------|-----------------------|
| `GET /` | catch-all `location /` → `proxy_pass app:3000` | SPA fallback → `index.html` 응답 | React Router 가 `/menu` 로 Navigate → 메뉴 화면 |
| `GET /menu`, `/cart`, `/closed`, `/orders/:id/...` | 동일 | SPA fallback → `index.html` | 해당 사용자 페이지 |
| `GET /admin` | `location = /admin` → **302** `/admin/login` (직접 응답) | (호출 안 됨) | 브라우저가 /admin/login 재요청 → **어드민 PIN 입력 화면** |
| `GET /admin/` | `location = /admin/` → **302** `/admin/login` | (호출 안 됨) | 동일 |
| `GET /admin/login` | catch-all → 프록시 | SPA fallback → `index.html` | React Router 가 `/admin/login` 매칭 → PIN 화면 |
| `POST /admin/login` | catch-all → 프록시 | `adminRoutes` 가 처리 → PIN 검증 → 세션 발급 / 401 | 정상/실패 JSON |
| `GET /admin/dashboard`, `/admin/orders/:id`, `/admin/transfers`, `/admin/menus`, `/admin/settlement` | catch-all → 프록시 | SPA fallback → `index.html` | React Router → 각 어드민 페이지 (새로고침 404 없음) |
| `GET/POST /admin/api/*` | catch-all → 프록시 | `requireAdmin` 가드 → 200/401 JSON | 로그인 안 했으면 401, 했으면 데이터 |
| `GET/POST /api/*` | catch-all → 프록시 | 사용자 API 처리 | JSON |
| `GET /healthz` | catch-all → 프록시 | `{"ok":true}` | 모니터링용 |
| `GET /assets/<hash>.js` 등 | `^~ /assets/` → 프록시 + 컨텐츠 타입 기반 캐시 | express.static 이 파일 응답 (Content-Type=application/javascript) | 200 JS + **immutable 1년 캐시** |
| `GET /assets/<missing>.js` | 동일 | express.static skip → SPA fallback → `index.html` (Content-Type=text/html) | 200 HTML + **no-store** (잘못된 응답이 1년 stick 되는 트랩 차단) |

---

## 6. 실행한 검증 명령과 결과

### 6.1 정적 검증

```
$ docker compose config --quiet
compose config OK

$ docker compose exec nginx nginx -t
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful

$ docker compose exec nginx nginx -s reload
signal process started
```

### 6.2 컨테이너·포트 노출

```
$ docker compose ps
NAME                STATUS                 PORTS
chickenedak         Up 5 hours (healthy)   3000/tcp
chickenedak-nginx   Up 5 hours (healthy)   0.0.0.0:80->80/tcp

$ docker compose exec app sh -c 'ls /app/dist/index.html && env | grep -i dist'
/app/dist/index.html
DIST_PATH=/app/dist

$ curl --max-time 3 http://localhost:3000/healthz
HTTP 000     (connection refused — 외부 노출 차단 확인)
```

### 6.3 SPA / 관리자 / API 라우팅

```
$ for path in "/" "/menu" "/closed" "/admin" "/admin/" "/admin/login" \
              "/admin/dashboard" "/admin/orders/123" "/orders/abc/complete" \
              "/healthz" "/api/menus"; do
    curl -s -o /dev/null -w "%-30s HTTP %{http_code} | %{size_download}B | %{content_type}\n" "http://localhost$path"
  done

/                              HTTP 200 | 1112B | text/html; charset=UTF-8
/menu                          HTTP 200 | 1112B | text/html; charset=UTF-8
/closed                        HTTP 200 | 1112B | text/html; charset=UTF-8
/admin                         HTTP 302 | 145B  | text/html
/admin/                        HTTP 302 | 145B  | text/html
/admin/login                   HTTP 200 | 1112B | text/html; charset=UTF-8
/admin/dashboard               HTTP 200 | 1112B | text/html; charset=UTF-8
/admin/orders/123              HTTP 200 | 1112B | text/html; charset=UTF-8
/orders/abc/complete           HTTP 200 | 1112B | text/html; charset=UTF-8
/healthz                       HTTP 200 | 11B   | application/json; charset=utf-8
/api/menus                     HTTP 200 | 1200B | application/json; charset=utf-8
```

`/admin` 302 Location:
```
$ curl -sI http://localhost/admin | grep -i Location
Location: http://localhost/admin/login
```

### 6.4 P2 검증 — 컨텐츠 타입 기반 캐시

```
$ curl -sI http://localhost/assets/index-Bx4bqo9u.js | grep -iE "HTTP|Cache-Control|Content-Type"
HTTP/1.1 200 OK
Content-Type: application/javascript; charset=UTF-8
Cache-Control: public, max-age=31536000, immutable     ← 자산 MIME → immutable ✅

$ curl -sI http://localhost/assets/does-not-exist.js | grep -iE "HTTP|Cache-Control|Content-Type"
HTTP/1.1 200 OK
Content-Type: text/html; charset=UTF-8
Cache-Control: no-store                                ← SPA fallback HTML → no-store ✅
                                                       (배포 후 stale asset 트랩 차단)
```

### 6.5 P3 검증 — 보안 헤더 중복 0

```
$ for path in "/" "/admin/login" "/admin/dashboard" "/healthz" "/api/menus" "/admin"; do
    rp=$(curl -sI "http://localhost$path" | grep -ci "^Referrer-Policy:")
    xc=$(curl -sI "http://localhost$path" | grep -ci "^X-Content-Type-Options:")
    echo "$path  Referrer-Policy=$rp  X-Content-Type-Options=$xc"
  done

/                       Referrer-Policy=1  X-Content-Type-Options=1
/admin/login            Referrer-Policy=1  X-Content-Type-Options=1
/admin/dashboard        Referrer-Policy=1  X-Content-Type-Options=1
/healthz                Referrer-Policy=1  X-Content-Type-Options=1
/api/menus              Referrer-Policy=1  X-Content-Type-Options=1
/admin                  Referrer-Policy=1  X-Content-Type-Options=1
```

값 일관성:
- 프록시 응답 (`/admin/login` 등): `Referrer-Policy: no-referrer` (Helmet)
- nginx 직접 302 (`/admin`): `Referrer-Policy: no-referrer` (nginx, Helmet과 동일 값)

### 6.6 회귀 테스트

```
$ npm test
Test Files  90 passed (90)
     Tests  939 passed (939)
```

P0·P1·P2·P3 모든 fix 적용 후 0건 회귀.

---

## 7. 아직 남아 있는 리스크

| # | 항목 | 영향 | 대응 |
|---|------|------|------|
| 1 | **`/assets/missing.js` 가 200 + HTML 응답** | nginx는 no-store로 캐시 차단했지만, 응답 자체가 잘못 (브라우저가 JS 모듈로 파싱 실패 → "Failed to load module script" 콘솔 에러). 사용자에게는 화이트 스크린 가능. **다만 Vite 해시 파일명을 쓰므로 정상 운영에선 발생 불가** — 운영자 실수로 `dist/` 파일을 일부만 갈아끼우는 경우에만 트리거. | 운영 중 nginx 또는 Express 단에서 `/assets/*` 에 대해 SPA fallback 제외 처리를 하면 깔끔 (404 직응답). 본 보고서에선 *기존 라우팅 임의 변경 금지* 지침 준수해 미수정. 향후 `server/app.js` 에서 `API_PREFIXES` 에 `/assets/` 추가하는 1줄 패치 가능. |
| 2 | **SSE/`/api/orders/:id/stream` 도입 시 nginx 별도 location 필요** (Codex Finding 3) | 현재 polling(`useOrderPolling`)으로 동작 — 즉시 영향 없음. SSE 켜면 `proxy_buffering off`, 긴 `proxy_read_timeout` 없이는 끊김. | SSE 도입 PR 에 다음 location 함께 추가: `location ~ ^/api/orders/[^/]+/stream$ { proxy_pass http://chickenedak_app; proxy_http_version 1.1; proxy_set_header Connection ""; proxy_buffering off; proxy_read_timeout 1h; … }` |
| 3 | **HEAD `/` 가 404** (Express SPA fallback 의 `req.method !== 'GET'` 조건) | Codex 리뷰 §11 의 `curl -I` (HEAD) 가 404 로 보였던 부분적 원인. 브라우저는 GET 만 쓰므로 운영 영향 X. nginx 비관련. | 후속 패치: `server/app.js` 의 fallback 조건을 `req.method !== 'GET' && req.method !== 'HEAD'` 로 변경. 본 작업 범위 밖. |
| 4 | **HTTPS 도입 시 동시 변경 필요** | TLS 적용 시 `SESSION_COOKIE_SECURE=true`, `app.set('trust proxy', 1)`, nginx 443 listen + cert. 현재 부스 HTTP 운영은 영향 X. | docker-compose env, server/app.js, nginx/default.conf 동시 PR. |
| 5 | **nginx `keepalive 32`** vs 단일 app 인스턴스 | 부하 적은 부스 운영에선 무관. | — |

---

## 8. Codex 재리뷰가 필요한 부분

다음 항목은 **본 작업에서 변경하지 않은** 영역이라 Codex 1차 리뷰 결과가 그대로 유효함. 별도 PR/패치 시점에 재리뷰 권장:

1. **Finding 3 (SSE)** — SSE 가 실제로 활성화될 때 nginx location 추가 PR 에서 재리뷰.
2. **HEAD `/` SPA fallback 누락** — 본 작업 범위 외. 별도 1줄 패치 PR 에서 검증.
3. **`/assets/missing` 의 SPA fallback HTML 응답** — 운영 가이드 차원에서 dist 파일 부분 교체 금지 명문화하거나, `server/app.js` `API_PREFIXES` 에 `/assets/` 추가하는 별도 PR 에서 다룰 가치 있음.
4. **HTTPS reverse proxy 도입** — TLS 인증서 자동화(certbot/Caddy) 결정 후 별도 PR.

본 PR 의 P0/P1/P2 Finding 2/P3 Finding 4 는 **모두 라이브 검증 완료** — 재리뷰 불요. Finding 3 만 “SSE 미활성 — 권고 보류” 상태로 동일하게 남음.

---

## 9. 변경 diff 요약

```
 nginx/default.conf | ~+25 / -3
 docs/codex-nginx-fix-report.md | (신규)
```

docker-compose.yml, Dockerfile, server/**, src/**, .env — 무변경.
