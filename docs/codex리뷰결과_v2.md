# Codex 리뷰 결과 v2 - Claude 수정 검증 + 재리뷰

작성일: 2026-05-15

## 0. 검토 범위와 전제

요청 문서 중 현재 저장소에는 `docs/FEATURE_SPEC.md`, `docs/REACT_BEST_PRACTICES_REVIEW.md`가 없습니다. 따라서 동일 역할로 보이는 `docs/FEATURE_LIST.md`, `docs/tasks/2026-05-14-react-best-practices-review.md`를 함께 확인했습니다.

확인한 필수/대체 문서:

| 문서 | 확인 결과 |
|---|---|
| `docs/PRD.md` | 확인 |
| `docs/FEATURE_SPEC.md` | 없음. `docs/FEATURE_LIST.md`로 대체 확인 |
| `docs/IMPLEMENTATION_PLAN.md` | 확인 |
| `docs/REACT_BEST_PRACTICES_REVIEW.md` | 없음. `docs/tasks/2026-05-14-react-best-practices-review.md`로 대체 확인 |
| `README.md` | 확인 |
| `package.json` | 확인 |
| `docs/codex리뷰결과.md` | 이전 리뷰 기준 확인 |
| `docs/CODEX_REVIEW_FIX_SUMMARY.md` | Claude 수정 요약 확인 |

일부 요구사항은 현재 문서끼리 충돌합니다. 특히 SSE는 PRD/FEATURE_LIST/IMPLEMENTATION_PLAN 일부에서는 필수처럼 남아 있지만 README와 최신 구현은 5초 폴링으로 정리되어 있습니다. PII 자동 삭제도 FEATURE_LIST/PRD에는 자동 삭제로 남아 있으나 운영 문서와 ADR은 수동 절차로 변경되어 있습니다. 이런 항목은 아래에 `확실하지 않음`으로 표시했습니다.

## 1. 검증 명령 결과

| 명령/검증 | 결과 | 비고 |
|---|---:|---|
| `npm test` | 통과 | 다수의 jsdom/axe 경고가 남아 있음: `window.getComputedStyle(elt, pseudoElt)` 미구현 경고, React Router future flag 경고 |
| `npm run build` | 통과 | Vite production build 성공. 메인 JS gzip 약 89.88 kB |
| `npm run test:e2e` | 통과 | 2개 smoke test만 실행됨. 문서의 14개 E2E 시나리오 충족은 아님 |
| production admin login cookie 확인 | 실패성 동작 확인 | `NODE_ENV=production`에서 `/admin/login`은 200을 반환하지만 `Set-Cookie`가 없음 |

production admin login cookie 확인은 `createApp`, `bootstrapDatabase`, `seedAdmin`, `supertest`로 `NODE_ENV=production` 상태에서 직접 확인했습니다. 이 검증은 `server/middleware/admin-auth.js`의 `secure: process.env.NODE_ENV === 'production'` 설정과 Docker/README의 HTTP 접속 안내가 충돌한다는 판단 근거입니다.

## 2. Claude 수정 반영 확인

