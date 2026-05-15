# Codex 리뷰 결과 v3 - Claude v2 수정 검증 + 재리뷰

작성일: 2026-05-15

## 0. 검토 범위

Claude가 `docs/codex리뷰결과_v2.md`를 기준으로 수정했다고 보고한 `docs/CODEX_REVIEW_v2_FIX_SUMMARY.md`를 먼저 확인한 뒤, 실제 구현 파일과 테스트를 다시 확인했습니다.

요청 문서 중 `docs/FEATURE_SPEC.md`, `docs/REACT_BEST_PRACTICES_REVIEW.md`는 현재 저장소에 없습니다. 따라서 기존 v2와 동일하게 `docs/FEATURE_LIST.md`, `docs/tasks/2026-05-14-react-best-practices-review.md`, 그리고 React 리뷰에는 `.agents/skills/vercel-react-best-practices/SKILL.md` 기준을 함께 적용했습니다.

## 1. 검증 명령 결과

| 검증 | 결과 | 비고 |
|---|---:|---|
| `npm test` | 통과 | axe/jsdom `window.getComputedStyle(elt, pseudoElt)` 경고와 React Router future flag 경고가 계속 출력됨 |
| `npm run build` | 통과 | Vite build 성공. 메인 JS gzip 89.89 kB |
| `npm run test:e2e` | 통과 | 2개 smoke test만 실행됨 |
| production admin login cookie 수동 확인 | 통과 | `NODE_ENV=production`, `SESSION_COOKIE_SECURE` 미설정 상태에서 `Set-Cookie` 발급 확인 |
| CLOSED 후 주문 조회 수동 확인 | 302 확인 | `GET /api/orders/:id?token=...`도 `/closed`로 redirect됨 |

## 2. Claude v2 수정 검증

| v2 지적 | 현재 상태 | 실제 근거 | 테스트/검증 |
|---|---|---|---|
| P0-A production secure cookie 문제 | 해결됨 | `server/middleware/admin-auth.js:20-35`, `docker-compose.yml:21-24` | `server/middleware/__tests__/admin-auth.test.js:50-103`, 수동 supertest에서 `Set-Cookie` 확인 |
| P0-B `transfer-report` 무인증 | 해결됨 | `server/routes/customer.js:185-207`, `src/pages/customer/TransferPage.jsx:23-52` | `server/routes/__tests__/customer.test.js:400-489` |
| CLOSED 사용자 GET 서버 redirect | 구현됨 | `server/middleware/business-state.js:17-48` | `server/middleware/__tests__/business-state.test.js:60-103`, `server/routes/__tests__/customer.test.js:283-298` |
| SSE → 5초 polling 문서 정리 | 대부분 정리됨 | `docs/FEATURE_LIST.md:3`, `docs/API_DRAFT.md:3`, `docs/DECISIONS.md:344-347` | `src/hooks/useOrderPolling.js`, `src/hooks/__tests__/useOrderPolling.test.jsx` |
| PII 자동 삭제 → 수동 폐기 | 정리됨 | `docs/FEATURE_LIST.md:273`, `docs/PRD.md:219`, `docs/DECISIONS.md:1009-1031`, `docs/operations/pii-deletion.md` | 자동 삭제 테스트는 의도적으로 없음 |
| 메뉴 CRUD 축소 | 문서상 정리됨 | `docs/FEATURE_LIST.md:186`, `docs/DECISIONS.md:920-948`, `src/pages/admin/MenuAdminPage.jsx` | 가격/품절/추천 테스트 있음 |
| 정산 그래프/ZIP 이력 Phase 2 강등 | 문서상 정리됨 | `docs/FEATURE_LIST.md:199-202`, `docs/DECISIONS.md:891-916` | 그래프/이력 테스트 없음. Phase 2라면 허용 |

결론: v2의 명시적 P0 2건은 실제 코드와 테스트 기준으로 해결되었습니다. 이번 v3 기준에서는 명확한 P0는 발견하지 못했습니다.

## 3. 요구사항별 구현 여부 표

