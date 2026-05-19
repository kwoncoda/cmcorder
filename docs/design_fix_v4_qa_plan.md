# design_fix_v4 검수 지시서

> 작성일: 2026-05-19 / 브랜치: `design_fix_v4`
> 짝 문서: `docs/design_fix_v4_development_plan.md` (설계), `docs/design_fix_v4_work_instruction.md` (작업).
>
> **확정된 권장**: ① 홈 카테고리 바 위 `TableMapCTA` organism — `Link to="/map"`. ② 포장 `READY → SETTLED` 직접 전이 + 서버 도메인 단일 출처(`opts.deliveryType`). ③ 헤더 작은 미니맵 버튼은 *유지*. ④ DONE은 dead status 그대로.

---

## 0. 검수 원칙

- 본 검수는 *D-day 운영 시작(2026-05-20 16:30) 직전*까지 통과해야 한다. 일회성 양일 운영 — 회귀 발견 시 *해당 라운드 롤백*이 1순위.
- ADR-033 / CLAUDE.md "작업 절차" 4단계 준수. 모든 자동 테스트는 docker 컨테이너 안에서:
  ```bash
  docker compose -f docker-compose.dev.yml exec dev npm test
  docker compose -f docker-compose.dev.yml exec dev npm run test:e2e
  docker compose -f docker-compose.dev.yml exec dev npm run lint
  docker compose -f docker-compose.dev.yml exec dev npm run build
  ```
- 운영 경로 사이드체크는 운영 컨테이너에서:
  ```bash
  docker compose build app && docker compose up -d
  curl -sI http://localhost/                    # 200, SPA index
  curl -sI http://localhost/menu                # 200
  curl -sI http://localhost/map                 # 200
  curl -sI http://localhost/api/business-state  # 200
  ```
- `.env`, 비밀키, DB 실데이터, 세션 파일은 열람하지 않는다.

---

## 1. 사전 준비

- 브랜치가 `design_fix_v4`인지 확인:
  ```bash
  git branch --show-current   # → design_fix_v4
  ```
- dev 컨테이너 가동:
  ```bash
  docker compose -f docker-compose.dev.yml up -d
  ```
- 사용자 화면: 모바일 폭 390px 전후, 어드민 화면: 데스크톱 1024px 이상.
- 어드민 PIN을 stdout에서 확인.
- table_lock 라운드의 DB 스키마(`dining_at`/`settled_at`/`table_locks`)가 이미 적용된 DB에서 검수.

---

## 2. 시나리오 — 수동 QA 체크리스트

### 시나리오 1. 홈 테이블 배치도 CTA 위치 (P2)

- 절차:
  1. 사용자(모바일 폭)로 `/menu` 진입.
  2. 화면 상단 "전체 / 추천 / 치킨 / 사이드 / 음료" 카테고리 바 *바로 위*에 CTA 카드가 보이는지 확인.
  3. CTA 안에 "테이블 배치도" 문구가 *명확히* 포함됐는지.
  4. 보조 문구(예: "주문 전 테이블 위치를 확인해 주세요") 노출.
  5. CTA 크기가 단순 아이콘이 아니라 사용자가 *바로 알아볼 수 있는* 카드/버튼 크기.
- 기대 결과:
  - CTA의 testid `home-table-map-cta` 노출.
  - CTA가 카테고리 바를 화면 아래로 *과하게 밀어내지 않음* (모바일 390px 폭).
  - 인벤토리 버튼(헤더 우측 `header-cart-link`)은 *기존 위치 그대로* + 정상 동작.
  - 헤더 미니맵 버튼(`header-map-link`)도 *그대로 유지*.

### 시나리오 2. CTA 클릭 동작 (P1)

- 절차:
  1. 시나리오 1 상태에서 CTA 클릭.
  2. `/map` 라우트 진입 + `BoothMinimapModal` 풀스크린 노출.
  3. 모달 안에 `public/map/table-location.webp` 약도 이미지 + 1~15 테이블 위치 노출.
  4. 모달 상단 X 버튼 / backdrop 클릭 / Escape 키 중 하나로 닫기.