| 이전 주요 지적 | 현재 상태 | 근거 | 테스트 |
|---|---|---|---|
| Express가 `dist` 정적 파일을 서빙하지 않음 | 구현됨 | `server/app.js:67-80`, `server/server.js:15-23`, `Dockerfile:34-42` | `server/__tests__/static-spa.test.js:46-99` |
| 쿠폰 할인 서버 검증 누락 | 구현됨 | `server/routes/customer.js:105-115`, `server/routes/customer.js:123-151` | `server/routes/__tests__/customer.test.js:181-251` |
| 주문 상세 GET 인증 누락/token 노출 | 대부분 구현됨 | `server/routes/customer.js:162-183`, `server/routes/customer.js:206-229`, `src/pages/customer/CheckoutPage.jsx:64-68`, `src/hooks/useOrderToken.js:23-48` | `server/routes/__tests__/customer.test.js:292-381` |
| 관리자 주문 카드 mapping 오류 | 구현됨 | `src/components/organisms/AdminCardColumn.jsx:37-57` | `src/components/organisms/__tests__/AdminCardColumn.test.jsx` |
| 관리자 변경 API CSRF 누락 | 구현됨 | `server/routes/admin.js:101-107`, `server/middleware/csrf.js:44-70`, `src/api/client.js:111-116` | `server/routes/__tests__/admin.test.js:49-85` |
| 정산 bank total/diff, 쿠폰 반영 | 부분 구현됨 | `src/pages/admin/SettlementPage.jsx:74-96`, `server/domain/settlement.js:72-90` | `src/pages/admin/__tests__/SettlementPage.test.jsx:179-200` |
| 메뉴 가격 수정 | 부분 구현됨 | `src/pages/admin/MenuAdminPage.jsx:77-89`, `server/routes/admin.js:126-145` | `src/pages/admin/__tests__/MenuAdminPage.test.jsx:159-173` |
| README/구현 기술 불일치 | 부분 수정됨 | `README.md`, `package.json` | `package.json`에는 `react-hook-form` 없음. 단 `docs/IMPLEMENTATION_PLAN.md:307`, `423`, `601`, `636`, `989`에는 여전히 `react-hook-form` 언급이 남아 있음 |

결론: Claude 수정으로 이전 P0 상당수는 실제로 해결되었습니다. 다만 새로 확인한 production session cookie 문제와 `transfer-report` 인증 누락은 여전히 P0입니다.

## 3. 요구사항별 구현 여부 표