| 요구사항 | 문서 기준 | 구현 여부 | 실제 코드 위치 | 테스트 상태 | 우선순위 |
|---|---|---|---|---|---|
| 운영 HTTP 환경 관리자 세션 | ADR-031, Docker HTTP 운영 | 구현됨 | `server/middleware/admin-auth.js:20-35`, `docker-compose.yml:21-24` | 있음: `server/middleware/__tests__/admin-auth.test.js:50-103` | 완료 |
| 무통장 이체 신고 인증 | `GET/POST /api/orders/:id*` token 필수 | 구현됨 | `server/routes/customer.js:185-207`, `src/pages/customer/TransferPage.jsx:47-52` | 서버 테스트 있음. 프론트 submit URL token 검증은 부족 | 완료/P2 |
| 주문 조회 token 비노출 | access_token은 최초 POST 응답만 | 구현됨 | `server/routes/customer.js:155-180`, `server/routes/customer.js:220-239` | 있음: `server/routes/__tests__/customer.test.js:303-394` | 완료 |
| CLOSED 사용자 GET redirect | F-S-015 | 구현됨 | `server/middleware/business-state.js:17-48` | 있음 | 완료 |
| CLOSED 중 주문 진행 페이지 예외 | 코드 주석/테스트는 예외, 최신 문서는 redirect | 확실하지 않음 | `src/components/layouts/CustomerLayout.jsx:24-60`은 `/orders/:id/status` 예외, `server/middleware/business-state.js:39-44`는 `/api/orders/:id` redirect | 서버/프론트 통합 테스트 없음 | P2 |
| ZIP 백업 다운로드 전체 패키징 | F-A-034: manifest/orders/coupons/menu/PDF/images | 부분 구현 | `server/jobs/auto-snapshot.js:78-90`은 `settlement.sql`, `summary.json`만 포함 | ZIP magic byte 테스트만 있음: `server/jobs/__tests__/auto-snapshot.test.js:47-53` | P1 |
| 자동 ZIP 스냅샷 volume 영속화 | F-I-003, ADR-022/023: db/backups/images/logs volume | 부분 구현 | `server/jobs/auto-snapshot.js:29`, `server/server.js:25-29`, `docker-compose.yml:20-26` | Docker volume 경로 테스트 없음 | P1 |
| 관리자 상단 nav | F-A-004: 본부/메뉴/정산/쿠폰/시스템 nav | 미구현 | `src/App.jsx:77` 주석상 AdminLayout 별도이나 실제 없음 | 없음 | P1 |
| 관리자 메뉴 관리 URL | SCREEN: `/admin/menus` | 불일치 | `src/App.jsx:85`는 `/admin/menu`, 테스트는 `src/pages/admin/__tests__/MenuAdminPage.test.jsx:39-43`에서 `/admin/menus` | App route 통합 테스트 부족 | P1 |
| 일자별 정산/합산 화면 | F-A-028: 5/20, 5/21, 합산 | 부분 구현 | `src/pages/admin/SettlementPage.jsx:73` 현재 일자만 표시. API는 `date` query 지원: `server/routes/admin.js:210-214` | UI 테스트 없음 | P1 |
| E2E 14개 시나리오 | `docs/IMPLEMENTATION_PLAN.md:867-874`, `docs/TEST_PLAN.md:458-471` | 미구현 | `tests/smoke.spec.js:11-15`, `playwright.config.js:5-8` | smoke 2개만 있음 | P1 |
| 주문 token 로그 보호 | access_token은 PII로 분류 | 미흡 | `server/app.js:41-45` pino-http 기본 로깅, `server/lib/logger.js:6-9` redaction 없음, token은 query: `src/hooks/useOrderToken.js:46-47` | redaction 테스트 없음 | P1 |
| 인기 TOP3 판매 수 표시 | F-U-005/F-S-009: 메뉴명·판매수 | 부분 구현 | `src/hooks/useMenuData.js:25-27`, `src/components/organisms/RecommendedBanner.jsx:28-40`, `server/domain/popularity.js:17-39` | 판매 수 테스트 없음 | P2 |
| API rate limit | `docs/API_DRAFT.md:642-643` | 미구현 | `package.json`에 rate limit dependency 없음, server middleware 없음 | 없음 | P2 |
| React lazy admin bundle | React best practices | 구현됨 | `src/App.jsx:26-36` | 간접 테스트 있음 | 완료 |
| Zustand selector | React best practices | 구현됨 | `src/pages/admin/DashboardPage.jsx:24-27` 등 | Appendix D 테스트 있음 | 완료 |
| Admin 카드 memoization | React best practices | 부분 구현 | `src/components/organisms/AdminCardColumn.jsx:140`가 object prop 전달, `src/pages/admin/DashboardPage.jsx:56`가 polling 때 새 JSON 객체 수신 | 실제 rerender 방지 테스트 없음 | P2 |
| `useApi.refetch` 안정성 | React best practices | 미흡 | `src/hooks/useApi.js:73-77`에서 매 렌더 새 함수 반환, `src/pages/admin/DashboardPage.jsx:56-62` effect deps로 사용 | 없음 | P2 |

