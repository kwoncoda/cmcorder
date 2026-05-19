# design_fix_v4 개발 기획서

> 작성일: 2026-05-19 / 브랜치: `design_fix_v4` / 작성자: Claude
> 본 문서는 *설계 문서*이며 코드 변경을 포함하지 않는다.
> 짝 문서: `docs/design_fix_v4_work_instruction.md` (작업), `docs/design_fix_v4_qa_plan.md` (검수).
> 기반: table_lock 라운드 3종 문서(`docs/table_occupancy_*.md`) + Codex 최종 게이트 리뷰(`codereview/codex_table_lock_final_gate_review.md`).

---

## 0. 사전 전제 (반드시 먼저 읽기)

- 운영 기간: 2026-05-20 ~ 2026-05-21. 일회성 양일 운영. 인수인계·Phase 2 가중치 X.
- 테이블 번호 1~15, 매장 식사 흐름 `READY → DINING → SETTLED`, DONE은 dead status. *모두 table_lock 라운드에서 lock-in*.
- 환경: 모든 dev·테스트·검증은 docker 컨테이너 (ADR-033). 호스트 `npm` 직접 호출 금지.
- 본 라운드의 변경 동기:
  1. 사용자가 *홈에서 좌석 배치도 기능을 더 명확히 인지*하기를 원함. 현재 헤더의 36×36 작은 아이콘은 메뉴 카테고리 영역과 시각적 거리가 멀어 "주문 전 위치 확인" 흐름이 끊김.
  2. 포장 주문이 잘못 *식사 중* 컬럼에 들어가 운영자가 테이블 회전 추적에 혼선을 받음. 포장은 테이블을 점유하지 않으므로 DINING 단계 자체가 불필요.

---

## 1. 목적

### 1.1 홈 테이블 배치도 CTA 인지 개선

- 사용자가 메뉴 페이지 진입 직후 "테이블 배치도" 기능의 존재와 위치를 *명확히* 인지하게 한다.
- 카테고리 바("전체 / 추천 / 치킨 / 사이드 / 음료") 위쪽에 *적당한 크기의 카드/버튼 CTA*를 신규 배치 — 작은 헤더 아이콘만으로는 부족하다는 사용자 판단을 반영.
- 클릭 동작은 기존 미니맵 모달(또는 MapPage)을 그대로 재사용 — *새 자산/새 모달 X*.

### 1.2 포장/매장 식사 흐름 분리

- *매장 식사*(`dineIn`): 현 `READY → DINING → SETTLED` 흐름을 유지. 테이블 점유 추적과 식사 경과 시간(30/60분 임계 톤) 가시화 그대로.
- *포장*(`takeout`): `READY → SETTLED` 직접 전이. DINING을 건너뛰어 운영자 대시보드 "식사 중" 컬럼에 표시되지 않으며, 사용자 진행 중 주문 카드에서도 즉시 사라진다.
- 정산/스냅샷의 SETTLED 기준은 그대로 유지 — 포장 주문도 SETTLED로 정상 집계.

---

## 2. 현재 구조 분석 (코드 확인 결과)

### 2.1 홈 테이블 배치도 CTA

**현재 좌석/테이블 배치도 진입 경로:**
- `src/components/layouts/CustomerLayout.jsx:88-95`
  ```jsx
  <Link
    to="/map"
    aria-label="부스 미니맵"
    className="icon-btn"
    data-testid="header-map-link"
  >
    <img src="/pubg-map.png" alt="" width="28" height="28" style={{ display: 'block' }} />
  </Link>
  ```
- 위치: 헤더 `.head-actions` div 안 좌측, 인벤토리 버튼(`header-cart-link`, 라인 96-104) 바로 왼쪽.
- 크기: `.icon-btn` 36×36px (`src/styles/components.css:53-66` — Explore agent 보고).
- 사용자 인지 약함: 단일 아이콘 + 작은 크기, 메뉴 카테고리 영역과 시각적 분리.

**인벤토리 버튼:**
- 같은 `.head-actions` 안 우측. count-badge로 카트 수량 노출. CTA 이동과 *무관하게 유지*.

**`/map` 라우트:**
- `src/App.jsx:79` `<Route path="/map" element={<MapPage />} />`.
- `src/pages/customer/MapPage.jsx:14-38` — `BoothMinimapModal open={true}` 풀스크린 모달 + `onClose={() => navigate(-1)}` history back. 38줄.
- 메인 이미지: `/map/table-location.webp` (`MapPage.jsx:11`).
- `?order_id=N` 쿼리로 본인 테이블 강조.