| 요구사항 | 문서 기준 | 구현 여부 | 실제 코드 근거 | 테스트 상태 | 우선순위 |
|---|---|---|---|---|---|
| Docker/운영 배포에서 웹앱 제공 | `README.md`, `Dockerfile`, `docs/IMPLEMENTATION_PLAN.md` | 구현됨 | `server/app.js:67-80`, `server/server.js:15-23`, `Dockerfile:34-42` | 있음: `server/__tests__/static-spa.test.js:46-99` | 완료 |
| 운영 모드 관리자 로그인 세션 | Docker/README의 HTTP 접속 흐름 | 미흡 | `docker-compose.yml:15-20`은 `NODE_ENV=production`, `docs/operations/admin-card.md:10`은 `http://localhost:3000/admin/login`, `server/middleware/admin-auth.js:20-33`은 production에서 secure cookie, `server/app.js`에는 `trust proxy` 설정 없음 | 없음: production secure-cookie 회귀 테스트 없음 | P0 |
| 주문 생성 쿠폰 할인 검증 | PRD/주문 총액 서버 검증 | 구현됨 | `server/routes/customer.js:105-151` | 있음: `server/routes/__tests__/customer.test.js:181-251` | 완료 |
| 주문 조회 인증 및 token 비노출 | `docs/API_DRAFT.md`, `docs/USER_FLOW.md` | 구현됨 | `server/routes/customer.js:162-183`, `server/routes/customer.js:206-229`, `src/hooks/useOrderToken.js:23-48` | 있음: `server/routes/__tests__/customer.test.js:292-381` | 완료 |
| 무통장 입금자 정보 보고 인증 | `docs/API_DRAFT.md:215-232`, `docs/FEATURE_LIST.md:109-110`, `docs/USER_FLOW.md:180-188` | 미구현 | `server/routes/customer.js:185-197`가 token/order owner 확인 없이 `orderId`만으로 갱신, `server/repositories/order-repo.js:173-190`, `src/pages/customer/TransferPage.jsx:47-50`도 token 없이 POST | 없음: 성공/필드 검증만 있음. `server/routes/__tests__/customer.test.js:390-425`, `src/pages/customer/__tests__/TransferPage.test.jsx:110-128` | P0 |
| 사용자 주문 상태 실시간 갱신 | `docs/PRD.md`, `docs/FEATURE_LIST.md`, `docs/IMPLEMENTATION_PLAN.md`는 SSE 언급. README/최신 일부 문서는 polling | 확실하지 않음 | 서버 SSE route 없음. `server/routes/customer.js:14` 주석은 SSE future, `src/pages/customer/StatusPage.jsx:7`, `53-58`은 `useOrderPolling`, `src/hooks/useOrderPolling.js:74-112`는 5초 polling | polling 테스트는 있음: `src/hooks/__tests__/useOrderPolling.test.jsx:50-201`. 서버 SSE 통합 테스트는 없음 | P1 |
| 주문 상태 페이지 인증 유지 | `docs/API_DRAFT.md`, `docs/USER_FLOW.md` | 구현됨 | `src/hooks/useOrderToken.js:23-48`, `src/hooks/useOrderPolling.js:92-99` | 있음 | 완료 |
| 영업 종료 시 사용자 GET 경로 redirect | `docs/FEATURE_LIST.md:248`, `docs/API_DRAFT.md:287-307` | 부분 구현 | 서버 middleware는 GET 통과: `server/middleware/business-state.js:15-18`. SPA layout에서 client redirect: `src/components/layouts/CustomerLayout.jsx:40-56` | SPA 테스트만 있음: `src/components/layouts/__tests__/CustomerLayout.test.jsx:149-168`. 서버 redirect 테스트 없음 | P1 |
| 영업 종료 시 사용자 변경 API 차단 | `docs/API_DRAFT.md:287-307` | 구현됨 | `server/middleware/business-state.js:11-27` | 있음: `server/middleware/__tests__/business-state.test.js` | 완료 |
| 관리자 주문 상태 변경 | 관리자 대시보드 요구사항 | 구현됨 | `server/routes/admin.js`, `src/pages/admin/DashboardPage.jsx`, `src/components/organisms/AdminCardColumn.jsx:37-57` | 있음 | 완료 |
| 관리자 주문 카드 메뉴/옵션 표시 | 이전 리뷰 지적 | 구현됨 | `src/components/organisms/AdminCardColumn.jsx:37-57` | 있음 | 완료 |
| 메뉴 CRUD: 이름/가격/분류/이미지 | `docs/FEATURE_LIST.md:184` | 부분 구현 | `src/pages/admin/MenuAdminPage.jsx:77-99`은 가격/soldOut/recommended 중심. `server/routes/admin.js:126-145`는 `GET /menus`, `POST /menus/:id/toggle`만 제공. 생성/삭제/이름/분류/이미지 수정 endpoint 없음 | 가격 수정 테스트만 있음: `src/pages/admin/__tests__/MenuAdminPage.test.jsx:159-173` | P1 |
| 추천/인기 TOP3 + 판매 수 표시 | `docs/FEATURE_LIST.md:56`, `docs/FEATURE_LIST.md:237` | 부분 구현 | `server/domain/popularity.js:17-39`는 recommended/fallback 중심. `src/hooks/useMenuData.js:24-27`은 backend popular API를 쓰지 않고 recommended flags에서 산출. `src/components/organisms/RecommendedBanner.jsx:28-40`은 판매 수 미표시 | 판매 수 테스트 없음. banner 카드 수 테스트만 있음: `src/components/organisms/__tests__/RecommendedBanner.test.jsx:23-34` | P2 |
| 정산: 주문 수/매출/은행 총액/diff | `docs/FEATURE_LIST.md:196` | 구현됨 | `server/domain/settlement.js:52-90`, `src/pages/admin/SettlementPage.jsx:74-96` | 있음: `src/pages/admin/__tests__/SettlementPage.test.jsx:179-200` | 완료 |
| 정산: 메뉴별 판매량/매출, 시간 그래프 | `docs/FEATURE_LIST.md:197` | 미구현 | `src/pages/admin/SettlementPage.jsx:74-108`은 summary/bank/diff/download 중심. `server/domain/settlement.js:52-90`도 메뉴별/시간별 집계 없음 | 없음 | P1 |
| 정산 ZIP 생성 | `docs/FEATURE_LIST.md:199` | 구현됨 | `server/jobs/auto-snapshot.js:78-90`, `src/pages/admin/SettlementPage.jsx:97-108` | 일부 있음 | 완료 |
| 정산 ZIP 히스토리 | `docs/FEATURE_LIST.md:200` | 미구현 | ZIP 다운로드는 있으나 히스토리 조회/목록 UI 없음: `src/pages/admin/SettlementPage.jsx:97-108`, `server/jobs/auto-snapshot.js:78-90` | 없음 | P1 |
| PII 자동 삭제 | `docs/FEATURE_LIST.md:271`, `docs/PRD.md` | 확실하지 않음 | 자동 삭제 job은 없음. `server/jobs`에는 `auto-snapshot.js`만 있음. 반면 `docs/operations/pii-deletion.md:9-12`, `docs/DECISIONS.md:918-923`은 수동 삭제 절차로 변경했다고 명시 | 없음 | P1 |
| POST rate limit | `docs/API_DRAFT.md:654-660` | 미구현 | 서버 middleware/routes에서 rate limiter 확인 안 됨 | 없음 | P2 |
| React code splitting | `docs/tasks/2026-05-14-react-best-practices-review.md`, Appendix D | 구현됨 | `src/App.jsx:26-36` | 일부 간접 테스트: `src/__tests__/appendix-d.test.js` | 완료 |
| Zustand selector 사용 | React best practices | 구현됨 | `src/pages/admin/DashboardPage.jsx:24-27`, `src/pages/customer/CheckoutPage.jsx:22-24` | 일부 있음 | 완료 |
| list item memoization | React best practices | 구현됨 | `src/components/organisms/AdminCardColumn.jsx:48-57` | 있음 | 완료 |
| abort/retry/error hook | React best practices | 구현됨 | `src/api/client.js`, `src/hooks/useApi.js:43-71`, `src/hooks/useGlobalErrorHandler.js` | 있음 | 완료 |
| E2E 14개 시나리오 | `docs/IMPLEMENTATION_PLAN.md:865-869`, `docs/TEST_PLAN.md:479-492` | 미구현 | `tests/smoke.spec.js:11-15`는 smoke 1개이며 `playwright.config.js:6-8`은 Express API 미연동을 명시 | smoke 2개만 있음. API/주문/SSE/Docker E2E 없음 | P1 |

