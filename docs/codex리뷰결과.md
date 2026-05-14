# Codex 리뷰 결과 — 기획문서 대비 구현물

작성일: 2026-05-15  
범위: `docs/PRD.md`, `docs/IMPLEMENTATION_PLAN.md`, README, `package.json`, 실제 `src/`, `server/`, `tests/`, Docker 설정

## 0. 검토 전제

요청된 필수 문서 중 아래 2개는 저장소에 존재하지 않았다.

| 요청 문서 | 상태 | 대체 확인 |
|---|---|---|
| `docs/FEATURE_SPEC.md` | 없음 | `docs/FEATURE_LIST.md`가 PRD에서 참조되는 기능 카탈로그이므로 대체 기준으로 확인 |
| `docs/REACT_BEST_PRACTICES_REVIEW.md` | 없음 | `docs/tasks/2026-05-14-react-best-practices-review.md`와 `docs/IMPLEMENTATION_PLAN.md` §3.5/부록 D 확인 |

검증 명령 결과:

| 명령 | 결과 |
|---|---|
| `npm test` | 통과. 단, jsdom `HTMLCanvasElement.getContext` 미구현 경고가 다수 출력됨 |
| `npm run build` | 통과. 사용자 chunk `index-D2gbVrs_.js` gzip 89.25kB |
| `npm run test:e2e` | 실패. `tests/smoke.spec.js` 1개 테스트가 mobile/desktop 모두 `page.goto('/')` 타임아웃 |
| `git status --short` | 실행 불가. 저장소 ownership 문제: `detected dubious ownership` |

## 1. 요구사항 구현 현황

