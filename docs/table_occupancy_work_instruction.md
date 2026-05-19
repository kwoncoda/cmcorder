# 테이블 점유/식사중/테이블 잠금 작업 지시서

> 작성일: 2026-05-19 / 갱신: 2026-05-19 (사용자 결정 8건 반영) / 브랜치: `table_lock`
> 본 문서는 Claude가 *실제 구현 단계에서 따라야 할 작업 지시서*다.
> 짝 문서: `docs/table_occupancy_development_plan.md` (설계), `docs/table_occupancy_qa_plan.md` (검수).

---

## 0. 최우선 정책 (확정 사항)

- **개발 기획서 §10의 사용자 결정 8건이 모두 확정**된 상태에서 본 지시서가 적용된다.
- 환경 정책 (CLAUDE.md / ADR-033): **모든 dev·테스트·검증은 docker 컨테이너 안에서**. 호스트 `npm` 직접 호출 금지.
- 작업 절차 4단계 준수: ① 작업 실행 → ② 테스트 검증(docker) → ③ 작업 로그 기록(`docs/tasks/2026-05-XX-table-occupancy-*.md`) → ④ 운영 경로 사이드체크.
- 절대 깨지면 안 되는 회귀(CLAUDE.md "절대 깨지면 안 되는 것"): ADR-019 쿠폰 정규식 / ADR-020 Pattern B / ADR-021 학번·이름 필수 / ADR-025 합법 전이(*본 작업이 ADR-025를 갱신*) / G13 영업 상태 / ADR-012 정산 마감 / ADR-033 docker 정책.
- 같은 테이블 동시 주문 race condition은 본 범위의 주요 리스크가 아니다(전제). 단, *서버 최종 방어선*은 유지.
- 본 작업은 *기능 변경*이므로 `server/domain/*`은 **TDD strict + 회귀 테스트 필수**.

### 0.1 결정 사항 요약 (구현 시 반드시 참조)

- **상태 전이:** `READY → DINING → SETTLED`. 어드민 버튼 2개. DONE은 dead status(어떤 합법 전이로도 진입 X).
- **availability 응답:** 사용자에게는 order_no/dining_at 미노출. 어드민에만 포함.
- **DINING elapsed 임계:** 30분/60분 warning/danger. READY/COOKING의 5/10분과 분리.
- **잠금 사유:** UI 없음. `table_locks.reason` 컬럼 자체 생성 안 함. 단순 토글.
- **사용자 폴링:** 진입 1회 + 제출 직전 1회. 주기 폴링 X.
- **잠금 이벤트 로그:** `admin_events.category='system'`. 새 카테고리 추가 X.
- **DB 적용:** *마이그레이션 스크립트 X*. `init.sql` 단일 갱신 + DB 초기화로 적용.

---

## 1. Superpowers 작업 방식

### 1.1 흐름 (subagent-driven-development)

- 사용자가 본 지시서를 *executing-plans* 또는 *subagent-driven-development*로 실행.
- subagent는 **순차 진행** — §2의 1번부터 6번까지 한 번에 한 agent.
- **병렬 실행 금지** — 같은 파일에 둘 이상이 동시에 손대지 못하게 직렬화.
- 각 agent는 다음을 *예외 없이* 준수:
  1. **관련 파일 파악** (Read/Grep)
  2. **실패 테스트 작성** (Vitest, docker exec dev)
  3. **실패 확인** (red)
  4. **최소 구현**
  5. **테스트 통과** (green)
  6. **리팩터링** (필요 시)
  7. **다음 agent로 진행 — 단, 작업 로그를 먼저 기록**

### 1.2 검증 명령 (docker 전용)

```bash
docker compose -f docker-compose.dev.yml exec dev npm test            # 단위·통합
docker compose -f docker-compose.dev.yml exec dev npm run test:e2e    # Playwright smoke
docker compose -f docker-compose.dev.yml exec dev npm run lint
docker compose -f docker-compose.dev.yml exec dev npm run build       # production build
```

운영 경로 사이드체크 (마이그레이션/미들웨어 변경 시 필수):
```bash
docker compose build app && docker compose up -d
curl -sI http://localhost/api/tables/availability     # 200 응답 확인
curl -sI http://localhost/                            # SPA index 회귀
```

### 1.3 DB 적용 정책 (Q7 확정 — 마이그레이션 X)