## 4. 우선순위별 주요 오류

### P0

1. 운영/Docker HTTP 환경에서 관리자 세션 cookie가 설정되지 않을 가능성이 큼

근거:

- `docker-compose.yml:15-20`은 `NODE_ENV=production`으로 실행합니다.
- `docs/operations/admin-card.md:10`은 관리자 접속 주소를 `http://localhost:3000/admin/login`으로 안내합니다.
- `server/middleware/admin-auth.js:20-33`은 production에서 session cookie `secure: true`를 사용합니다.
- `server/app.js`에는 reverse proxy 환경에서 secure cookie를 신뢰하기 위한 `app.set('trust proxy', ...)` 설정이 없습니다.
- production 상태 supertest 검증에서 `/admin/login`은 200을 반환했지만 `Set-Cookie`가 없었습니다.

영향:

관리자 로그인 요청은 성공처럼 보이지만 세션이 유지되지 않아 실제 운영/시연 환경에서 관리자 기능을 사용할 수 없을 수 있습니다. localhost에서 브라우저별 예외가 있을 수 있어 일부 환경은 `확실하지 않음`이지만, Docker/HTTP 안내와 production secure cookie 조합은 배포 안정성 관점에서 P0입니다.

테스트 부족:

- production + HTTP + admin login session cookie 테스트 없음
- reverse proxy/HTTPS 배포 가정 테스트 없음

2. 무통장 입금 보고 API가 인증 없이 주문 상태와 입금 정보를 바꿀 수 있음

근거:

- `server/routes/customer.js:185-197`의 `POST /api/orders/:id/transfer-report`는 `orderId`와 body만 사용하고 token을 확인하지 않습니다.
- `server/repositories/order-repo.js:173-190`는 ID 기준으로 depositor/bank/amount/status를 갱신합니다.
- `src/pages/customer/TransferPage.jsx:47-50`도 token 없이 `/api/orders/:id/transfer-report`로 요청합니다.
- 반면 `docs/API_DRAFT.md:215-232`는 `ORDER_AUTH_FAIL` 가능성을 명시하고, `docs/FEATURE_LIST.md:109-110`은 학생/외부 사용자 주문 접근 인증을 요구합니다.

영향:

순차 order id를 추측할 수 있으면 타인의 입금자명/은행/금액을 덮어쓰고 주문 상태를 `TRANSFER_REPORTED`로 바꿀 수 있습니다. 관리자 입금 확인 업무에 직접 영향을 줍니다.

테스트 부족:

- token 없음/잘못된 token일 때 401 또는 403을 반환하는 테스트 없음
- 프론트 transfer report 요청에 token을 포함하는 테스트 없음

### P1

1. E2E 요구사항은 여전히 충족되지 않음

근거:

- `docs/IMPLEMENTATION_PLAN.md:865-869`는 E2E 14개 시나리오 작성/실행을 완료 기준으로 둡니다.
- `docs/TEST_PLAN.md:479-492`도 주문 흐름, SSE, Docker 초기화 등 E2E-01부터 E2E-14를 나열합니다.
- 실제 `tests/smoke.spec.js:11-15`는 단일 smoke test이고 Playwright viewport 2개로만 실행됩니다.
- `playwright.config.js:6-8`은 현재 Vite webServer만으로는 Express route/API 시나리오가 동작하지 않는다고 명시합니다.

2. SSE 요구사항과 실제 구현이 불일치함

근거:

- `docs/PRD.md`, `docs/FEATURE_LIST.md`, `docs/IMPLEMENTATION_PLAN.md`에는 SSE/EventSource 요구가 여러 곳에 남아 있습니다.
- 서버에는 `GET /api/orders/:id/stream` route가 없습니다.
- `server/routes/customer.js:14`는 SSE를 future work로 둡니다.
- `src/pages/customer/StatusPage.jsx:53-58`와 `src/hooks/useOrderPolling.js:74-112`는 5초 polling입니다.

판단:

README와 최신 일부 문서가 polling fallback을 기준으로 삼는다면 구현은 허용 가능합니다. 그러나 PRD/FEATURE_LIST/IMPLEMENTATION_PLAN 원문 기준이면 요구사항 누락입니다. 따라서 상태는 `확실하지 않음`입니다.

3. 영업 종료 GET redirect가 서버 middleware 요구와 다르게 SPA에서만 처리됨

근거:

- `docs/FEATURE_LIST.md:248`, `docs/API_DRAFT.md:287-307`은 user GET path redirect middleware를 요구합니다.
- `server/middleware/business-state.js:15-18`은 GET 요청을 통과시킵니다.
- 실제 redirect는 `src/components/layouts/CustomerLayout.jsx:40-56`에서 `/api/business-state` 조회 후 client-side로 수행합니다.

영향:

JS 실행 전 짧은 노출, 비-JS/느린 API 상황, 서버 레벨 동작 문서와의 불일치가 남습니다.

4. 관리자 메뉴 CRUD가 가격/품절/추천 중심으로만 구현됨

근거:

- `docs/FEATURE_LIST.md:184`는 이름·가격·분류·이미지 CRUD를 요구합니다.
- `src/pages/admin/MenuAdminPage.jsx:77-99`은 가격 수정, soldOut, recommended 중심입니다.
- `server/routes/admin.js:126-145`는 `GET /menus`, `POST /menus/:id/toggle`만 제공합니다.

5. 정산 메뉴별/시간별 분석과 ZIP 히스토리가 없음

근거:

- `docs/FEATURE_LIST.md:197`은 메뉴별 판매량/매출, 시간 그래프를 요구합니다.
- `docs/FEATURE_LIST.md:200`은 ZIP 히스토리를 요구합니다.
- `src/pages/admin/SettlementPage.jsx:74-108`은 summary/bank/diff/close/download 중심입니다.
- `server/domain/settlement.js:52-90`도 메뉴별/시간별 집계가 없습니다.

6. PII 자동 삭제 요구사항은 문서끼리 충돌함

근거:

- `docs/FEATURE_LIST.md:271`은 cron/startup task 기반 PII 자동 삭제를 요구합니다.
- 구현에는 자동 cleanup job이 없습니다.
- 반면 `docs/operations/pii-deletion.md:9-12`, `docs/DECISIONS.md:918-923`은 자동 삭제 대신 수동 절차로 변경했다고 명시합니다.

판단:

요구사항 기준이 FEATURE_LIST/PRD인지 ADR/운영문서인지 확정이 필요합니다. 현재 상태는 `확실하지 않음`입니다.

### P2

1. 인기 TOP3 판매 수 표시가 요구사항과 다름

근거:

- `docs/FEATURE_LIST.md:56`, `docs/FEATURE_LIST.md:237`은 메뉴명과 판매 수 표시를 요구합니다.
- `server/domain/popularity.js:17-39`는 recommended/fallback 중심이고 판매 수를 반환하지 않습니다.
- `src/hooks/useMenuData.js:24-27`은 backend popular API를 쓰지 않고 메뉴의 recommended flag로 popular를 만듭니다.
- `src/components/organisms/RecommendedBanner.jsx:28-40`도 판매 수를 표시하지 않습니다.

2. API rate limit 요구사항이 구현되지 않음

근거:

- `docs/API_DRAFT.md:654-660`은 `/api/orders`, `/admin/login`, SSE에 rate limit을 요구합니다.
- 서버 middleware/routes에서 rate limiter 구현이 확인되지 않았습니다.

3. React best practices 검증 중 일부는 자동 테스트가 아니라 수동/간접 검증임

근거:

- `docs/IMPLEMENTATION_PLAN.md:895-909`는 Appendix D 8/8 완료처럼 표현합니다.
- `src/__tests__/appendix-d.test.js:5-9`는 Profiler, StrictMode, code split이 수동/간접 검증임을 명시합니다.
- `src/__tests__/appendix-d.test.js:76-99`는 navigate-in-effect 예외를 whitelist로 처리합니다.

판단:

현재 React 구현 자체는 전반적으로 안정적입니다. 다만 문서의 "8/8 자동 검증 완료"처럼 읽히는 표현과 실제 테스트 방식은 다릅니다.

4. 테스트 로그 경고가 남아 있음

근거:

- `npm test`는 통과하지만 `window.getComputedStyle(elt, pseudoElt)` jsdom/axe 경고가 반복됩니다.
- React Router future flag 경고도 남아 있습니다.

## 5. 테스트가 없는 요구사항

| 요구사항 | 현재 코드 상태 | 없는 테스트 |
|---|---|---|
| 운영 production admin session cookie | production secure cookie 설정과 HTTP 배포 안내가 충돌 | `NODE_ENV=production` + HTTP login 후 `Set-Cookie`/세션 유지 테스트 |
| 무통장 입금 보고 인증 | token 없이 갱신 가능 | token 없음/오류 token 거부 테스트, transfer page token 포함 테스트 |
| E2E 14개 시나리오 | smoke 2개만 실행 | 주문 생성-입금-관리자 처리-정산-Docker/API 포함 E2E |
| SSE 또는 polling 최종 기준 | polling만 구현 | SSE가 요구라면 서버 SSE 통합 테스트. polling이 최종 기준이면 문서 정합성 테스트/검증 없음 |
| 영업 종료 GET server redirect | SPA redirect만 구현 | 서버 middleware GET redirect 테스트 |
| 메뉴 CRUD 전체 | 가격/품절/추천 중심 | 생성/삭제/이름/분류/이미지 수정 테스트 |
| 정산 메뉴별/시간별 분석 | 없음 | 메뉴별 매출/수량, 시간대별 그래프 데이터 테스트 |
| ZIP 히스토리 | 없음 | snapshot history 조회/표시 테스트 |
| PII 자동 삭제 | 없음 또는 수동 전환 | 자동 삭제가 요구라면 retention cleanup 테스트 |
| 인기 TOP3 판매 수 표시 | recommended 기반 표시 | 판매 수 산출/표시 테스트 |
| API rate limit | 없음 | `/api/orders`, `/admin/login` rate limit 테스트 |