**미니맵 모달:**
- `src/components/organisms/BoothMinimapModal.jsx` 163줄. forwardRef + focus trap + body scroll lock + 3가지 닫기(top-x/backdrop/escape).
- `mapImage`가 있으면 큰 이미지 렌더, 없으면 그리드 fallback.
- design_fix_v3 라운드에서 `.minimap-legend` 두 줄 삭제 — `MapPage.test.jsx`에 legend 미노출 회귀 포함.

**메뉴 페이지 구조:**
- `src/pages/customer/MenuPage.jsx:53-71` (총 72줄):
  ```jsx
  <section data-testid="menu-page" style={{ paddingBottom: 96 }}>
    <RecentOrdersSection />              // line 55
    <CategoryTabs ... />                  // line 56 ← 이 위쪽에 CTA 삽입
    {category === 'all' && <RecommendedBanner ... />}
    {filteredMenus.length === 0 ? <EmptyState ... /> : <MenuList ... />}
    <StickyCartBar onCheckout={...} />
  </section>
  ```
- `CATEGORIES` 상수: 라인 16-22 (5개 — 전체/추천/치킨/사이드/음료).
- `CategoryTabs` 컴포넌트: `src/components/organisms/CategoryTabs.jsx` (42줄, Explore 보고). `role="tablist"` + 가로 스크롤(`overflow-x: auto`).
- §3.5 1조: 페이지 ≤120줄 제약. 현재 72줄이라 여유.

**사용 가능한 자산:**
- `public/map/table-location.webp` — 메인 약도 (Glob 검증).
- `public/pubg-map.png` — 헤더 아이콘.
- `public/pubg-inventory.webp` — 인벤토리 아이콘.
- `public/mascot/mascot.png` — 헤더 브랜드.
- 새 이미지 생성 *금지* (사용자 명시 정책).

**관련 테스트:**
- `src/components/organisms/__tests__/BoothMinimapModal.test.jsx` — 모달 3가지 닫기 + 그리드 fallback.
- `src/pages/customer/__tests__/MapPage.test.jsx` — `/map` 진입 + legend 미노출.
- `src/components/organisms/__tests__/CategoryTabs.test.jsx` — 5개 탭 + onChange.
- `src/pages/customer/__tests__/MenuPage.test.jsx` — 카테고리 필터링.

### 2.2 포장/매장 식사 흐름

**delivery_type 필드:**
- `server/db/init.sql:52`
  ```sql
  delivery_type TEXT NOT NULL DEFAULT 'dineIn' CHECK(delivery_type IN ('dineIn','takeout')),
  ```
- 스키마: `server/routes/customer.js:49` `z.enum(['dineIn','takeout']).optional()`. 기본값 `dineIn`.
- 포장 시 `table_no=NULL` 허용. dineIn 시 1~15 필수 (`customer.js:74-86`).

**응답 직렬화:**
- `server/routes/admin.js:106-117` `serializeAdminOrder` — `...rest` spread로 delivery_type 자동 포함.
- `server/routes/customer.js:335` `serializeOrder` — 명시적으로 `delivery_type: o.delivery_type` 포함.

**관리자 대시보드 카드 표시:**
- `src/components/organisms/AdminCardColumn.jsx:79-85` `formatLocationLabel`:
  ```js
  function formatLocationLabel(order) {
    if (order.delivery_type === 'takeout') return '포장';
    if (order.delivery_type === 'dineIn') {
      return order.table_no != null ? `테이블 ${order.table_no}` : '테이블 미지정';
    }
    return null;
  }
  ```
- 카드에 `<div data-testid="order-location">` 텍스트로 노출 (라인 159).

**READY 컬럼 "전달 완료" 버튼 (현재):**
- `AdminCardColumn.jsx:104`
  ```js
  READY:  [{ label: '전달 완료',        to: 'DINING',  variant: 'primary' }],
  DINING: [{ label: '테이블 준비 완료', to: 'SETTLED', variant: 'primary' }],
  ```
- *포장/매장 식사 구분 없이* 모두 `to: 'DINING'` 전송. ← **수정 지점**.

**상태 전이 API:**
- `server/routes/admin.js:325-341` `POST /admin/api/orders/:id/transition`. body 스키마 `to: z.string().min(1)`.
- 핸들러는 `transition(order.status, to)` 호출 후 `updateOrderStatus(db, order.id, to, ...)`. delivery_type *미검사*.
- 불법 전이 시 `StateTransitionError` → 409.

