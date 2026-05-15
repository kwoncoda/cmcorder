# 2026-05-15 — 어드민 로그인 페이지 SPA fallback 누락 수정

## 목표

운영 컨테이너에서 `GET /admin/login` 진입 시 `{"error":"NOT_FOUND"}` 404 JSON이 반환되는 문제 해결. React Router가 그릴 로그인 화면이 표시되지 않아 본부에서 어드민 진입 불가.

## 만든 것

- `server/app.js` — SPA fallback 제외 prefix 목록(`API_PREFIXES`)에서 `/admin/login`·`/admin/logout` 제거.
- `server/__tests__/static-spa.test.js` — `GET /admin/login` / `GET /admin/logout` SPA fallback 회귀 케이스 2개 추가.

## 한 일

### 원인

- `server/app.js:26` `API_PREFIXES = ['/api/', '/admin/api/', '/admin/login', '/admin/logout', '/healthz']` — SPA fallback에서 제외할 *JSON API* 경로 목록.
- 그러나 `/admin/login`·`/admin/logout`은 **POST = API + GET = SPA 페이지** 이중 목적 경로.
  - `POST /admin/login` — PIN 검증 후 세션 발급 (`server/routes/admin.js:78`).
  - `GET /admin/login` — React Router 로그인 화면 (`src/App.jsx:81`).
- prefix에 들어 있으면 GET 요청도 SPA fallback에서 제외되어, `app.get('*')` fallback → `next()` → 최종 404 JSON 핸들러로 떨어짐.
- 동일 원리로 `/admin/logout` GET도 막혀 있었음 (현재 SPA 라우트 정의는 없지만, 미래 추가 시 동일 버그 발생 여지).

### 수정

```diff
- const API_PREFIXES = ['/api/', '/admin/api/', '/admin/login', '/admin/logout', '/healthz'];
+ const API_PREFIXES = ['/api/', '/admin/api/', '/healthz'];
```

**POST API 동작 영향 없음:** `app.use(adminRoutes(db))` 가 SPA fallback보다 먼저 등록(`server/app.js:66`)되므로, `POST /admin/login` 요청은 라우터에서 먼저 매칭되어 fallback까지 도달하지 않음.

### 회귀 테스트 추가

`server/__tests__/static-spa.test.js`에 2케이스 추가:

```js
it('GET /admin/login → 200 HTML (POST API와 공존하는 SPA 페이지)', ...)
it('GET /admin/logout → 200 HTML (POST API와 공존하는 SPA 경로)', ...)
```

기존 `/admin/api/nonexistent → 404 JSON` 케이스가 같은 파일에 존재해 JSON API 경계는 그대로 보호됨.

## 테스트 결과

### 단위·통합 (vitest)

```
Test Files  90 passed (90)
     Tests  939 passed (939)
  Duration  47.79s
```

전체 939/939 통과 — 추가 2케이스 포함. 회귀 없음.

### 운영 컨테이너 실거동

도커 이미지 재빌드(`docker compose up -d --build`) 후:

```
$ curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:3000/admin/login
200 text/html; charset=UTF-8
```

이전 응답(`404 application/json`) → 정상 SPA HTML(`200 text/html`) 전환 확인. 브라우저에서 `/admin/login` 진입 시 React가 그린 PIN 입력 폼이 정상 표시됨.

## 영향 범위

- `GET /admin/login` / `GET /admin/logout` 만 동작 변경 — 그 외 경로는 영향 없음.
- 운영 시 `.env`의 `DEFAULT_ADMIN_PIN=784202`로 PIN 입력 → 로그인 가능.

## 다음에 할 것

- 실제 브라우저로 PIN 로그인 → `/admin/dashboard` 진입까지 흐름 점검 (D-1 리허설 시 자동 포함됨).