| 요구사항 | 문서 기준 | 구현 상태 | 근거 | 테스트 상태 | 우선순위 |
|---|---|---|---|---|---|
| Docker compose 단일 배포로 앱 접근 | F-I-001~004, ADR-023 | 미구현/위험 | Docker는 `dist`를 복사하지만 Express 정적 서빙이 없다. `Dockerfile:5`, `Dockerfile:40`, `server/app.js:49`, `server/app.js:55` | Docker 실빌드도 보류 기록. `docs/IMPLEMENTATION_PROGRESS.md:76` | P0 |
| 메뉴·카트 기본 흐름 | F-U-001~011 | 부분 구현 | `MenuPage`, `CartPage`, `MenuCard`, `StickyCartBar` 구현. `src/pages/customer/MenuPage.jsx:38`, `src/pages/customer/CartPage.jsx:22` | 단위 테스트 있음. E2E 실패 | P1 |
| 주문 폼 | F-U-012~019, ADR-021 | 부분 구현 | 클라이언트 검증은 있으나 서버는 `student_id`를 optional로 받음. `server/routes/customer.js:38`, `src/pages/customer/CheckoutPage.jsx:43` | 서버 필수 학번 누락 테스트 없음 | P0 |
| 쿠폰 할인 무결성 | F-U-017, F-S-002, ADR-019 | 버그 있음 | `coupon.used`만으로 가격 할인 후, `student_id` 없으면 쿠폰 사용 기록 없이 넘어간다. `server/domain/pricing.js:90`, `server/routes/customer.js:124` | 쿠폰 중복/형식 테스트는 있으나 “쿠폰 사용 + 학번 없음/외부인” 공격 테스트 없음 | P0 |
| 주문 완료·계좌 안내 | F-U-020~026, G9 | 구현 | 계좌/도그태그/CTA 구현. `src/pages/customer/CompletePage.jsx:94` | 단위 테스트 있음 | P1 |
| 이체 신고 | F-U-027~030 | 부분 구현 | 폼과 POST 구현. 서버 상태 전이 검증은 직접 `updateTransferInfo`로 처리됨. `server/routes/customer.js:152`, `server/repositories/order-repo.js:169` | 기본 테스트 있음 | P1 |
| 조리 현황판 SSE | F-U-034~037, F-S-010~011, ADR-015 | 미구현 | 서버 route 주석에 SSE는 “후속 단계”로 남아 있고, 실제 페이지는 `useOrderPolling` 사용. `server/routes/customer.js:14`, `src/pages/customer/StatusPage.jsx:5`, `src/pages/customer/StatusPage.jsx:59` | `useOrderStream` mock 테스트만 있음. 실제 서버 SSE 통합 테스트 없음 | P0 |
| 주문 조회 인증 | F-U-038~040, F-S-005 | 미구현/보안 위험 | `/api/orders/:id`가 토큰/학번 검증 없이 주문을 반환하고 `external_token`도 노출한다. `server/routes/customer.js:144`, `server/routes/customer.js:183` | 무인증 조회 차단 테스트 없음 | P0 |
| 영업 외 안내 화면 | F-U-044, F-S-015, G13 | 부분 구현/요구와 불일치 | middleware가 CLOSED 상태에서도 GET을 통과시킨다. `server/middleware/business-state.js:4`, `server/middleware/business-state.js:17`; 테스트도 GET 통과를 기대. `server/middleware/__tests__/business-state.test.js:44` | 요구사항 기준 테스트 없음 | P0 |
| 관리자 로그인/세션 | F-A-001~003 | 부분 구현 | PIN+session 구현. 하지만 `connect-sqlite3` 없이 MemoryStore 사용, `SESSION_SECRET` fallback 존재. `server/middleware/admin-auth.js:3`, `server/middleware/admin-auth.js:20` | 기본 인증 테스트 있음. 운영 store/secret 강제 테스트 없음 | P1 |
| CSRF 보호 | IMPLEMENTATION_PLAN Task 6.7 | 미구현 | 계획에는 CSRF 토큰 미들웨어가 있으나 실제 서버에는 관련 미들웨어가 없다. `docs/IMPLEMENTATION_PLAN.md:834`, `server/routes/admin.js:3` | 테스트 없음 | P1 |
| 본부 대시보드 칸반 | F-A-006~012 | 부분 구현 | 6컬럼/폴링 구현. 카드가 `depositorName`만 읽어 실제 API의 `depositor_name`/`name`과 맞지 않고 금액 표시도 없다. `src/components/organisms/AdminCardColumn.jsx:70`, `docs/FEATURE_LIST.md:150` | 테스트 mock은 camelCase라 실제 API 불일치 미검출. `src/components/organisms/__tests__/AdminCardColumn.test.jsx:27` | P1 |
| 장사 시작/영업 배지 | F-A-040~041, G13 | 부분 구현 | 관리자 CTA 구현. 단 사용자 GET 진입 차단과 연동이 요구와 불일치 | 단위 테스트 있음 | P1 |
| 주문 상세 상태 전이 | F-A-013~023, F-S-003 | 부분 구현 | 6액션과 서버 전이 검증 있음. 보류/취소 사유 입력은 UI에서 받지 않는다. `src/pages/admin/OrderDetailPage.jsx:17`, `server/routes/admin.js:170` | 상태 전이 테스트 있음. 사유 입력 테스트 없음 | P1 |
| 메뉴 관리 CRUD | F-A-024~027 | 부분 구현 | UI는 품절/추천 토글만 있고 이름·분류·이미지·가격 편집 UI, 생성/삭제가 없다. `src/pages/admin/MenuAdminPage.jsx:52`, `src/pages/admin/MenuAdminPage.jsx:85`, `server/routes/admin.js:125` | 토글 테스트만 있음 | P1 |
| 정산 화면 | F-A-028~035 | 부분 구현 | 총 주문/매출/진행 주문, 마감, ZIP 다운로드만 있음. 통장 입금 합계 입력, 차이 계산, 메뉴별 판매/시간대 그래프, 쿠폰 요약, ZIP 이력은 없음. `src/pages/admin/SettlementPage.jsx:83`, `src/pages/admin/SettlementPage.jsx:105` | 핵심 가드 테스트 있음. 누락 항목 테스트 없음 | P1 |
| ZIP 백업 | F-A-034, F-S-006~007 | 부분 구현 | 수동 ZIP과 자동 스냅샷 구현. ZIP 패스워드 보호는 확인 안 됨. `server/jobs/auto-snapshot.js:78`, `server/jobs/auto-snapshot.js:150` | 단위 테스트 있음 | P2 |
| PII 자동 삭제 | F-I-006, PRD 보안 | 미구현 | 요구사항은 정산 후 7~14일 자동 삭제. `docs/FEATURE_LIST.md:271`, `docs/PRD.md:217`; 서버에는 삭제 job/retention 구현이 없다 | 테스트 없음 | P1 |
| React best practices | IMPLEMENTATION_PLAN §3.5, 부록 D | 대체로 구현 | 페이지 컴포넌트는 120줄 이하, lazy admin, named lucide import 등 확인 | `appendix-d` 테스트 있음. 다만 `react-hook-form` 미채택은 계획과 불일치. `src/pages/customer/CheckoutPage.jsx:5` | P2 |
| E2E 14 시나리오 | IMPLEMENTATION_PLAN 7.1 | 미구현/실패 | 실제 `tests/`에는 smoke 1개만 있고, 구현 진행 문서에도 14개 자동화 보류 기록. `tests/smoke.spec.js:6`, `docs/IMPLEMENTATION_PROGRESS.md:78` | `npm run test:e2e` 실패 | P1 |
| README/운영 문서 정합성 | README | 불일치 | README는 EJS+Alpine, 구현 진입 직전이라고 되어 있어 실제 React 구현과 다름. `README.md:19` | 문서 테스트 없음 | P2 |

## 2. 주요 결함 및 리스크

### P0