- 기대 결과:
  - 닫기 후 `/menu`로 돌아옴(history back).
  - 미니맵 legend 두 줄은 *노출되지 않음*(design_fix_v3 회귀).
  - 자동 포커스: 모달 열림 시 상단 X 버튼에 포커스 (기존 BoothMinimapModal 회귀).
  - body 스크롤 잠금 작동(모달 열린 동안 뒤 페이지 스크롤 X).

### 시나리오 3. 카테고리 필터 회귀 (P1)

- 절차:
  1. `/menu` 진입.
  2. "전체 / 추천 / 치킨 / 사이드 / 음료" 탭을 차례로 클릭.
- 기대 결과:
  - 각 탭 클릭 시 메뉴 리스트가 해당 카테고리로 필터링.
  - 탭의 `aria-selected="true"` 정확히 1개만 활성.
  - 가로 스크롤 동작 정상.
  - CTA가 탭 동작을 막지 않음(클릭 영역 충돌 X).
  - 추천 탭 시 `RecommendedBanner` 노출(category==='all'일 때만 — 기존 회귀).

### 시나리오 4. 매장 식사 주문 전달 완료 (P0)

- 절차:
  1. 사용자가 매장 식사(dineIn) 주문 생성 → 5번 테이블 선택.
  2. 어드민 본부 대시보드에서 이체 신고 → 이체 확인 → 조리 시작 → 조리 완료 → READY 상태로 이동.
  3. READY 컬럼 카드의 **"전달 완료"** 버튼 클릭.
- 기대 결과:
  - 카드가 *식사 중* 컬럼(DINING)으로 이동.
  - 카드의 elapsed 분이 0분부터 시작 + 1분 단위 갱신.
  - 5번 테이블은 *식사 중 = 여전히 점유*. 새 주문 받지 않음.
  - 사용자 진행 중 주문 카드(`RecentOrdersSection`)에서 *사라짐*(TERMINAL set 회귀).
- 후속:
  - DINING 카드의 **"테이블 준비 완료"** 클릭 → 카드가 보드에서 사라짐(SETTLED).
  - 5번 테이블이 *사용 가능*으로 복귀.

### 시나리오 5. 포장 주문 전달 완료 (P0)

- 절차:
  1. 사용자가 포장(takeout) 주문 생성 — 테이블 선택 단계가 안 보이거나 "포장" 선택.
  2. 어드민 대시보드에서 READY 상태까지 이동.
  3. READY 컬럼 카드의 **"전달 완료"** 클릭.
- 기대 결과:
  - 카드가 *식사 중*(DINING) 컬럼으로 *이동하지 않음*.
  - 카드가 즉시 보드에서 사라짐(SETTLED로 전이됨).
  - 사용자 진행 중 주문 카드에서 *사라짐*.
  - 포장 주문은 테이블 점유와 *무관* — 다른 사용자의 테이블 선택에 영향 없음.

### 시나리오 6. 서버 방어 (API 직접 호출) (P1)

- 절차:
  1. 포장(takeout) 주문 생성 → READY 상태까지 이동.
  2. 개발자 도구 또는 curl로:
     ```bash
     curl -X POST http://localhost/admin/api/orders/123/transition \
       -H 'Content-Type: application/json' \
       -H 'Cookie: admin_session=...' \
       -H 'X-CSRF-Token: ...' \
       -d '{"to": "DINING"}'
     ```
- 기대 결과:
  - 응답 **409** + `ILLEGAL_TRANSITION` (또는 동등 코드) + 한국어 안내 메시지.
  - 주문 상태가 *변경되지 않음* (READY 유지).
  - admin_events 또는 order_events에 *실패 INSERT 없음*(transition이 throw하므로 트랜잭션 롤백).