- **마이그레이션 스크립트 작성하지 않는다.** `bootstrap.js`의 `applyPostInitMigrations`에 새 단계 추가 X.
- **`server/db/init.sql`만 최종 형태로 갱신**한다:
  - `orders.status` CHECK enum: `'DINING'`, `'SETTLED'` 추가 (DONE은 보존).
  - `orders` 테이블에 `dining_at TEXT`, `settled_at TEXT` 컬럼 추가.
  - `table_locks` 테이블 정의 추가 (reason 컬럼 없음).
- 적용 절차:
  - **로컬 dev**: dev DB 볼륨 비우기 → docker compose -f docker-compose.dev.yml up 재기동 → init.sql 자동 실행.
  - **운영**: D-day 직전 또는 검수 통과 후 운영 컨테이너 정지 → named volume `chickenedak-data` 초기화 → 재가동. 사용자가 시점 결정.
- 기존 데이터 보존 *불필요* (사용자 명시: 단발 운영, 인수인계 가중치 X).

---

## 2. 권장 Subagent 구성 (순차)

### Subagent 1 — Table Availability Domain Agent

**담당:**
- 새 도메인 모듈 `server/domain/table-availability.js` 신설.
- 1~15 테이블 사용 가능 여부 계산 로직.
- `table_locks` 리포지토리 신설 (`server/repositories/table-locks-repo.js`) — UPSERT/get/list. **reason 없음.**
- `POST /api/orders` 안에 availability 검증 1줄 추가.
- `init.sql`에 `table_locks` 테이블 정의 추가.

**의존 파일:**
- 참조(읽기): `server/domain/order-state.js`, `server/repositories/order-repo.js`.
- 신규: `server/domain/table-availability.js`, `server/repositories/table-locks-repo.js`.
- 갱신: `server/db/init.sql` (table_locks 테이블 정의 + 인덱스).

**구현 가이드라인:**
- 진행 중 상태 집합 상수: `const OCCUPYING_STATUSES = new Set(['ORDERED','TRANSFER_REPORTED','PAID','COOKING','READY','DINING','HOLD'])`.
- *DONE/SETTLED/CANCELED는 비점유* — availability 계산에서 제외.
- 도메인 함수 시그니처 제안:
  ```js
  // 사용자용 (order_no 미포함):
  //   getAvailability(db, { operating_date }) → [{ table_no, status }, ... ] (length 15)
  // 어드민용 (order_no/dining_at 포함):
  //   getAdminTablesView(db, { operating_date }) → [{ table_no, status, order_no?, dining_at?, locked_at?, updated_at? }, ...]
  // 단일 가드 (POST /api/orders 안):
  //   assertTableAvailable(db, { operating_date, table_no }) → throws TableNotAvailableError on busy/locked/out-of-range
  ```
- `TableNotAvailableError` 도메인 에러 신설 — `errorHandler`에서 409 매핑 (`error: 'TABLE_NOT_AVAILABLE'`, `message: '현재 선택하신 테이블은 이용 중이거나 준비 중입니다. 번거로우시겠지만 다른 테이블로 이동해 주세요.'`).
- `POST /api/orders` 검증 위치: zod 통과 후 / `db.transaction` 시작 *전* 호출.
  - delivery_type='dineIn' && table_no!=null 일 때만 `assertTableAvailable`.

**필수 테스트 (Vitest, server/domain/__tests__/table-availability.test.js 신설):**
- `getAvailability` (사용자용):
  - 빈 DB → 1~15 모두 `available`
  - 5번에 PAID 주문 있음 → 5번 `occupied`, 나머지 `available`. order_no 응답 X
  - 5번에 DINING 주문 있음 → 5번 `dining`. order_no/dining_at 응답 X
  - 5번에 SETTLED 주문 있음 → 5번 `available` (점유 해제)
  - 5번에 CANCELED 주문 있음 → 5번 `available`
  - 5번에 PAID + table_locks(5,1) → 5번 `occupied` (점유가 잠금보다 우선 노출)
  - 7번 잠금만 → 7번 `locked`
  - operating_date가 다른 5번 주문 → 5번 `available` (오늘 점유 아님)
  - 포장 주문(table_no=null)은 모든 테이블 사용 가능 유지
