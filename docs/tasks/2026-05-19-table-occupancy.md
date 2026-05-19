# 2026-05-19 · 테이블 점유/식사중/테이블 잠금 (table_lock 라운드)

## 목표

- 사용자가 주문 시 점유된 테이블 선택 불가 (409 TABLE_NOT_AVAILABLE)
- READY → DINING → SETTLED 흐름 신설, DONE은 dead status
- 어드민 테이블 잠금 페이지 + 단순 토글 (lock/unlock)
- 사용자 주문 진행 화면(StatusPage)에서 DINING/SETTLED 올바른 안내 문구
- 안내 문구: "현재 선택하신 테이블은 이용 중이거나 준비 중입니다. 번거로우시겠지만 다른 테이블로 이동해 주세요."

## 만든 것

### 신규 파일 (서브에이전트 1~5 산출)
- `server/domain/table-availability.js` — 테이블 가용 상태 쿼리 도메인
- `server/domain/__tests__/table-availability.test.js` — 도메인 단위 테스트
- `server/repositories/table-locks-repo.js` — table_locks CRUD
- `server/repositories/__tests__/table-locks-repo.test.js` — 리포 단위 테스트
- `src/hooks/useTablesAvailability.js` — GET /api/tables/availability 커스텀 훅
- `src/hooks/__tests__/useTablesAvailability.test.jsx` — 훅 테스트
- `src/pages/admin/TablesPage.jsx` — 어드민 테이블 잠금 페이지
- `src/pages/admin/__tests__/TablesPage.test.jsx` — 페이지 테스트
- `src/constants/__tests__/admin-columns.test.js` — 대시보드 컬럼 상수 테스트

### 수정된 핵심 파일
- `server/db/init.sql` — orders.dining_at, orders.settled_at 컬럼 + table_locks 테이블
- `server/db/bootstrap.js` — 마이그레이션 006-table-lock 신설 (기존 DB 업그레이드용)
- `server/domain/order-state.js` — LEGAL_TRANSITIONS 확장 (READY→DINING, DINING→SETTLED/CANCELED)
- `server/repositories/order-repo.js` — ACTION_LABEL에 DINING·SETTLED 라벨 추가, STATUS_TIME_FIELD 등록
- `server/routes/customer.js` — POST /api/orders에 table availability 가드 추가
- `server/routes/admin.js` — GET/POST /admin/api/tables + lock/unlock 엔드포인트
- `src/pages/customer/CheckoutPage.jsx` — availability fetch + disabled 셀 + 안내 메시지
- `src/pages/customer/StatusPage.jsx` — DINING/SETTLED 상태 텍스트
- `src/components/organisms/AdminCardColumn.jsx` — DINING 컬럼 + dining 경과 tone
- `src/components/organisms/RecentOrdersSection.jsx` — DINING/SETTLED 라벨
- `src/components/layouts/AdminLayout.jsx` — 테이블 잠금 메뉴 추가
- `src/constants/admin-columns.js` — DINING 컬럼 상수
- `src/App.jsx` — TablesPage 라우트 추가
- `src/api/routes.js` — /admin/tables 경로
- `src/styles/components.css` — DINING 컬럼 스타일

## 한 일

### SA-1 (table-availability 도메인 + 스키마)
- `server/domain/table-availability.js`: `getOccupyingOrder()` + `getAvailability()` + `getAdminTablesView()`
- `server/db/init.sql`: `orders.dining_at`, `orders.settled_at` 컬럼 추가; `table_locks` 테이블 신설
- `server/routes/customer.js`: POST /api/orders에 `checkTableAvailability()` 가드 — occupied/locked/범위외 → 409 TABLE_NOT_AVAILABLE
- `GET /api/tables/availability` 신설 — 15개 테이블 {table_no, status} 배열

### SA-2 (상태 전이 + UI 라벨)
- `server/domain/order-state.js`: LEGAL_TRANSITIONS 확장 (13→15 합법 전이). DONE은 우변에서 제거.
- `server/repositories/order-repo.js`: ACTION_LABEL에 DINING('전달 완료'), SETTLED('테이블 준비 완료') 추가
- StatusPage: DINING/SETTLED 상태별 안내 문구