- 후속 확인:
  - 같은 주문에 `{"to": "SETTLED"}` 호출 → 200 + 정상 전이.
  - dineIn READY 주문에 `{"to": "DINING"}` 호출 → 200 (회귀).
  - dineIn READY 주문에 `{"to": "SETTLED"}` 호출 → 409 (회귀 — DINING 우회 차단 유지).

### 시나리오 7. 사용자 진행 중 주문에서 사라짐 (P1)

- 절차:
  1. 포장 주문 생성 → 사용자가 메인 화면(`/menu`)으로 돌아옴.
  2. 진행 중 주문 카드 노출(RecentOrdersSection).
  3. 어드민이 해당 주문을 READY → "전달 완료"(takeout 권장 흐름) 클릭.
  4. 사용자 화면 새로고침 또는 자동 폴링(5초).
- 기대 결과:
  - 사용자 카드가 *즉시 또는 폴링 후 사라짐*.
  - localStorage(`src/store/recentOrders.js`)에서도 entry 제거됨.
  - StatusPage 직접 URL 진입 시 카피 안내 (SETTLED 카피 — `src/pages/customer/StatusPage.jsx`).

### 시나리오 8. 정산/스냅샷 (P0)

- 절차:
  1. dineIn 주문 1건 + takeout 주문 1건 모두 SETTLED 완료.
  2. 어드민 정산 페이지(`/admin/settlement`) 진입.
- 기대 결과:
  - 두 주문 *모두 매출 집계에 포함* (SETTLED는 종결 상태).
  - DINING 1건이라도 남아 있으면 마감 버튼 *비활성/거부*(ADR-012 회귀).
  - 마감 후 business_state=CLOSED 자동 전환(G13).

### 시나리오 9. 테이블 점유와 포장 (P1)

- 절차:
  1. 5번 테이블에 dineIn 진행 중 주문(PAID).
  2. takeout 주문 1건 추가 생성(테이블 선택 없음).
  3. 다른 사용자가 `/checkout`에서 테이블 선택 UI 확인.
- 기대 결과:
  - 5번 테이블 disabled (점유 중).
  - 1~4, 6~15번 모두 available.
  - takeout 주문은 *어느 테이블 점유에도 영향 없음*(table_no=NULL 자연 방어).
- 후속:
  - takeout 주문이 SETTLED로 전이된 후에도 5번 점유는 유지(dineIn 별개 주문).

### 시나리오 10. 회귀 매트릭스 (P0)

- **쿠폰**:
  - 학번 `202637042` + 이름 "홍길동" 정상 사용. 1,000원 할인.
  - 같은 학번 다른 이름 재사용 시도 → `ALREADY_USED` + 화면 가운데 모달 노출(design_fix_v3 회귀).
- **다른 이름 이체**:
  - 이체 신고 시 예금주명이 본인 이름과 달라도 정상 접수.
  - TRANSFER_REPORTED 중복 제출 → 409 `TRANSFER_ALREADY_REPORTED`.
- **이체 완료 요청**:
  - ORDERED → TRANSFER_REPORTED 전이 + 어드민 카드의 은행 라벨 표시.
- **관리자 상태 변경**:
  - 합법 전이는 200, 불법 전이는 409.
  - 새 회귀: takeout READY → DINING *불법*(409), takeout READY → SETTLED *합법*(200), dineIn READY → SETTLED *불법*(409 — DINING 우회 차단 유지).
- **미니맵 이미지**:
  - `/map` 진입 → `public/map/table-location.webp` 정상 로드.
  - 테이블 번호 라벨 1~15 모두 노출 (이미지 안에).
  - legend 두 줄 *미노출*(design_fix_v3 회귀).
- **테이블 잠금**(table_lock 라운드 회귀):
  - 어드민 nav "테이블 잠금" → 7번 잠금 → 사용자 7번 disabled → 잠금 해제 → 사용 가능.
  - admin_events `category='system'`에 TABLE_LOCK/UNLOCK 기록.