**도메인 상태 머신:**
- `server/domain/order-state.js:30-46` `LEGAL_TRANSITIONS`:
  ```js
  READY:    ['DINING', 'CANCELED'],   // ← READY → SETTLED 는 현재 *불법*
  DINING:   ['SETTLED', 'CANCELED'],
  SETTLED:  [],
  DONE:     [],                        // dead status (어떤 우변에도 DONE 없음)
  ```
- `canTransition(from, to)` / `transition(from, to)` — 현재 *delivery_type 인자 없음*.

**updateOrderStatus:**
- `server/repositories/order-repo.js:179-211`. `STATUS_TIME_FIELD`에 DINING→dining_at, SETTLED→settled_at. delivery_type 분기 *없음*.

**사용자 진행 중 주문 제외:**
- `src/components/organisms/RecentOrdersSection.jsx:22`
  ```js
  const TERMINAL = new Set(['DINING', 'DONE', 'SETTLED', 'CANCELED']);
  ```
- 라인 39: `if (s && TERMINAL.has(s)) removeOrder(entry.id);` — *SETTLED 포함이라 포장 SETTLED 후 자동 hide* ✓.

**정산/스냅샷 SETTLED 기준:**
- `server/domain/settlement.js:36` `COMPLETED_STATES = ['SETTLED', 'DONE']` (Explore agent 보고).
- `server/jobs/auto-snapshot.js` 스냅샷 집계도 SETTLED 기반.
- 정산 마감 가드(ADR-012): `IN_PROGRESS_STATES`에 DINING 포함 — DINING 1건이라도 남으면 마감 거부.
- *포장 SETTLED는 매장 식사 SETTLED와 동일하게 집계됨* ✓.

**테이블 점유와 포장의 관계:**
- `server/domain/table-availability.js:20-28` `OCCUPYING_STATUSES` + 라인 66 `AND table_no IS NOT NULL` 필터.
- 포장 `table_no=NULL` 이므로 *자연스럽게 점유 계산에서 제외* ✓.

**관련 테스트:**
- `server/domain/__tests__/order-state.test.js` — ADR-025 합법/불법 전이 + DONE 메타 회귀.
- `server/routes/__tests__/admin.test.js` — `POST /admin/api/orders/:id/transition` 합법/불법.
- `server/routes/__tests__/customer.test.js` — POST `/api/orders` + takeout/dineIn 케이스.
- `src/components/organisms/__tests__/AdminCardColumn.test.jsx` — READY/DINING 버튼.
- `src/components/organisms/__tests__/RecentOrdersSection.test.jsx` — TERMINAL 제외.
- `server/domain/__tests__/settlement.test.js` — SETTLED 집계.

---

## 3. 개선 정책

### 3.1 테이블 배치도 CTA 정책

- **위치:** 메뉴 페이지(`MenuPage.jsx`) 안에서 `<RecentOrdersSection />`과 `<CategoryTabs />` 사이.
- **헤더의 작은 좌석 배치도 버튼은 *유지*** — 사용자 1차 요청은 "제거하거나 이동"이지만, 다른 페이지(`/checkout`, `/orders/:id/status` 등)에서도 헤더에서 진입할 수 있어야 한다. CTA는 *홈 한정 추가*. ★ 사용자가 명시적으로 헤더 버튼 제거를 원하면 다음 라운드에 반영.
- **형태:** 가로 카드형 CTA — 단순 아이콘이 아니라 인지 비용 0의 크기.
- **필수 문구:** "테이블 배치도"
- **추천 보조 문구:** "주문 전 테이블 위치를 확인해 주세요"
- **버튼/보조 문구:** "배치도 보기" 또는 우측 화살표.
- **클릭 동작:** 기존 미니맵 진입(권장: `Link to="/map"`). 자세한 비교는 §4 참조.
- **자산:** 기존 `public/map/table-location.webp`을 *작은 썸네일/배경 데코*로만 활용 가능. 새 이미지 생성 X.
- **모바일 적정 크기:** 가로 100% × 세로 약 80~96px 범위. 카테고리 바를 시각적으로 압도하지 않을 것.
- **인벤토리 버튼/카테고리 필터 기능은 손대지 않는다.**

### 3.2 포장 주문 상태 전이 정책

**매장 식사(`dineIn`):**
```
ORDERED → TRANSFER_REPORTED → PAID → COOKING → READY → DINING → SETTLED
```
*기존 흐름 유지*.