1. **Docker 배포 시 프론트가 열리지 않는다.**  
   Dockerfile은 Vite `dist`를 복사하지만 Express는 `express.static`/SPA fallback을 등록하지 않는다. compose는 3000번 Express만 노출하므로 운영 절차 `docker compose up -d`로는 `/menu`가 404가 될 가능성이 높다.  
   근거: `Dockerfile:5`, `Dockerfile:40`, `server/app.js:49`, `server/app.js:55`

2. **SSE 요구사항이 실제로는 5초 폴링으로 대체되어 있다.**  
   PRD/FEATURE_LIST의 P0 실시간 현황판 요구와 다르게 `/api/orders/:id/stream` 서버 구현이 없다. `useOrderStream`은 존재하지만 실제 `StatusPage`는 `useOrderPolling`을 사용한다.  
   근거: `server/routes/customer.js:14`, `src/pages/customer/StatusPage.jsx:5`, `src/hooks/useOrderPolling.js:4`

3. **쿠폰 할인 위변조가 가능하다.**  
   서버 가격 계산은 `coupon.used`만 보고 1,000원을 할인한다. 이후 쿠폰 소비는 `student_id`가 있을 때만 실행하므로, 공격자가 `coupon: { used: true }`와 `student_id: null` 또는 `is_external: true`를 보내면 할인만 받고 `used_coupons` 기록은 남지 않는다.  
   근거: `server/domain/pricing.js:90`, `server/routes/customer.js:124`

4. **주문 상세 API가 무인증으로 PII와 토큰을 노출한다.**  
   `/api/orders/:id`는 학번+주문번호 또는 외부인 token 검증 없이 주문 전체를 반환한다. 응답에는 이름, 메뉴, 금액, 이체 정보, `external_token`도 포함된다. 순차 ID 추측으로 타인 주문 조회가 가능하다.  
   근거: `server/routes/customer.js:144`, `server/routes/customer.js:183`, `src/api/schemas.js:60`

5. **영업 외 사용자 진입 차단이 요구사항과 다르다.**  
   FEATURE_LIST는 CLOSED 상태 사용자 GET 경로를 `/closed`로 보내야 한다고 하지만, 실제 middleware는 GET을 항상 통과시킨다. 즉 오픈 전 QR 접근자가 메뉴를 볼 수 있고, 주문 POST에서야 차단된다.  
   근거: `server/middleware/business-state.js:4`, `server/middleware/business-state.js:17`, `server/middleware/__tests__/business-state.test.js:44`

### P1

1. **E2E 자동화가 요구와 다르고 현재 실패한다.**  
   구현 계획은 14개 E2E를 요구하지만 실제는 smoke 1개뿐이며 `npm run test:e2e`가 2개 project 모두 타임아웃으로 실패했다.  
   근거: `docs/IMPLEMENTATION_PROGRESS.md:78`, `tests/smoke.spec.js:6`

2. **관리자 대시보드 카드가 요구 정보를 표시하지 못한다.**  
   P0 요구는 주문번호+이름+금액+경과 시간인데, 실제 카드는 `order.depositorName`을 읽는다. 서버는 snake_case `depositor_name` 또는 주문자 `name`을 반환하므로 `(이름 없음)`이 표시될 수 있고 금액은 표시하지 않는다.  
   근거: `docs/FEATURE_LIST.md:150`, `src/components/organisms/AdminCardColumn.jsx:70`, `server/routes/admin.js:192`

3. **정산 핵심 보조 기능이 빠져 있다.**  
   통장 입금 합계 수동 입력, 차이 계산, 메뉴별 판매/시간대 그래프, 쿠폰 요약, ZIP 이력 표시가 구현되지 않았다. 정산 정확성과 1시간 내 정산 목표에 직접 영향이 있다.  
   근거: `docs/FEATURE_LIST.md:196`, `src/pages/admin/SettlementPage.jsx:83`, `src/pages/admin/SettlementPage.jsx:105`

4. **메뉴 CRUD 요구가 토글 중심으로 축소되어 있다.**  
   UI는 품절/추천만 가능하고 이름·가격·분류·이미지 편집 및 생성/삭제가 없다. 백엔드는 `base_price` patch를 일부 허용하지만 UI가 연결하지 않는다.  
   근거: `docs/FEATURE_LIST.md:184`, `src/pages/admin/MenuAdminPage.jsx:52`, `server/repositories/menu-repo.js:31`

5. **PII 자동 삭제가 없다.**  
   PRD/F-I-006은 정산 후 7~14일 자동 삭제를 요구하지만 서버에는 PII retention/cleanup job이 없다.  
   근거: `docs/FEATURE_LIST.md:271`, `docs/PRD.md:217`, `server/jobs/auto-snapshot.js:150`