- `getAdminTablesView` (어드민용):
  - 5번 PAID → `occupied` + `order_no: N`
  - 5번 DINING → `dining` + `order_no: N` + `dining_at: ISO`
  - 7번 잠금 → `locked` + `locked_at: ISO`
- `assertTableAvailable`:
  - 0 / 16 / 'abc' → throws (범위/형식)
  - locked 7번 → throws
  - 진행 중 5번 → throws
  - SETTLED 5번 → 통과 (재선택 가능)
  - CANCELED 5번 → 통과

**필수 테스트 (server/routes/__tests__/customer.test.js 추가):**
- POST /api/orders availability:
  - 5번 점유 상태에서 5번 주문 시도 → 409 + 정확한 메시지
  - 5번 잠금 상태에서 5번 주문 시도 → 409 + 정확한 메시지
  - 5번 SETTLED 후 5번 주문 시도 → 200
  - 포장 주문은 점유 검증 우회 → 200
- GET /api/tables/availability:
  - 응답 형태 검증 — order_no, dining_at, locked_at 등이 *응답에 없음*

**완료 조건:**
- 추가 테스트 모두 green. 기존 1185/1185 + 신규 (대략) 16건.
- `docker compose -f docker-compose.dev.yml exec dev npm test` 통과.

---

### Subagent 2 — Order State Transition Agent

**담당:**
- `server/domain/order-state.js` 합법 전이 갱신 (DINING/SETTLED 추가, DONE 진입 차단).
- `init.sql` 갱신: orders.status enum + dining_at/settled_at 컬럼.
- `STATUS_TIME_FIELD`에 DINING/SETTLED 추가.
- 사용자 진행 중 주문 표시 정책 갱신(RecentOrdersSection).

**의존 파일:**
- `server/domain/order-state.js`
- `server/domain/__tests__/order-state.test.js` (ADR-025 18 케이스 — 신중하게 갱신)
- `server/repositories/order-repo.js`
- `server/db/init.sql` (마이그레이션 X, init.sql만 갱신)
- `src/components/organisms/RecentOrdersSection.jsx`
- `src/pages/customer/StatusPage.jsx` (DINING/SETTLED 안전망 카피만)

**구현 가이드라인:**
- 합법 전이 갱신:
  ```js
  READY:    ['DINING', 'CANCELED'],     // DONE 직접 전이 제거
  DINING:   ['SETTLED', 'CANCELED'],    // 신규 — DONE이 아니다
  SETTLED:  [],                          // 신규 터미널
  DONE:     [],                          // 보존(dead status, 어디서도 진입 X)
  ```
- `LEGAL_TRANSITIONS`의 어떤 좌변에도 *'DONE' 우변이 나타나지 않아야 함*. 회귀 테스트로 명시.
- ACTION_LABEL 갱신:
  ```js
  DINING:  '전달 완료',
  SETTLED: '테이블 준비 완료',
  // DONE: 유지하되 더 이상 발생하지 않는 라벨
  ```
- `init.sql` 갱신:
  - orders.status CHECK enum: `'DINING'`, `'SETTLED'` 추가.
  - orders 테이블 컬럼 정의에 `dining_at TEXT`, `settled_at TEXT` 추가.
- `STATUS_TIME_FIELD` (`server/repositories/order-repo.js:157`):
  ```js
  DINING:  'dining_at',
  SETTLED: 'settled_at',
  ```
- RecentOrdersSection: `TERMINAL = new Set(['DINING', 'DONE', 'SETTLED', 'CANCELED'])`.
- StatusPage.STATE_LABEL 추가:
  ```js
  DINING:  '식사 중! 맛있게 드세요!',
  SETTLED: '주문이 완료되었어요. 또 오세요!',
  ```

**필수 테스트:**
- order-state.test.js 갱신:
  - READY → DINING: 합법
  - READY → DONE: **불법**(throws)
  - READY → SETTLED: **불법**(DINING 우회 차단)
  - DINING → SETTLED: 합법
  - DINING → DONE: **불법**(DONE은 dead)
  - DINING → CANCELED: 합법
  - DINING → READY: **불법**
  - 모든 합법 전이의 우변에 'DONE'이 없음 회귀(메타 테스트)
- order-repo.test.js:
  - updateOrderStatus(id, 'DINING') → dining_at 자동 기록
  - updateOrderStatus(id, 'SETTLED') → settled_at 자동 기록