## 4. 우선순위별 주요 지적

### P0

없음.

v2에서 지적한 production session cookie와 `transfer-report` 무인증은 해결된 것으로 확인했습니다.

### P1

1. ZIP 백업이 문서상 요구한 "정산 자료 ZIP 1개" 범위를 충족하지 못함

근거:

- `docs/FEATURE_LIST.md:201`은 F-A-034를 P0로 두고 `manifest+orders+coupons+menu+PDF+images`를 요구합니다.
- `docs/DECISIONS.md:407-413`도 `manifest.json`, `orders.json/csv`, `coupons.json/csv`, `menu-snapshot.json`, `images/`를 명시합니다.
- 실제 `server/jobs/auto-snapshot.js:78-90`의 수동 정산 ZIP은 `settlement.sql`, `summary.json`만 넣습니다.
- 테스트도 ZIP magic bytes만 확인합니다: `server/jobs/__tests__/auto-snapshot.test.js:47-53`.

영향:

SQL dump로 사후 복구는 가능하지만, 기획서가 말한 운영자 친화적 정산 패키지와는 다릅니다. PDF/CSV/manifest/images 기준으로 회계 자료를 바로 제출해야 한다면 요구사항 누락입니다.

2. 자동 백업 위치가 Docker named volume 요구와 다름

근거:

- `docs/FEATURE_LIST.md:270`은 `db·backups·images·logs`를 Docker named volume으로 영속화한다고 합니다.
- `docs/DECISIONS.md:668-671`, `docs/DECISIONS.md:729`도 mounted Docker volume의 `backups/`를 전제합니다.
- 실제 Docker compose는 `/data`만 named volume으로 마운트합니다: `docker-compose.yml:20-26`.
- DB는 `/data/order.sqlite`로 들어가지만, 자동 백업 기본 경로는 `server/jobs/auto-snapshot.js:29`의 `./backups`입니다.
- `server/server.js:25-29`에서 `BACKUP_DIR`을 `/data/backups`로 넘기지 않습니다.

영향:

컨테이너 재생성, 이미지 재빌드, 운영자가 volume만 백업하는 절차에서는 자동 ZIP이 누락될 수 있습니다. "DB 날아가도 안전" 요구의 신뢰도가 낮아집니다.

3. 주문 access_token이 운영 로그에 노출됨

근거:

- 주문 접근 token은 `docs/operations/pii-deletion.md:18`에서 PII로 분류됩니다.
- 클라이언트는 query string에 token을 붙입니다: `src/hooks/useOrderToken.js:46-47`.
- `GET /api/orders/:id`와 `POST /api/orders/:id/transfer-report`는 `req.query.token`을 인증에 사용합니다: `server/routes/customer.js:169`, `server/routes/customer.js:190`.
- `server/app.js:41-45`는 pino-http 기본 request logging을 사용하고, `server/lib/logger.js:6-9`에는 redaction 설정이 없습니다.
- 수동 supertest 확인 중 pino 로그에 `url`과 `query.token`이 그대로 출력되는 것을 확인했습니다.

영향:

로그 접근자가 token으로 주문 상세를 조회하거나 이체 신고를 시도할 수 있습니다. 단일 부스 운영이라도 Docker logs, 리허설 공유 로그, 장애 분석 로그에 token이 남는 것은 보안상 좋지 않습니다.

4. 관리자 메뉴 화면 경로와 문서/테스트 경로가 불일치하고, 관리자 nav가 없음

근거:

- 문서의 메뉴 관리 경로는 `/admin/menus`입니다: `docs/SCREEN_STRUCTURE.md:64`, `docs/SCREEN_STRUCTURE.md:106`.
- 실제 App route는 singular `/admin/menu`입니다: `src/App.jsx:85`.
- 반면 페이지 단위 테스트는 `/admin/menus`로 라우트를 구성합니다: `src/pages/admin/__tests__/MenuAdminPage.test.jsx:39-43`.
- F-A-004는 관리자 상단 nav를 P0로 요구하지만 `src/App.jsx:77` 주석상 AdminLayout은 별도이고 실제 관리자 공통 nav가 없습니다.

영향:

운영자가 문서대로 `/admin/menus`에 들어가면 앱 라우팅에서는 404가 됩니다. 또한 본부/메뉴/정산 간 이동이 직접 URL 의존이어서 운영 중 실수 가능성이 있습니다.