- **정산 마감**:
  - 진행 중 주문 0건일 때 마감 가능. DINING 1건 있으면 마감 거부.
  - 마감 후 business_state=CLOSED.
- **영업 가드**:
  - CLOSED 상태에서 POST /api/orders → 423.
  - 정적 자산 화이트리스트는 영향 받지 않음(business-state 미들웨어 회귀).
- **번들 위생**:
  - production 번들에 axe-core 흔적 0 (`src/__tests__/bundle.test.js`).

---

## 3. 자동 테스트 제안

> 모든 명령은 docker exec dev 안에서 실행.

### 백엔드 단위/통합

- `server/domain/__tests__/order-state.test.js` *(갱신)*
  - `canTransition('READY','SETTLED',{deliveryType:'takeout'})` → true
  - `canTransition('READY','SETTLED',{deliveryType:'dineIn'})` → false
  - `canTransition('READY','SETTLED')` (opts 없음) → false
  - `canTransition('READY','DINING',{deliveryType:'takeout'})` → false
  - `canTransition('READY','DINING',{deliveryType:'dineIn'})` → true
  - `canTransition('READY','DINING')` (opts 없음) → true (backwards-compat)
  - `transition('READY','DINING',{deliveryType:'takeout'})` → throws StateTransitionError
  - `transition('READY','SETTLED',{deliveryType:'takeout'})` → no throw
  - 메타: `LEGAL_TRANSITIONS` 우변에 'DONE' 없음(회귀)
  - 회귀: 모든 합법/불법 케이스 기존 그대로
- `server/repositories/__tests__/order-repo.test.js` *(갱신)*
  - takeout `updateOrderStatus(id, 'SETTLED')` from READY → `settled_at` 기록 + no throw
  - takeout `updateOrderStatus(id, 'DINING')` from READY → throws
  - dineIn `updateOrderStatus(id, 'DINING')` from READY → `dining_at` 기록 (회귀)
  - dineIn `updateOrderStatus(id, 'SETTLED')` from READY → throws (회귀)
- `server/routes/__tests__/admin.test.js` *(갱신)*
  - takeout `POST /admin/api/orders/:id/transition {to:'SETTLED'}` from READY → 200
  - takeout `POST /admin/api/orders/:id/transition {to:'DINING'}` from READY → 409 ILLEGAL_TRANSITION
  - dineIn `POST /admin/api/orders/:id/transition {to:'DINING'}` from READY → 200 (회귀)
  - dineIn `POST /admin/api/orders/:id/transition {to:'SETTLED'}` from READY → 409 (회귀)
  - 응답에 `delivery_type` 포함(회귀)
- `server/routes/__tests__/customer.test.js` *(회귀)*
  - takeout 주문 생성 + table_no=NULL 허용
  - dineIn + table_no=null 거부(VALIDATION_ERROR)
  - takeout `GET /api/orders/:id` 응답에 `delivery_type:'takeout'` 포함
- `server/domain/__tests__/settlement.test.js` *(회귀)*
  - takeout SETTLED 1건 + dineIn SETTLED 1건 → 둘 다 매출 집계
  - DINING 1건 남으면 마감 거부
- `server/domain/__tests__/table-availability.test.js` *(회귀)*
  - takeout 주문 1건 있어도 1~15 모두 available
  - dineIn 5번 점유 시 5번 occupied + 나머지 available (회귀)

### 프론트엔드 단위

- `src/components/organisms/__tests__/TableMapCTA.test.jsx` *(신규)*
  - 렌더 시 "테이블 배치도" 텍스트
  - 보조 문구 노출 ("주문 전 테이블 위치를 확인해 주세요" 또는 "배치도 보기")
  - data-testid `home-table-map-cta`
  - `<Link>` to="/map"
  - aria-label 노출
- `src/pages/customer/__tests__/MenuPage.test.jsx` *(갱신)*
  - CTA가 `RecentOrdersSection` 다음 + `CategoryTabs` 앞 위치
  - CTA testid 노출
  - 카테고리 5탭 회귀
  - 카테고리 필터 회귀(한 카테고리 선택 시 메뉴 필터링)