**포장(`takeout`):**
```
ORDERED → TRANSFER_REPORTED → PAID → COOKING → READY → SETTLED
                                                ↑ DINING 건너뜀
```

**정책 요약:**
- 포장 주문은 DINING 상태로 가지 않는다.
- 포장 주문은 어드민 대시보드 *식사 중* 컬럼에 표시되지 않는다.
- 포장 주문은 전달 완료(`READY → SETTLED`) 직후 사용자 진행 중 주문 카드에서 사라진다(기존 TERMINAL set이 SETTLED 포함이라 자동 작동).
- 포장 주문은 테이블 점유에 영향을 주지 않는다(`table_no=NULL` 자연 방어).
- 정산/스냅샷의 SETTLED 기준은 유지 — 포장도 동일하게 집계.

**DONE 상태는 변경 없음** — table_lock 라운드의 *dead status* 정의 유지. 어떤 합법 전이의 우변에도 DONE 등장 X. 메타 회귀 보호.

---

## 4. 구현 방식 제안

### 4.1 CTA 동작: A vs B

| 방식 | 변경 범위 | 장점 | 단점 |
|---|---|---|---|
| **A. `<Link to="/map">`** ★권장 | MenuPage CTA 1행 삽입(또는 organism 1개 신규) | 헤더 미니맵 버튼과 *동일 라우트*라 일관성 ↑. `BoothMinimapModal` state 관리 추가 X. MenuPage ≤120줄 제약 부담 0. `MapPage.test.jsx`/`BoothMinimapModal.test.jsx` 회귀 그대로 유효 | 페이지 전환 1회 (BACK 1회 추가) |
| B. 인플레이스 모달 (`useState` + `BoothMinimapModal` 인라인) | MenuPage에 모달 state + render | 페이지 전환 없음 | MenuPage 라인 ↑, 새 state, focus trap 충돌 가능성 점검 필요 |

**권장: A**. 사용자 학습 비용 0, 코드 변경 최소.

차선 B는 명시 비교 후 사용자 판단에 맡김. ★ 사용자가 "페이지 전환 없이 곧바로 모달"을 명시하면 B 채택.

### 4.2 포장 흐름: A vs B vs C

| 방식 | 핵심 변경 | 장점 | 단점 |
|---|---|---|---|
| A. 프론트 분기 only | AdminCardColumn에서 delivery_type 보고 to 결정 | 최소 변경 | API 직접 호출 시 차단 없음 |
| B. 서버 방어 only | `transition`/라우트에서 delivery_type 검사 | 강한 방어 | UI는 그대로 DINING 시도 → 서버 거부 회로 |
| **C. 둘 다** ★권장 | 도메인 함수가 정책 단일 출처, UI도 분기 | 사용자 명시 권장. 양쪽 방어선 | 변경 파일 다소 증가 |

**권장: C**. 사용자가 명시한 "UI와 서버 둘 다 안전" 원칙.

### 4.3 권장안 상세 (방식 C)

**서버 측 (도메인 단일 출처):**

1. `server/domain/order-state.js` — `canTransition` / `transition`에 `opts.deliveryType` 옵션 추가:
   ```js
   // 의사 코드
   export function canTransition(from, to, opts = {}) {
     const { deliveryType } = opts;
     // takeout 특수 케이스: READY → SETTLED 합법
     if (deliveryType === 'takeout' && from === 'READY' && to === 'SETTLED') return true;
     // takeout 방어선: READY → DINING 불법
     if (deliveryType === 'takeout' && from === 'READY' && to === 'DINING') return false;
     // 기본: LEGAL_TRANSITIONS 표 그대로 (dineIn 흐름)
     return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
   }
   ```
   - `LEGAL_TRANSITIONS` 표는 *변경하지 않는다* — DONE 메타 회귀 보호 유지.
   - 함수 시그니처에 opts 추가는 *backwards-compatible* — 기존 호출자(`transition(from, to)`)는 dineIn 흐름으로 자연 작동.

2. `server/repositories/order-repo.js` — `updateOrderStatus`가 `order.delivery_type`을 읽어 `transition(from, to, { deliveryType: order.delivery_type })`로 전달.

3. `server/routes/admin.js` — *추가 변경 거의 없음*. `updateOrderStatus`가 자동으로 도메인 가드 호출.

**프론트 측 (UI 의도 표현):**

