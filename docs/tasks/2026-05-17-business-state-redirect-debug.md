# 2026-05-17 — 어드민 OPEN 후 사용자 측 `/closed` 잔존 문제 진단·복구

## 목표

D-3 시점(2026-05-17, D-day 5/20) 어드민에서 "장사 시작" 클릭 → DB는 정상 OPEN 으로 전환되었으나 사용자가 `localhost` 접속 시 *여전히 `/closed` 페이지*("아직 영업 시작 전이에요")가 표시되어 새로고침해도 메뉴 화면이 뜨지 않는 증상을 진단하고, **D-1 리허설(5/19) 전까지 재발 안전망까지 적용**.

## 만든 것 / 변경한 것

| 파일 | 종류 | 요지 |
|------|------|------|
| `src/components/layouts/CustomerLayout.jsx` | 수정 | `businessQuery.refetch` 30초 폴링 + OPEN 전환 시 `/closed` → `/menu` reverse redirect 추가 (+10 / -1 lines, 92 → 101 줄, §3.5 ≤120 룰 준수) |
| `docs/tasks/2026-05-17-business-state-redirect-debug.md` | 신규 | 이 작업 로그 |

`server/*`, `nginx/default.conf`, `docker-compose.yml`, ADR/구조 문서 — 일체 무수정.

## 한 일 (구체)

### 1. 원인 진단 — 가설 5개 중 가설 C 확정

사용자 증상: 어드민 OPEN(영업 중·"오늘 첫 주문 대기 중" 칸반) + 사용자 측 `/closed` 잔존 + 새로고침 무효 + 환경은 단일 `docker compose` 스택.

진단 명령 (실제 출력):

| # | 명령 | 결과 | 의미 |
|---|------|------|------|
| 1 | `curl -s http://localhost/api/business-state` | `{"status":"OPEN","operating_date":"2026-05-20","changed_at":"2026-05-17 08:12:32"}` | DB는 진짜 OPEN. 어드민 POST 효과 정상 영구 저장. |
| 2 | `curl -sI http://localhost/menu` | `HTTP/1.1 404 Not Found` (JSON) | HEAD 메서드라 `server/app.js:79` `req.method !== 'GET'` 조건 통과 → 최종 404 fallback. *진단 오인 트랩* (운영 영향 X). |
| 3 | `curl -s -o /dev/null -w "%{http_code}" http://localhost/menu` (GET) | `HTTP 200 | 1112B | text/html` | 실제 SPA fallback 정상. |
| 4 | `curl -s -o /dev/null http://localhost/` | `HTTP 200 | 1112B | text/html` | 동일. |
| 5 | `docker compose exec -T app ls -la /app/dist/index.html` | `1112 May 17 08:08 index.html` | dist 누락 가설 기각. |
| 6 | `docker compose ps` | 두 컨테이너 모두 `(healthy)`, 25 min uptime | 인프라 정상. |