### SA-3 (어드민 대시보드 DINING 컬럼)
- `src/components/organisms/AdminCardColumn.jsx`: DINING 컬럼 신설 + 30/60분 기준 tone 강조
- `src/constants/admin-columns.js`: DINING 포함 7컬럼 상수
- DashboardPage 그리드 7열 레이아웃

### SA-4 (어드민 테이블 잠금 페이지 + API)
- `src/pages/admin/TablesPage.jsx`: 15개 테이블 카드 + lock/unlock 토글 UI
- `GET /admin/api/tables`: 어드민용 테이블 상태 (order_no, dining_at, locked_at 포함)
- `POST /admin/api/tables/:n/lock`, `POST /admin/api/tables/:n/unlock`: 잠금 토글 + admin_events category='system' 로그

### SA-5 (CheckoutPage 가용 상태 UI)
- CheckoutPage에 `useTablesAvailability` 훅 연결
- 점유/dining/locked 테이블 셀 disabled + 회색 처리
- 409 응답 시 "현재 선택하신 테이블은 이용 중이거나 준비 중입니다…" 안내

### SA-6 (로깅 검증 + 마이그레이션 + docs)
- `server/db/bootstrap.js` 마이그레이션 `006-table-lock` 추가 — 기존 운영 DB에 dining_at/settled_at 컬럼 + table_locks 테이블 idempotent 추가
- `server/routes/__tests__/admin.test.js` 회귀 3건 추가: READY→DINING 전이 로깅, DINING→SETTLED 전이 로깅, history?type=orders 노출 확인
- docs 동기화 (DECISIONS.md, API_DRAFT.md, DB_DRAFT.md, IMPLEMENTATION_PROGRESS.md, CLAUDE.md)

## 테스트 결과

### Vitest (docker exec)
```
docker compose -f docker-compose.dev.yml exec dev npm test -- --run
Test Files  106 passed (106)
Tests       1311 passed (1311)
Duration    152s
```

### Lint
```
docker compose -f docker-compose.dev.yml exec dev npm run lint
✖ 3 problems (0 errors, 3 warnings)
```
경고 3건 모두 기존 파일 unused eslint-disable 디렉티브 — 신규 코드 기인 아님.

### Build
```
docker compose -f docker-compose.dev.yml exec dev npm run build
✓ built in 5.70s
```

### 운영 경로 curl 검증 (ADR-033)
```
docker compose build app && docker compose up -d
curl -s -o /dev/null -w "%{http_code}" http://localhost/           → 200 (SPA index)
curl -sI http://localhost/api/tables/availability                  → 200 OK
curl -sI http://localhost/admin/api/tables                         → 401 Unauthorized
```

마이그레이션 006 적용 전: `/api/tables/availability` 500 (no such column: dining_at). 적용 후: 200 정상.

## 이벤트 로깅 검증

- `POST /admin/api/orders/:id/transition {to:'DINING'}` → `order_events` actor=admin, event_type='DINING', from_status='READY', action_name='전달 완료' INSERT 확인
- `POST /admin/api/orders/:id/transition {to:'SETTLED'}` → `order_events` actor=admin, event_type='SETTLED', from_status='DINING', action_name='테이블 준비 완료' INSERT 확인
- `POST /admin/api/tables/7/lock` → `admin_events` category='system', event_type='TABLE_LOCK', target_id=7, operating_date='2026-05-20' INSERT 확인
- `POST /admin/api/tables/7/unlock` → `admin_events` TABLE_UNLOCK INSERT 확인
- `GET /admin/api/history?type=system` → TABLE_LOCK, TABLE_UNLOCK 포함 확인
- `GET /admin/api/history?type=orders` → DINING, SETTLED 이벤트 포함 확인

## 다음에 할 것

- D-1 리허설 5/19 — 실제 시뮬레이션 수행 (d1-rehearsal.md 체크리스트)
- DB 초기화 후 부팅 (운영 데이터 wipe → init.sql 재적용): `docker compose down -v && docker compose up -d`
- 운영 카드 갱신 고려 — 테이블 잠금 절차 한 단락 (어드민 /admin/tables 경로 안내)