4. `src/components/organisms/AdminCardColumn.jsx` — `ACTION_BY_STATUS` 상수 객체를 `getActionsForOrder(order)` 함수로 변형:
   ```js
   function getActionsForOrder(order) {
     if (order.status === 'READY') {
       if (order.delivery_type === 'takeout') {
         return [{ label: '전달 완료', to: 'SETTLED', variant: 'primary' }];
       }
       return [{ label: '전달 완료', to: 'DINING', variant: 'primary' }];
     }
     return ACTION_BY_STATUS[order.status] ?? [];
   }
   ```
   - 라벨은 둘 다 "전달 완료" — 운영자 인지 부담 최소.
   - 매장 식사 DINING 카드 "테이블 준비 완료" 버튼은 그대로.

**테스트 매트릭스:**
- `server/domain/__tests__/order-state.test.js`:
  - takeout READY → SETTLED 합법
  - takeout READY → DINING 불법(StateTransitionError)
  - dineIn READY → SETTLED 불법 (DINING 우회 차단 유지)
  - dineIn READY → DINING 합법(회귀)
  - 메타: LEGAL_TRANSITIONS 우변에 DONE 없음 — 그대로 유지
- `server/routes/__tests__/admin.test.js`:
  - takeout 주문 transition `to: 'SETTLED'` → 200
  - takeout 주문 transition `to: 'DINING'` → 409 + ILLEGAL_TRANSITION
  - dineIn 주문 transition `to: 'DINING'` → 200 (회귀)
- `src/components/organisms/__tests__/AdminCardColumn.test.jsx`:
  - takeout READY 카드의 버튼이 `to='SETTLED'` 호출
  - dineIn READY 카드의 버튼이 `to='DINING'` 호출(회귀)
- `src/components/organisms/__tests__/RecentOrdersSection.test.jsx`:
  - takeout 주문이 SETTLED로 전이된 후 카드 자동 hide(기존 TERMINAL set 회귀)
- `server/domain/__tests__/settlement.test.js`:
  - takeout SETTLED 주문이 정산 집계에 포함(회귀)
  - DINING 1건 남으면 마감 거부(회귀)

---

## 5. 심각도 분류

### P0 (절대 깨지면 안 됨)

- 포장 주문이 DINING으로 들어가 *식사 중 컬럼*에 잘못 표시되어 운영자가 테이블 회전을 오판하는 문제. 서버 방어선 핵심.
- 매장 식사 `READY → DINING → SETTLED` 흐름이 깨지는 회귀 — table_lock 라운드 lock-in 흐름.
- 정산/스냅샷 SETTLED 기준이 흔들려 매출 누락/중복 — SETTLED 단일 출처 보호.

### P1 (운영 사고 가능)

- API 직접 호출로 `takeout` 주문에 `to: 'DINING'`을 보냈을 때 차단 실패 — 서버 도메인 단일 출처가 가드해야 함.
- 포장 주문 SETTLED 후 사용자 진행 중 카드에 남는 회귀 — RecentOrdersSection TERMINAL 회귀.
- CTA 클릭이 미니맵을 열지 않거나 기존 헤더 버튼이 망가지는 회귀.
- 카테고리 필터 동작이 CTA 삽입으로 깨지는 회귀(키보드 navigation, tab 순서 포함).
- 테이블 점유 계산에 포장 주문이 잘못 포함되는 회귀(코드상 자연 방어되지만 회귀 케이스 명시 권장).
- LEGAL_TRANSITIONS 우변에 DONE이 슬쩍 추가되는 회귀(메타 회귀 유지).
- DINING 1건 남았을 때 정산 마감이 차단되지 않는 회귀(ADR-012).

### P2 (UX/디자인)

- CTA가 너무 작거나 카테고리 바와 시각적 충돌.
- 모바일에서 CTA가 과하게 커서 카테고리 바를 화면 아래로 밀어내는 회귀.
- CTA 클릭 영역이 좁아 터치 실수(44px 최소 영역 권장 — Web Interface Guidelines).
- 인벤토리 버튼이 시각적으로 가려지거나 위치 어색해짐.
- 포장 카드 시각적 구분 부족(현재 "포장" 텍스트만) — 본 라운드 범위 외 (★ 추후 개선 후보).

### P3 (다듬기)

- CTA 배경에 미니맵 썸네일 활용 시 텍스트 대비 가독성.
- "테이블 배치도" vs "테이블 지도" vs "배치도 보기" 등 카피 미세 조정.
- 모바일 다크 모드에서 CTA 색상 점검(현재 다크/옐로우 톤 일관).