- RecentOrdersSection.test:
  - status='DINING'/'SETTLED' 카드는 마운트 직후 hide + store에서 즉시 removeOrder
  - status='READY'인 카드는 표시 유지 (회귀)
- bootstrap.test.js 확장:
  - 신규 init.sql 실행 후 orders status enum에 'DINING','SETTLED' 포함 확인
  - dining_at/settled_at 컬럼 존재 확인

**완료 조건:**
- ADR-025 회귀 갱신: 약 14~15 합법 + 6+ 불법. 신규 케이스 명시.
- `docs/DECISIONS.md`에 ADR-025 갱신 노트 + ADR-035 후보 추가 (사용자 결정).

---

### Subagent 3 — Admin Dashboard Dining Agent

**담당:**
- 본부 대시보드 7컬럼 확장 + DINING 컬럼 추가.
- READY 컬럼 "전달 완료" 버튼이 DINING으로 전이.
- DINING 컬럼 카드 표시(번호/위치/메뉴 요약/식사 경과 시간/테이블 준비 완료 버튼).
- `elapsedMinutes` baseline 분기 (DINING은 `dining_at`).
- DINING 전용 30/60분 elapsed tone 함수 추가.

**의존 파일:**
- `src/constants/admin-columns.js`
- `src/components/organisms/AdminCardColumn.jsx`
- `src/styles/components.css` 또는 `docs/design-bundle/app.css`의 `.admin-board` grid-template-columns (확인 필요)
- `src/pages/admin/DashboardPage.jsx` (1분 tick은 그대로)

**구현 가이드라인:**
- ADMIN_COLUMNS 갱신 (DINING은 READY와 HOLD 사이):
  ```js
  { status: 'READY',    title: '수령대기',  color: 'border-accent' },
  { status: 'DINING',   title: '식사중',    color: 'border-success' },
  { status: 'HOLD',     title: '보류',      color: 'border-danger' },
  ```
- ACTION_BY_STATUS (★ to: 'SETTLED' — DONE 아님):
  ```js
  READY:  [{ label: '전달 완료',        to: 'DINING',  variant: 'primary' }],
  DINING: [{ label: '테이블 준비 완료', to: 'SETTLED', variant: 'primary' }],
  ```
- OrderCard 내부 elapsed baseline + tone 분기:
  ```js
  const baselineAt = order.status === 'DINING' ? order.dining_at : order.transferred_at;
  const tone = order.status === 'DINING' ? diningElapsedTone(elapsedMin) : elapsedTone(elapsedMin);

  // 신규 함수
  function diningElapsedTone(minutes) {
    if (minutes >= 60) return 'border-danger';
    if (minutes >= 30) return 'border-warning';
    return 'border-divider';
  }
  ```
- `.admin-board`가 6컬럼 grid면 7컬럼으로 갱신. 좁은 폭에서 가로 스크롤 허용.

**필수 테스트 (Vitest + jsdom):**
- admin-columns.test:
  - ADMIN_COLUMNS 길이 7
  - 'DINING' 컬럼이 'READY'와 'HOLD' 사이
- AdminCardColumn.test 갱신:
  - READY 카드의 버튼 라벨/대상이 '전달 완료' → 'DINING'
  - DINING 카드의 버튼이 '테이블 준비 완료' → **'SETTLED'**
  - DINING 카드 elapsed가 dining_at 기준
  - DINING 카드 elapsed=29 → border-divider, 30 → border-warning, 60 → border-danger
  - READY/COOKING 카드 elapsed는 transferred_at 기준 + 5/10분 tone (회귀)

**완료 조건:**
- 키보드 navigation 회귀 차단(7컬럼이라 tab 순서 영향 가능 — KeyboardHelpModal 카피 갱신 필요 여부 확인).
- `npm run dev` 후 브라우저에서 7컬럼 확인 — 화면 캡처는 작업 로그에 첨부 권장.

---

### Subagent 4 — Admin Table Lock Agent

**담당:**
- 어드민 nav에 "테이블 잠금" 탭 추가 — *쿠폰 오른쪽 끝* 위치.
- `/admin/tables` 라우트 및 TablesPage 신설.
- `GET /admin/api/tables` + `POST /admin/api/tables/:n/lock|unlock` 엔드포인트.
- `admin_events`에 TABLE_LOCK / TABLE_UNLOCK 이벤트 기록 — **`category='system'`** (Q6 확정).