6. **CSRF 토큰 미들웨어가 없다.**  
   구현 계획에는 명시되어 있으나 실제 관리자 mutation API는 세션 쿠키 기반이고 CSRF token 검증이 없다. SameSite=Lax만으로 요구사항 충족이라고 보기 어렵다.  
   근거: `docs/IMPLEMENTATION_PLAN.md:834`, `server/middleware/admin-auth.js:31`

### P2

1. **README가 구현과 불일치한다.**  
   README는 EJS+Alpine, “구현 진입 직전”이라고 되어 있어 현재 React SPA 구현과 맞지 않는다.  
   근거: `README.md:19`

2. **폼 라이브러리 계획과 실제 구현이 다르다.**  
   계획은 `react-hook-form + zod`였지만 실제 폼은 plain controlled input이고 `react-hook-form`은 dependency에도 없다. 기능 자체보다 유지보수/검증 일관성 문제다.  
   근거: `docs/IMPLEMENTATION_PLAN.md:32`, `src/pages/customer/CheckoutPage.jsx:5`, `src/components/organisms/TransferReportForm.jsx:5`

3. **a11y 테스트 로그가 신뢰도를 떨어뜨린다.**  
   `npm test`는 통과하지만 axe 실행 중 jsdom canvas 미구현 경고가 반복된다. 색 대비 등 일부 axe rule 결과가 실제 브라우저 검증과 다를 수 있다.  
   근거: `src/__tests__/error-page.a11y.test.jsx:5`

## 3. 테스트 없음/부족 요구사항

| 요구사항 | 부족한 테스트 |
|---|---|
| Docker compose로 실제 SPA 접근 | 컨테이너 실행 후 `/`, `/menu`, `/admin/login` 접근 테스트 없음 |
| SSE `/api/orders/:id/stream` | 실제 서버 SSE 통합 테스트 없음. hook mock만 있음 |
| 주문 조회 인증 | 무토큰/잘못된 토큰/타인 ID 조회 차단 테스트 없음 |
| 쿠폰 할인 위변조 | `coupon.used=true` + 외부인/학번 없음/잘못된 학번 공격 테스트 없음 |
| CLOSED 사용자 GET redirect | `/menu`, `/cart`, `/checkout`가 CLOSED에서 `/closed`로 가는 테스트 없음. 현재는 반대 테스트가 존재 |
| 관리자 CSRF | CSRF 토큰 누락 요청 거부 테스트 없음 |
| 메뉴 CRUD 전체 | 생성/삭제/이름·분류·이미지·가격 편집 UI/API 테스트 없음 |
| 정산 상세 | 통장 합계, 차이 계산, 메뉴별 그래프, 쿠폰 요약, ZIP 이력 테스트 없음 |
| PII 자동 삭제 | retention job, 수동/자동 삭제, 삭제 후 ZIP 보존 검증 없음 |
| E2E 14 시나리오 | 자동화 없음. 실제 `npm run test:e2e`도 실패 |

## 4. 확실하지 않음

| 항목 | 판단 |
|---|---|
| HTTPS 적용 | 코드/compose에는 HTTPS 종단이 없지만, 외부 reverse proxy나 학교 네트워크 운영 정책으로 처리할 수 있어 확실하지 않음 |
| ZIP 패스워드 보호 | PRD에는 옵션 패스워드 보호가 있으나 구현에서는 확인되지 않음. 운영에서 별도 암호화 폴더를 쓸 수 있어 확실하지 않음 |
| 부스 약도 실제 이미지 | fallback은 구현되어 있으나 실제 약도 자산 수령 여부는 저장소만으로 확실하지 않음 |

## 5. 수정 우선순위 제안

| 우선순위 | 항목 |
|---|---|
| P0 | Express에서 `dist` 정적 서빙 + SPA fallback 추가, Docker compose smoke 검증 |
| P0 | 쿠폰 할인 서버 검증을 `student_id`/`is_external`/중복 소비와 같은 트랜잭션으로 묶기 |
| P0 | `/api/orders/:id` 인증 도입: 학생은 학번+주문번호, 외부인은 token+만료 검증 |
| P0 | 실제 SSE endpoint 구현 또는 문서 요구를 polling으로 공식 변경 |
| P0 | CLOSED 상태 사용자 GET 진입 정책을 문서와 구현 중 하나로 통일하고 테스트 추가 |
| P1 | E2E 14개 중 최소 북극성 흐름 1개를 자동화하고 `npm run test:e2e` 통과시키기 |
| P1 | 관리자 대시보드 카드 필드 매핑/금액 표시 수정 |
| P1 | 정산 누락 기능 중 통장 합계/차이 계산과 쿠폰 요약 우선 구현 |
| P1 | PII 자동 삭제 또는 운영 가이드 기반 수동 폐기 절차를 명확히 구현/문서화 |
| P2 | README와 구현 계획의 불일치 정리, `react-hook-form` 채택 여부 문서 갱신 |