---

## 6. 영향 받는 파일 (참고용)

| 영역 | 파일 | 변경 성격 |
|---|---|---|
| 프론트 페이지 | `src/pages/customer/MenuPage.jsx` | RecentOrdersSection/CategoryTabs 사이 CTA 삽입 |
| 프론트 organism (신규) | `src/components/organisms/TableMapCTA.jsx` | 신규 — 가로 카드형 CTA. *or* MenuPage 인라인 (★ 결정 필요, 권장: 분리) |
| 프론트 organism | `src/components/organisms/AdminCardColumn.jsx` | `ACTION_BY_STATUS` → `getActionsForOrder(order)` 함수화 |
| 프론트 스타일 | `src/styles/components.css` | `.table-map-cta` 신규 (다크/옐로우 톤) |
| 백엔드 도메인 | `server/domain/order-state.js` | `canTransition`/`transition`에 `opts.deliveryType` 추가 |
| 백엔드 리포 | `server/repositories/order-repo.js` | `updateOrderStatus`가 delivery_type 읽어 transition에 전달 |
| 회귀 테스트 | `server/domain/__tests__/order-state.test.js` | takeout/dineIn 분기 + DONE 메타 회귀 |
| 회귀 테스트 | `server/routes/__tests__/admin.test.js` | transition takeout/dineIn |
| 회귀 테스트 | `src/components/organisms/__tests__/AdminCardColumn.test.jsx` | READY 버튼 delivery_type 분기 |
| 회귀 테스트 (신규) | `src/components/organisms/__tests__/TableMapCTA.test.jsx` | 신규 — CTA 렌더 + Link to /map |
| 회귀 테스트 | `src/pages/customer/__tests__/MenuPage.test.jsx` | CTA 노출 + 카테고리 필터 회귀 |
| 회귀 테스트 (회귀) | `src/components/organisms/__tests__/RecentOrdersSection.test.jsx` | takeout SETTLED hide(이미 통과해야 함) |
| 회귀 테스트 (회귀) | `server/domain/__tests__/settlement.test.js` | takeout SETTLED 집계 + DINING 마감 차단 |
| 문서 | `docs/DECISIONS.md` | 갱신 노트 또는 ADR-036 후보 |
| 문서 | `CLAUDE.md` "절대 깨지면 안 되는 것" | design_fix_v4 한 줄 |
| 문서 | `docs/IMPLEMENTATION_PROGRESS.md` | 라운드 한 줄 |
| 운영 자산 | `docs/operations/admin-card.md` | 포장 주문 흐름 한 단락(있다면) |

`table_locks` 스키마 / `admin_events` 스키마 / 쿠폰 정책 / 이체 정책 / 미니맵 모달 자체 / 정산 SETTLED 기준 모두 *변경 X*.

---

## 7. 사용자 결정 필요 항목 (★ 확인 필요)

| # | 항목 | 권장 | 차선 |
|---|---|---|---|
| Q1 | CTA 동작 | A. `Link to="/map"` | B. 인플레이스 모달 |
| Q2 | CTA 형태 | 가로 카드(이미지+제목+보조문구+화살표) | 큰 버튼만 |
| Q3 | CTA 안에 미니맵 썸네일 활용 | 활용(우측 작은 썸네일) | 텍스트만 |
| Q4 | 컴포넌트 분리 | 신규 `TableMapCTA.jsx` organism | MenuPage 인라인 |
| Q5 | 헤더 작은 좌석 배치도 버튼 | *유지* | 제거(사용자 1차 표현 — "제거 또는 이동") |
| Q6 | CTA 카피 | "테이블 배치도 / 주문 전 테이블 위치를 확인해 주세요 / 배치도 보기" | 다른 표현 |
| Q7 | 포장 흐름 구현 방식 | C. UI + 서버 둘 다 | A 또는 B |

본 문서의 §4 권장안은 위 권장 컬럼을 채택한 결과. 사용자 결정으로 변경 가능.

---

## 8. 참고

- 짝 문서: `docs/design_fix_v4_work_instruction.md` (작업), `docs/design_fix_v4_qa_plan.md` (검수).
- 본 문서의 모든 코드 인용은 *현재 브랜치 `design_fix_v4`*의 파일을 기준으로 한다.
- 기반 회귀 매트릭스: CLAUDE.md "절대 깨지면 안 되는 것" + table_lock 라운드 회귀 매트릭스 + Codex final gate 리뷰의 P2/P3 매트릭스.