## 6. React best practices 리뷰

긍정적으로 확인된 부분:

| 항목 | 상태 | 근거 |
|---|---|---|
| admin bundle lazy loading | 양호 | `src/App.jsx:26-36` |
| Zustand selector 기반 구독 | 양호 | `src/pages/admin/DashboardPage.jsx:24-27`, `src/pages/customer/CheckoutPage.jsx:22-24` |
| 반복 카드 memoization | 양호 | `src/components/organisms/AdminCardColumn.jsx:48-57` |
| API abort/retry/error handling | 양호 | `src/api/client.js`, `src/hooks/useApi.js:43-71`, `src/hooks/useGlobalErrorHandler.js` |
| URL token sessionStorage 이동 | 양호 | `src/hooks/useOrderToken.js:23-48` |

남은 주의점:

| 항목 | 판단 | 근거 |
|---|---|---|
| navigate-in-effect | 대부분 합리적 예외 | `src/__tests__/appendix-d.test.js:76-99`에서 허용 목록으로 관리 |
| Appendix D 완료 표현 | 과장 가능 | 수동/간접 검증 항목이 있음: `src/__tests__/appendix-d.test.js:5-9` |
| 사용하지 않는 dead hook 가능성 | 확인 필요 | `src/hooks/useOrderStream.js`는 SSE용 hook으로 보이나 현재 StatusPage는 `useOrderPolling` 사용. 요구사항이 polling으로 확정이면 유지 필요성이 낮음 |

## 7. 보안 리뷰 요약

| 항목 | 상태 | 우선순위 |
|---|---|---|
| admin production session cookie | 취약/운영 장애 가능 | P0 |
| transfer-report 인증 | 취약 | P0 |
| coupon server validation | 해결 | 완료 |
| order GET token auth | 해결 | 완료 |
| admin CSRF | 해결 | 완료 |
| rate limit | 미구현 | P2 |
| session secret 운영 설정 | 미흡 | P1/P2 |

session secret 관련 추가 메모:

`server/middleware/admin-auth.js:20-24`는 `SESSION_SECRET`이 없으면 production에서도 fallback을 사용하고 warning만 남깁니다. Docker/README가 `SESSION_SECRET` 필수 설정을 강제하지 않는다면 운영 보안상 취약합니다. 단일 시연용 로컬 배포라면 영향은 제한적이므로 P1/P2 사이입니다.

## 8. 최종 판단

Claude 수정은 이전 리뷰의 핵심 문제 상당수를 실제로 고쳤습니다. 특히 정적 파일 서빙, 쿠폰 검증, 주문 GET 인증, CSRF, 관리자 카드 표시 문제는 코드와 테스트 모두에서 개선이 확인됩니다.

하지만 현재 기준으로는 아직 릴리스 전 반드시 확인해야 할 P0가 2개 남아 있습니다.

1. production/Docker HTTP 환경에서 관리자 세션 cookie가 설정되지 않을 수 있습니다.
2. `POST /api/orders/:id/transfer-report`가 인증 없이 주문 입금 정보를 변경할 수 있습니다.

그 외에는 E2E 범위, SSE vs polling 요구사항 정리, 영업 종료 redirect 위치, 메뉴 CRUD/정산/PII 요구사항 충돌을 정리해야 합니다. 특히 `확실하지 않음`으로 표시한 SSE와 PII는 코드 문제가 아니라 요구사항 기준이 서로 달라서, 어떤 문서를 최종 기준으로 볼지 먼저 확정해야 합니다.