**의존 파일:**
- `src/components/layouts/AdminLayout.jsx`
- `src/App.jsx`
- `src/api/routes.js`
- `src/pages/admin/TablesPage.jsx` (신규)
- `server/routes/admin.js`
- `server/repositories/table-locks-repo.js` (Subagent 1에서 신설)
- `server/repositories/admin-events-repo.js`

**구현 가이드라인:**
- nav 추가:
  ```js
  { to: '/admin/tables', label: '테이블 잠금', testid: 'admin-nav-tables' }
  ```
- TablesPage 구성:
  - 헤더 + biz-badge
  - 1~15 카드 그리드 (5×3)
  - 카드 상태 배지: 사용 가능 / 이용 중(주문 #N) / 식사 중(N분 경과) / 잠김
  - 카드 버튼 단일:
    - 잠김 → "잠금 해제"
    - 잠김 아님 → "잠금"
  - **사유 입력 모달 없음** (Q4) — 클릭 즉시 POST.
  - 점유 + 잠김 중첩 상태에서 잠금 해제 후 토스트: "수동 잠금만 해제됐어요. 진행 중 주문 때문에 아직 사용할 수 없습니다."
- 라우트 보호: AdminLayout 안에서 401 → /admin/login (기존 패턴).
- POST 잠금/해제 시 CSRF 토큰 사용 (어드민 기존 패턴).
- 이벤트 로그:
  - `category='system'` (Q6), `event_type='TABLE_LOCK'|'TABLE_UNLOCK'`, `action_name='테이블 잠금'|'테이블 잠금 해제'`.
  - `target_id`에 `table_no`, `target_name='테이블 N번'`.
  - operating_date는 `getBusinessState(db).operating_date`로 채움 (find_error_v3 P1-2 동일 회귀 방지).

**필수 테스트:**
- 서버:
  - `table-locks-repo.test.js`: UPSERT 한 행 보존(UNIQUE table_no), 잠금/해제 토글 시 timestamp 갱신, **reason 컬럼 없음 회귀**.
  - `admin.test.js` 추가:
    - POST /admin/api/tables/7/lock (body `{}`) → 200 + 응답 row.locked=true
    - POST /admin/api/tables/7/unlock → 200 + row.locked=false
    - POST /admin/api/tables/0/lock → 400 (범위 외)
    - POST /admin/api/tables/16/lock → 400
    - 잠금 후 `POST /api/orders` 7번 → 409 + 메시지 일치
    - 점유 후 unlock → POST /api/orders 7번은 여전히 409 (점유 우선)
    - admin_events INSERT 확인: category='system', event_type='TABLE_LOCK', target_id=7, operating_date≠NULL
    - `GET /admin/api/history?type=system` → TABLE_LOCK/UNLOCK 노출 (메뉴 변경/로그인과 함께)
- 프론트:
  - `TablesPage.test.jsx`:
    - 카드 15장 렌더
    - locked 카드의 버튼 라벨 = "잠금 해제"
    - 잠금 클릭 시 *모달 없이* 바로 POST 호출
    - 점유 중 카드의 잠금 해제 토스트 문구

**완료 조건:**
- nav 5종 → 6종으로 확장. 기존 AdminLayout.test 갱신.
- `/admin/tables` 라우트가 미인증 시 /admin/login 으로 리다이렉트.

---

### Subagent 5 — Customer Table UX Agent

**담당:**
- CheckoutPage 테이블 선택 radio-cell에 disabled 처리.
- `GET /api/tables/availability` fetch — **진입 시 1회 + 주문 접수 버튼 클릭 직전 1회만** (Q5 확정, 폴링 X).
- 안내 문구 노출 — 제출 시 서버 409 응답 시 동일 문구.
- availability fetch 실패 시 fallback UX (모든 선택 허용 + 제출 시 서버 거부 메시지).

**의존 파일:**
- `src/pages/customer/CheckoutPage.jsx`
- `src/api/routes.js`
- 옵션: `src/hooks/useTablesAvailability.js` 신규 (재사용 위해 — Subagent 5 자체 판단)

**구현 가이드라인:**
- 테이블 카드 disabled 상태:
  - `aria-disabled="true"`, `tabIndex={-1}`, `pointer-events:none`(또는 className)
  - 클릭 시도 시 `errorMessage` 영역에 안내 문구 표시
- availability fetch 횟수:
  - CheckoutPage 진입(`useEffect` 마운트) 시 1회.
  - 사용자가 "주문 접수" 버튼 클릭 → POST 직전 한 번 더. *결과가 사용 가능*이면 그대로 POST; *사용 불가*면 안내 + POST 중단.
  - 폴링/SSE/주기 fetch 없음.
- availability 응답이 없거나 5xx → 모든 테이블 enable + 제출 시 안내 (보수적 fallback).
- 안내 문구는 한 곳에서 관리: 상수 export.
- 사용자 카피는 정확히:
  > "현재 선택하신 테이블은 이용 중이거나 준비 중입니다. 번거로우시겠지만 다른 테이블로 이동해 주세요."

**필수 테스트:**
- CheckoutPage.test.jsx 확장:
  - 마운트 시 availability fetch 1회 호출 확인
  - 폴링 없음: 30초 경과 후에도 fetch 호출 횟수 1회 유지
  - 제출 클릭 시 두 번째 fetch 발생
  - availability 응답에서 5번 occupied → 5번 버튼 aria-disabled=true
  - 5번 dining → aria-disabled=true
  - 7번 locked → aria-disabled=true
  - 사용 불가 테이블 클릭 → errorMessage 노출
  - 사용 가능 테이블만 활성 + 정상 제출 200
  - availability 5xx → 모두 enable + 제출 시 서버 거부 안내
  - 서버가 stale 검증(409) 응답 시 동일 안내 문구 노출
- 서버 mocking 없이 MSW 도입 여부는 기존 패턴(`apiFetch` mock) 따른다.

**완료 조건:**
- CheckoutPage가 a11y violations 0건 유지(axe-core dev-only).
- 시각 확인: `npm run dev` 후 5번 테이블 점유 시 disabled 모습 확인 — 작업 로그에 캡처.

---

### Subagent 6 — Logging & QA Agent

**담당:**
- 이벤트 로깅 회귀 마무리:
  - 잠금/해제: admin_events 1행 (Subagent 4가 구현 — 본 agent는 회귀 검증, category='system' 확인)
  - READY → DINING / DINING → SETTLED: order_events 1행씩 (기존 transition 라우트의 `actor: 'admin'`이 자동 처리 — 회귀 확인)
- 전체 회귀 통과: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build` 모두 docker exec.
- 운영 경로 사이드체크 (ADR-033): `docker compose up -d --build` → `curl -sI` 회귀.
- **DB 초기화 절차 문서화**: 운영 컨테이너 데이터 볼륨 초기화 수동 명령. `docs/operations/admin-card.md` 또는 `d1-rehearsal.md`에 기록.
- 문서 동기화:
  - `docs/API_DRAFT.md` § 사용자/관리자 API 신규 4건
  - `docs/DB_DRAFT.md` table_locks / orders.status / dining_at / settled_at 갱신
  - `docs/DECISIONS.md` 변경 로그에 본 라운드 한 줄 + ADR-025 갱신 노트 (또는 ADR-035)
  - `CLAUDE.md` "절대 깨지면 안 되는 것"에 본 기능 한 줄 추가
  - `docs/IMPLEMENTATION_PROGRESS.md`에 라운드 매트릭스 한 줄
- 작업 로그 6건 정리: `docs/tasks/2026-05-XX-table-occupancy-{1..6}.md`

**필수 회귀 매트릭스 (모두 통과):**
- `server/domain/__tests__/order-state.test.js` — 갱신된 합법 전이 (DONE 진입 차단)
- `server/domain/__tests__/table-availability.test.js` — 신규
- `server/routes/__tests__/customer.test.js` — POST /api/orders availability 가드 + GET /api/tables/availability (order_no 미포함)
- `server/routes/__tests__/admin.test.js` — GET/POST /admin/api/tables*, admin_events 'system' 카테고리 회귀
- `server/repositories/__tests__/table-locks-repo.test.js` — 신규 (reason 컬럼 없음 회귀)
- `server/__tests__/bootstrap.test.js` — 신규 init.sql 스키마 검증 (status enum + dining_at/settled_at + table_locks)
- `src/components/organisms/__tests__/RecentOrdersSection.test.jsx` — DINING/SETTLED 제외
- `src/components/organisms/__tests__/AdminCardColumn.test.jsx` — 라벨/대상 갱신 + DINING 30/60분 tone
- `src/pages/admin/__tests__/TablesPage.test.jsx` — 신규
- `src/pages/customer/__tests__/CheckoutPage.test.jsx` — disabled UX + fetch 횟수
- 회귀 매트릭스(CLAUDE.md "절대 깨지면 안 되는 것"): 쿠폰/이체/상태 전이/영업 상태/정산 마감 회귀 모두 그린.

**완료 조건:**
- `npm test` 신규 케이스 포함 *전건 green*.
- `npm run build` cross-env로 prod 번들 정상 (axe-core 흔적 0).
- 운영 컨테이너에서 `curl -sI http://localhost/api/tables/availability` 200.
- `docs/tasks/2026-05-XX-table-occupancy-summary.md`에 라운드 종합 로그.

---

## 3. 구현 금지/주의

- ADR-019 쿠폰 학번 정규식 변경 금지.
- ADR-020 Pattern B(서버 가격 자체 계산) 변경 금지.
- ADR-021 학번+이름 필수 변경 금지.
- 이체 완료 요청 / 다른 이름 이체 / TRANSFER_REPORTED 중복 가드 변경 금지.
- 메뉴 토글/가격 변경 로직 변경 금지.
- 영업 상태 머신(OPEN/CLOSED) 변경 금지.
- 정산 마감(ADR-012) — 진행 중 주문 0건일 때만 마감. DINING도 *진행 중*으로 간주되어 마감을 자연스럽게 막는 것 외에 별도 변경 없음.
- 테이블 번호는 1~15 유지. DB 레벨 CHECK 추가는 *허용*(이중 방어).
- 같은 테이블 동시 주문 race condition 방어를 위한 partial unique index/고급 transaction locking은 *본 범위 외*.
- **마이그레이션 스크립트 작성 금지** (Q7 확정). `init.sql`만 갱신.
- **DONE 상태로의 합법 전이 추가 금지** — DONE은 dead status. 어떤 LEGAL_TRANSITIONS 우변에도 'DONE' 등장 X.
- **`table_locks.reason` 컬럼 추가 금지** (Q4 확정).
- **사용자 API에 order_no 노출 금지** (Q2 확정).
- **사용자 측 polling 추가 금지** (Q5 확정 — 진입 1회 + 제출 직전 1회).
- `init.sql` 메뉴 시드(8 메뉴) / business_state 단일 행 CHECK / 시스템 설정 키들은 손대지 말 것.
- `.env`, 비밀키, DB 실데이터, 세션 파일은 열람·수정 금지.

---

## 4. 커밋·브랜치 정책

- 브랜치: 현재 `table_lock` 유지. *main에서 직접 작업 금지*.
- 커밋 단위: subagent별 1 커밋 최소. red→green→refactor는 같은 커밋에 묶어도 됨.
- 커밋 메시지(한국어):
  - `feat(table-occupancy): availability 도메인 + locks 리포 (Subagent 1)`
  - `feat(table-occupancy): READY→DINING→DONE 전이 + 마이그레이션 (Subagent 2)`
  - ...
- merge 전 `npm test` / `npm run build` / `curl -sI` 회귀 통과 확인 — *각 subagent 종료 시*.

---

## 5. 진행 순서 요약

```
Subagent 1: availability 도메인 + locks 리포  ┐
                                              │ 백엔드 기반 마련
Subagent 2: 상태 전이(DINING) + 마이그레이션  ┘

Subagent 3: 어드민 대시보드 7컬럼 + 액션 매트릭스
Subagent 4: 어드민 테이블 잠금 페이지 + API

Subagent 5: 사용자 테이블 선택 UX (disabled + 안내)

Subagent 6: 로깅·문서·회귀 매트릭스 마무리
```

- 1 → 2 의존(상태 enum이 availability 점유 집합에 영향). 2가 끝나야 3·4·5 시작.
- 3·4·5는 *서로 의존 없음*이지만 **병렬 실행 금지** — 사용자 정책상 직렬화. 순서는 3 → 4 → 5 권장(어드민 우선 정착 후 사용자).
- 6은 마지막.

---

## 6. 자매 문서 참고

- 설계 근거 / 데이터 모델 / API 스키마: `docs/table_occupancy_development_plan.md`
- 시나리오/자동 테스트/통과 기준: `docs/table_occupancy_qa_plan.md`