5. 일자별 정산/합산 화면이 UI에 없음

근거:

- F-A-028은 5/20, 5/21, 합산 정산 화면을 P0로 요구합니다: `docs/FEATURE_LIST.md:195`.
- API는 `date` query를 일부 지원합니다: `server/routes/admin.js:210-214`.
- 실제 `src/pages/admin/SettlementPage.jsx:73` 이후 UI에는 일자 선택이나 합산 전환이 없습니다.

영향:

양일 운영 후 5/20과 5/21을 분리 확인하거나 합산 확인하는 운영 흐름이 UI에서 막힙니다.

6. E2E 요구 범위가 여전히 smoke 수준

근거:

- `docs/IMPLEMENTATION_PLAN.md:867-874`는 E2E 14개 시나리오 작성/실행을 완료 조건으로 둡니다.
- `docs/TEST_PLAN.md:458-471`은 주문, 쿠폰, 관리자 로그인, 정산, Docker 첫 부팅 등을 나열합니다.
- 실제 `tests/smoke.spec.js:11-15`는 홈 → `/menu` redirect 1개이며, Playwright project 2개로 총 2건 실행됩니다.
- `playwright.config.js:5-8`은 Express route/API 의존 시나리오가 현재 Vite-only webServer에서 동작하지 않는다고 명시합니다.

### P2

1. 인기 TOP3의 판매 수가 표시되지 않음

근거:

- `docs/FEATURE_LIST.md:58`, `docs/FEATURE_LIST.md:239`는 정적 BEST라도 메뉴명·판매수를 요구합니다.
- 실제 `src/hooks/useMenuData.js:25-27`은 recommended flag 기반 TOP3를 만듭니다.
- `src/components/organisms/RecommendedBanner.jsx:28-40`은 판매 수를 표시하지 않습니다.
- `server/domain/popularity.js:17-39`도 판매 수를 반환하지 않습니다.

문서 충돌:

`docs/DECISIONS.md:435-463`의 ADR-017 본문은 여전히 실시간 랭킹/동적 카피를 말하지만, `docs/FEATURE_LIST.md:3`과 변경 이력은 정적 BEST를 우선으로 둡니다. 동적 랭킹 요구는 `확실하지 않음`이나, 판매 수 미표시는 현재 FEATURE 기준에서도 누락입니다.

2. rate limit이 문서에 남아 있으나 구현되지 않음

근거:

- `docs/API_DRAFT.md:642-643`은 `/api/orders`, `/admin/login` rate limit을 요구합니다.
- `package.json`에는 `express-rate-limit` 등 관련 dependency가 없습니다.
- server middleware에서도 rate limiter가 확인되지 않습니다.

3. React memoization 의도가 실제 polling 데이터 구조와 맞지 않음

근거:

- `AdminCardColumn`은 `OrderCard`를 `React.memo`로 감싸지만 `order` 객체 전체를 prop으로 넘깁니다: `src/components/organisms/AdminCardColumn.jsx:140`.
- 대시보드는 5초마다 `GET /admin/api/orders`를 refetch합니다: `src/pages/admin/DashboardPage.jsx:56-62`.
- JSON refetch마다 order object reference가 새로 생기므로 "변하지 않은 카드는 리렌더 X"라는 주석/요구가 실제로는 보장되지 않습니다.

4. `useApi.refetch`가 매 렌더 새 함수라 effect 의존성에 넣으면 interval churn이 발생함

근거:

- `src/hooks/useApi.js:73-77`은 `refetch`를 `useCallback` 없이 새 함수로 반환합니다.
- `src/pages/admin/DashboardPage.jsx:56-62`는 `refetch`를 interval effect deps에 넣습니다.

영향:

중복 interval은 cleanup으로 막히지만, refetch 후 렌더마다 interval setup/cleanup이 반복됩니다. 현재 부하에서는 낮은 위험이나 React best practices 기준으로는 유지보수성이 떨어집니다.

5. 테스트 출력 경고와 로그 노이즈가 계속 남아 있음

근거:

- `npm test` 통과 중에도 axe/jsdom `window.getComputedStyle(elt, pseudoElt)` 경고가 반복됩니다.
- React Router future flag 경고도 여러 테스트에서 반복됩니다.
- pino request log가 테스트 출력에 많이 섞입니다.

## 5. 테스트가 없는 요구사항