- `src/components/layouts/__tests__/CustomerLayout.test.jsx` *(회귀)*
  - 헤더 미니맵 버튼(`header-map-link`) 존재
  - 인벤토리 버튼(`header-cart-link`) 존재
- `src/components/organisms/__tests__/AdminCardColumn.test.jsx` *(갱신)*
  - READY + takeout 카드: 버튼 "전달 완료" → `to='SETTLED'` 호출
  - READY + dineIn 카드: 버튼 "전달 완료" → `to='DINING'` 호출 (회귀)
  - DINING + dineIn 카드: 버튼 "테이블 준비 완료" → `to='SETTLED'` (회귀)
  - `formatLocationLabel`: takeout→"포장", dineIn→"테이블 N번" (회귀)
  - DINING 카드 elapsed=29 → border-divider, 30 → border-warning, 60 → border-danger (회귀)
- `src/components/organisms/__tests__/RecentOrdersSection.test.jsx` *(회귀)*
  - takeout status='SETTLED' → 카드 hide + store removeOrder
  - dineIn status='DINING' → 카드 hide (회귀)
  - 진행 중 상태 → 카드 표시 유지 (회귀)
- `src/pages/customer/__tests__/MapPage.test.jsx` *(회귀)*
  - `/map` 진입 + 모달 노출
  - legend 미노출(design_fix_v3)
  - `?order_id=N` → myTableNo 강조
- `src/components/organisms/__tests__/BoothMinimapModal.test.jsx` *(회귀)*
  - 3가지 닫기 (top-x/backdrop/escape)
  - focus trap
  - body scroll lock
- `src/pages/customer/__tests__/CheckoutPage.test.jsx` *(회귀)*
  - ALREADY_USED 모달 노출(design_fix_v3)
- `src/components/molecules/__tests__/CheckoutSubmitError.test.jsx` *(회귀)*
  - design_fix_v3 12건

### E2E (Playwright smoke)

- 본 범위 *필수 아님*. 단, 다음 흐름은 수동 검수로 대체:
  - "메뉴 진입 → 홈 CTA 클릭 → /map 진입 → 닫기 → 메뉴 복귀"
  - "포장 주문 → READY → 전달 완료 → 대시보드에서 사라짐"
  - "매장 식사 주문 → READY → DINING → 테이블 준비 완료 → 사라짐"

### 동시성/Race condition

- 본 범위 *필수 아님*. 같은 테이블 동시 주문은 table_lock 라운드 전제상 발생하지 않음.

---

## 4. 최종 통과 기준

다음 항목이 *모두 충족*되어야 본 라운드 통과로 본다:

### 4.1 홈 테이블 배치도 CTA

- [ ] `/menu` 진입 시 카테고리 바 위에 `TableMapCTA` 카드 노출
- [ ] CTA에 "테이블 배치도" 텍스트 포함
- [ ] CTA가 단순 작은 아이콘이 아님 (적당한 크기)
- [ ] CTA 클릭 시 `/map` 진입 + 미니맵 모달 노출
- [ ] 미니맵 모달 legend 미노출 (design_fix_v3 회귀)
- [ ] 모달 닫기 시 `/menu`로 돌아옴
- [ ] 헤더 미니맵 버튼(`header-map-link`) 그대로 유지 + 정상 동작
- [ ] 인벤토리 버튼(`header-cart-link`) 그대로 + 정상 동작
- [ ] 카테고리 필터 5탭 정상 동작 (전체/추천/치킨/사이드/음료)
- [ ] 모바일 폭에서 CTA가 과하게 크지 않음
- [ ] 새 이미지 자산 생성 없음 (`public/map/table-location.webp` + 기존만)

### 4.2 포장 주문 흐름