→ **서버·DB·nginx·dist 모두 정상**. 가설 A(DB 실제 CLOSED) / B(컨테이너 desync) / C-sub(dist 누락) 모두 기각. 진단 (2) HEAD 404가 미들웨어 302로 *오인되기 쉬운 트랩*이었음(Codex nginx review Risk #3과 동일).

### 2. 진짜 root cause — CustomerLayout 단방향 가드

코드 분석:

- `src/store/businessState.js:14-58` — zustand `persist` middleware 없음. localStorage 캐시 무관.
- `src/components/layouts/CustomerLayout.jsx:41-46` (수정 전) — `if (status === 'CLOSED' && !isClosedAllowedPath(pathname)) navigate('/closed')` *단방향*. **OPEN 전환 시 `/closed` 잔존 사용자를 끌어내는 reverse redirect 부재**.
- `isClosedAllowedPath('/closed') === true` (line 22-24) — `/closed` 경로 자체는 모든 상태에서 통과 → status가 OPEN 으로 동기화되어도 ClosedPage 계속 표시.
- `useApi(..., [])` deps=[] (line 35) — 마운트 1회만 fetch. 어드민이 다른 탭에서 OPEN 클릭해도 사용자 측 자동 감지 없음.
- 서버 `businessStateGuard` (server/middleware/business-state.js:36-44) — OPEN 일 땐 `next()` 통과만 함. `/closed` URL을 가진 사용자에게 강제로 다른 곳으로 보내지 않음.

재현 시나리오:
1. 5/17 08:08 컨테이너 첫 부팅 → DB 초기 시드 CLOSED.
2. 사용자가 `localhost` 접속 → 미들웨어 302 `/closed` → 브라우저 URL `/closed` 고정 → ClosedPage SPA 렌더.
3. 5/17 08:12 어드민 "장사 시작" 클릭 → DB OPEN 전환 (`changed_at: 2026-05-17 08:12:32` 확정).
4. 사용자가 그대로 새로고침 → URL `/closed` 유지 → SPA가 `/closed` 매칭 → ClosedPage 그대로 표시. **status는 OPEN으로 sync 됐지만 reverse redirect 부재로 페이지 전환 없음.**

### 3. 수정 — CustomerLayout 양방향 가드 + 폴링

`src/components/layouts/CustomerLayout.jsx:33-58`:

```jsx
const businessQuery = useApi(
  ({ signal }) => apiFetch(API.BUSINESS_STATE, { schema: BusinessStateSchema, signal }),
  [],
);
const { refetch: refetchBusinessState } = businessQuery;
useEffect(() => {
  if (businessQuery.data?.status) syncFromServer(businessQuery.data);
}, [businessQuery.data, syncFromServer]);

// 어드민 OPEN/CLOSED 전환을 사용자 측이 ≤30s 내 감지 (D-day 안전망).
useEffect(() => {
  const id = setInterval(() => refetchBusinessState(), 30_000);
  return () => clearInterval(id);
}, [refetchBusinessState]);

useEffect(() => {
  if (!businessQuery.data) return;
  if (status === 'CLOSED' && !isClosedAllowedPath(location.pathname)) {
    navigate('/closed', { replace: true });
    return;
  }
  // OPEN 전환 시 /closed 에 머문 사용자는 자동으로 /menu 진입.
  if (status === 'OPEN' && location.pathname === '/closed') {
    navigate('/menu', { replace: true });
  }
}, [businessQuery.data, status, location.pathname, navigate]);
```

핵심:
- `refetchBusinessState` 는 `useApi` 의 `useCallback` 안정 reference (`src/hooks/useApi.js:77-79`) — setInterval cleanup churn 없음.
- 30s 폴링 — 부스 규모(50명/h)에서 부하 무시 가능. ADR-023 nginx upstream 한 번 더 통과만 추가.
- Reverse redirect — `isClosedAllowedPath` 우회 X (단순 OPEN + `/closed` 명시 매칭), 다른 허용 경로(`/map`, `/orders/:id/...`)는 그대로 머묾.

### 4. 검증

```
$ npm run lint
✖ 3 problems (0 errors, 3 warnings)   # 기존 unused eslint-disable, 본 변경 무관

$ npm test
Test Files  90 passed (90)
     Tests  939 passed (939)
Duration   112.91s

$ docker compose up -d --build app
Container chickenedak  Recreated · Started

$ until curl -fs http://localhost/healthz > /dev/null; do sleep 2; done
healthy
```

라이브 매트릭스:

| 경로 | HTTP | Size | Content-Type |
|------|------|------|--------------|
| `/api/business-state` | 200 | — | `{"status":"OPEN","operating_date":"2026-05-20","changed_at":"2026-05-17 08:12:32"}` |
| `/` | 200 | 1112B | text/html |
| `/menu` | 200 | 1112B | text/html |
| `/closed` | 200 | 1112B | text/html |

새 SPA 번들 해시: `index-CBNT3Qwc.js` (이전 `index-Bf0b2IUC.js` 갱신).

`changed_at` 변화 없음 → named volume `chickenedak-data` 정상 보존 (ADR-023).

## 테스트 결과

| 단계 | 결과 |
|------|------|
| `npm run lint` | ✓ 0 errors, 3 unused-directive warnings (무관) |
| `npm test` | ✓ 939/939 passed, 90 test files, duration 112.91s |
| `docker compose up -d --build app` | ✓ Recreated · Started, healthy 24s |
| Live curl 매트릭스 (4 routes) | ✓ 모두 200 |
| 새 번들 배포 확인 | ✓ index-CBNT3Qwc.js |
| 브라우저 수동 (사용자) | ⏳ Hard reload (Ctrl+Shift+R) 후 `localhost/closed` 자동 `/menu` 이동 확인 필요 |

## 위반 사항 / 절대 깨지면 안 되는 것

본 수정은 다음 모두 **무수정**:

- ADR-020 Pattern B 가격 계산
- ADR-019 쿠폰 학번 정규식
- ADR-021 학번+이름
- ADR-025 주문 상태 머신
- G13 영업 상태 머신 (도메인·미들웨어·API 무수정 — 클라 측 가드만 양방향화)
- ADR-012 정산 마감 가드
- ADR-023 Docker compose + nginx
- ADR-024 React 18 SPA

§3.5 React 가이드 8조:
- 페이지 ≤120줄: CustomerLayout 92 → 101 줄 ✓
- Zustand 셀렉터 강제 ✓ (변경 없음)
- `useState(() => ...)` 초기화 패턴 ✓ (변경 없음)
- barrel import 차단 ✓ (변경 없음)
- axe-core dev-only ✓ (변경 없음)

## 다음에 할 것

- **D-1 리허설(2026-05-19) 체크리스트 추가** — `docs/operations/d1-rehearsal.md` 에 다음 케이스:
  - "어드민 본부에서 '장사 시작' 클릭 → 사용자 측 *기존 탭*에서 새로고침 없이 ≤30s 내 메뉴 진입 가능" (옵션 1 폴링 검증)
  - "사용자가 `/closed` 페이지에 머무는 중 어드민이 OPEN 으로 전환 → 사용자 탭이 자동 `/menu` 이동" (Reverse redirect 검증)
- **선택**: `useApi` deps에 *옵션으로 `pollInterval`* 추가 후 CustomerLayout 에 setInterval 직접 호출 대신 `useApi(..., [], { pollInterval: 30_000 })` 으로 압축 — D-day 후 별개 PR. 본 사건과 무관.
- **선택**: `server/app.js:79` SPA fallback 조건을 `req.method !== 'GET' && req.method !== 'HEAD'` 로 보완 — `curl -I` 진단 시 404 트랩 차단. Codex nginx review Risk #3. D-day 후 1줄 패치 가치.
- **사용자 안내**: 현재 브라우저 탭에서 Ctrl+Shift+R 으로 새 SPA 번들 적용 → `/closed` 페이지가 즉시 `/menu` 로 자동 이동되는지 확인.