| 요구사항 | 누락 테스트 |
|---|---|
| 정산 ZIP 구성물 | ZIP 내부에 `manifest.json`, `orders.json/csv`, `coupons.json/csv`, `menu-snapshot.json`, `images/`가 있는지 검증 없음 |
| 자동 백업 Docker volume 경로 | Docker compose 환경에서 `BACKUP_DIR=/data/backups` 또는 volume 내부 생성 검증 없음 |
| 주문 token 로그 redaction | pino-http가 `req.url`, `req.query.token`을 마스킹하는지 테스트 없음 |
| 관리자 route 정합 | App route에서 `/admin/menus`가 렌더되는지 테스트 없음 |
| 관리자 nav | 본부/메뉴/정산 이동 nav 렌더/동작 테스트 없음 |
| 일자별/합산 정산 UI | 5/20, 5/21, 전체 합산 전환 테스트 없음 |
| E2E 주문/정산/로그인/Docker | TEST_PLAN의 E2E-01~14 대부분 없음 |
| 프론트 이체 신고 token 포함 | `TransferPage` 테스트가 POST URL에 `?token=` 포함을 명시적으로 검증하지 않음 |
| 인기 TOP3 판매 수 | 판매 수 산출/표시 테스트 없음 |
| API rate limit | `/api/orders`, `/admin/login` 429 테스트 없음 |
| React memo 실제 효과 | polling 후 동일 주문 카드 rerender 방지 검증 없음 |

## 6. React Best Practices 리뷰

양호한 부분:

| 항목 | 근거 |
|---|---|
| 관리자 페이지 lazy loading | `src/App.jsx:26-36` |
| Suspense fallback 분리 | `src/App.jsx:38-49` |
| Zustand selector 사용 | `src/pages/admin/DashboardPage.jsx:24-27` |
| AbortController 기반 fetch cleanup | `src/hooks/useApi.js:42-69`, `src/hooks/useOrderPolling.js:70-116` |
| 페이지 파일 크기 제한 테스트 | `src/__tests__/appendix-d.test.js:102-113` |

주의할 부분:

| 항목 | 판단 |
|---|---|
| `OrderCard` memo | object prop reference가 polling마다 바뀌어 실효성이 낮음 |
| `useApi.refetch` | 안정 reference가 아니어서 effect deps에 넣는 순간 불필요한 effect 재실행 발생 |
| `useOrderStream.js` | SSE가 Phase 2라면 현재 dead hook에 가까움. 유지한다면 Phase 2용이라고 명확히 두는 편이 좋음 |
| Appendix D 테스트 | 일부 항목은 자동 검증이 아니라 수동/간접 검증임 |

## 7. 확실하지 않음

| 항목 | 이유 |
|---|---|
| CLOSED 후 `/orders/:id/status` 유지 여부 | 최신 문서는 사용자 GET redirect를 우선한다고 하지만, `CustomerLayout`과 테스트는 진행 중 주문 페이지 예외를 유지합니다. 서버는 `/api/orders/:id`까지 redirect합니다. 어느 정책이 최종 기준인지 확정 필요 |
| ADR-017 인기 랭킹 | FEATURE_LIST는 정적 BEST, DECISIONS의 ADR-017 본문은 실시간 랭킹/동적 카피를 유지합니다. 정적 BEST는 구현됐지만 판매 수는 없음 |
| ZIP 상세 구성 축소 의도 | ADR-030은 그래프/ZIP 이력을 Phase 2로 내렸지만, F-A-034의 ZIP 내부 구성물 축소까지 명시하지는 않습니다 |

## 8. 최종 판단

Claude의 v2 수정은 핵심 보안 P0 두 건을 제대로 해결했습니다. 현재 새 P0는 없습니다.

다만 릴리스 전에는 P1 중 최소 다음 4개를 확인하는 것이 좋습니다.

1. ZIP 백업 구성과 자동 백업 저장 위치가 실제 운영 백업 요구를 만족하는지
2. 주문 access_token이 pino/Docker logs에 남는 문제를 허용할지
3. `/admin/menu` vs `/admin/menus` 경로와 관리자 nav 부재를 운영 카드 기준으로 정리할지
4. 양일 정산/합산 UI가 필요한지, 아니면 현 운영 범위에서 제외할지

테스트는 모두 통과하지만, E2E는 아직 smoke 수준입니다. 현재 테스트 통과만으로 전체 사용자 주문-관리자 처리-정산-Docker 운영 흐름이 검증됐다고 보기는 어렵습니다.