- [ ] 매장 식사 READY → DINING → SETTLED 흐름 유지
- [ ] 포장 READY → SETTLED 직접 전이
- [ ] 포장 주문은 어드민 식사 중 컬럼에 표시되지 않음
- [ ] 포장 주문 전달 완료 후 사용자 진행 중 카드에서 사라짐
- [ ] API 직접 호출로 takeout `to:'DINING'` 시도 → 409 ILLEGAL_TRANSITION
- [ ] API 직접 호출로 takeout `to:'SETTLED'` from READY → 200
- [ ] API 직접 호출로 dineIn `to:'SETTLED'` from READY → 409 (회귀)
- [ ] 포장 SETTLED 주문이 정산 매출 집계에 포함
- [ ] DINING 1건이라도 남으면 정산 마감 거부 (ADR-012)
- [ ] 포장 주문은 테이블 점유에 영향 없음
- [ ] `LEGAL_TRANSITIONS` 객체 자체 변경 없음 (DONE 메타 회귀 유지)
- [ ] DONE이 어떤 합법 전이의 우변에도 등장하지 않음

### 4.3 회귀 매트릭스

- [ ] CLAUDE.md "절대 깨지면 안 되는 것" 모두 그린 (쿠폰/이체/상태/영업/정산/번들 위생/Docker/admin_events/테이블 잠금/미니맵)
- [ ] table_lock 라운드 회귀 모두 그린 (READY→DINING→SETTLED, table_locks, 30/60 임계, admin_events system)
- [ ] design_fix_v3 라운드 회귀 모두 그린 (미니맵 legend 삭제, ALREADY_USED 모달)

### 4.4 자동 검증

- [ ] `docker compose -f docker-compose.dev.yml exec dev npm test` 전건 green
- [ ] `npm run lint` 0 errors (기존 3 warnings 유지 허용)
- [ ] `npm run build` cross-env로 production 번들 정상
- [ ] `bundle.test.js` axe-core 흔적 0

### 4.5 운영 경로

- [ ] `docker compose build app && docker compose up -d` 정상
- [ ] `curl -sI http://localhost/` 200
- [ ] `curl -sI http://localhost/menu` 200
- [ ] `curl -sI http://localhost/map` 200
- [ ] `curl -sI http://localhost/api/business-state` 200
- [ ] CLOSED 가드는 정적 자산 화이트리스트 유지 (`business-state.test.js` 회귀)

### 4.6 수동 시각 검수

- [ ] 시나리오 1~10 모두 수동 1회 통과
- [ ] 작업 로그에 스크린샷 첨부(홈 CTA + 대시보드 카드 흐름)

---

## 5. 통과 후 후속 작업

- `docs/tasks/2026-05-XX-design-fix-v4-summary.md` 작업 로그 종합본 작성.
- `docs/DECISIONS.md` 변경 로그에 본 라운드 한 줄 + (필요 시) ADR-036 후보.
- `docs/IMPLEMENTATION_PROGRESS.md`에 라운드 한 줄.
- `CLAUDE.md` "절대 깨지면 안 되는 것"에 design_fix_v4 한 줄 추가.
- `docs/operations/admin-card.md` 또는 `d1-rehearsal.md`에 *포장 주문 흐름* 한 단락 (운영자가 학습 가능하도록).

---

## 6. 참고

- 시나리오의 안내 문구와 액션 라벨은 **개발 기획서 §3 / §4**에 1차 출처가 있다. 검수 시 문구가 다르면 *기획서 우선* — 구현에 맞게 검수 문서를 조정하지 말고 *구현을 기획서에 맞춘다*.
- 본 검수의 기반 회귀 매트릭스: `docs/table_occupancy_qa_plan.md` + `codereview/codex_table_lock_final_gate_review.md` §10 + CLAUDE.md "절대 깨지면 안 되는 것".
- 본 범위에서는 *같은 테이블 동시 주문 race condition*은 검수 대상이 아니다(table_lock 라운드 전제 동일).
- 본 라운드는 *D-1(2026-05-19) 사이 작업* — 5/20 16:30 운영 시작 전에 검수 완료해야 한다.
