# design_fix_v4 작업 지시서

> 작성일: 2026-05-19 / 브랜치: `design_fix_v4`
> 본 문서는 *Claude가 실제 구현 단계에서 따라야 할 작업 지시서*다.
> 짝 문서: `docs/design_fix_v4_development_plan.md` (설계), `docs/design_fix_v4_qa_plan.md` (검수).
> 기반: table_lock 라운드 3종 문서 + Codex final gate 리뷰의 회귀 매트릭스.

---

## 0. 최우선 정책

### 0.1 환경 (ADR-033)

- **모든 dev·테스트·검증은 docker 컨테이너 안에서** 실행. 호스트 `npm` 직접 호출 금지.
- 작업 절차 4단계 준수: ① 작업 실행 → ② 테스트 검증(docker) → ③ 작업 로그 기록(`docs/tasks/2026-05-XX-design-fix-v4-*.md`) → ④ 운영 경로 사이드체크.

### 0.2 절대 깨지면 안 되는 회귀 (CLAUDE.md)

- ADR-019 쿠폰 정규식 / ADR-020 Pattern B / ADR-021 학번·이름 필수
- ADR-025 합법 전이 (*우변에 DONE 없음 메타 회귀 유지*)
- G13 영업 상태 머신 / ADR-012 정산 마감
- ADR-023 Docker compose 운영 / ADR-024 React SPA
- ADR-033 Docker 정책 / ADR-034 admin_events
- table_lock 라운드 (READY → DINING → SETTLED + table_locks)
- design_fix_v3 라운드 (미니맵 legend 삭제 + ALREADY_USED 모달)

### 0.3 결정 사항 요약 (구현 시 반드시 참조)

본 라운드 권장 (개발 기획서 §4):
- **CTA 동작**: `Link to="/map"` — 헤더 버튼과 동일 라우트.
- **CTA 형태**: 가로 카드 (이미지+제목+보조문구+화살표/보조 버튼).
- **CTA 컴포넌트**: 신규 `TableMapCTA.jsx` organism으로 분리.
- **헤더 작은 좌석 배치도 버튼**: *유지* (다른 페이지 호환 + 1차 요청 "이동 또는 제거" 중 *이동* 해석).
- **포장 흐름 구현**: 방식 C — UI + 서버 둘 다.
- **서버 도메인**: `canTransition`/`transition`에 `opts.deliveryType` 추가. `LEGAL_TRANSITIONS` 표 자체는 변경 X (DONE 메타 회귀 보호).
- **프론트**: `ACTION_BY_STATUS` 상수 → `getActionsForOrder(order)` 함수.

### 0.4 환경 명령

```bash
# 한 번만: dev 컨테이너 띄우기
docker compose -f docker-compose.dev.yml up -d

# 이후 모든 검증
docker compose -f docker-compose.dev.yml exec dev npm test
docker compose -f docker-compose.dev.yml exec dev npm run test:e2e
docker compose -f docker-compose.dev.yml exec dev npm run lint
docker compose -f docker-compose.dev.yml exec dev npm run build

# 운영 경로 사이드체크 (정적 자산/미들웨어 변경 시 필수)
docker compose build app && docker compose up -d
curl -sI http://localhost/
curl -sI http://localhost/map
```

---

## 1. Superpowers 작업 방식

### 1.1 흐름 (subagent-driven-development)

- 사용자가 본 지시서를 `superpowers:subagent-driven-development`로 실행.
- subagent는 **순차 진행** — §2의 1번부터 3번까지 한 번에 한 agent.
- **병렬 실행 금지** — 같은 파일(특히 `AdminCardColumn.jsx`, `order-state.js`)에 둘 이상 동시 손대지 못하게 직렬화.
- 각 agent는 *예외 없이* 다음을 준수:
  1. **관련 파일 파악** (Read/Grep)
  2. **실패 테스트 작성** (Vitest, docker exec dev)
  3. **실패 확인** (red)
  4. **최소 구현**
  5. **테스트 통과** (green)
  6. **리팩터링** (필요 시)
  7. **작업 로그 기록 후 다음 agent로 진행**

### 1.2 검증 매트릭스 (각 subagent 종료 시)

- `docker compose -f docker-compose.dev.yml exec dev npm test` — 단위·통합 전건
- `docker compose -f docker-compose.dev.yml exec dev npm run lint` — 0 errors
- *최종 subagent에서만* `npm run build` + 운영 경로 `curl -sI`

---

## 2. 권장 Subagent 구성 (순차)

### Subagent 1 — Home Table Map CTA Agent

**담당:**
- 메뉴 페이지(`MenuPage.jsx`) 안에 *카테고리 바 위쪽*의 명확한 CTA를 신규 배치.
- `<RecentOrdersSection />` 과 `<CategoryTabs />` 사이(라인 55-56 사이)에 삽입.
- 새 organism 컴포넌트 `TableMapCTA.jsx` 신설 — 가로 카드형, 다크/옐로우 톤.
- 클릭 시 `Link to="/map"`으로 기존 미니맵 진입.
- **인벤토리 버튼 + 카테고리 필터 + 기존 헤더 미니맵 버튼은 손대지 않는다.**

**의존 파일:**
- 갱신: `src/pages/customer/MenuPage.jsx` (CTA 1행 삽입)
- 신규: `src/components/organisms/TableMapCTA.jsx`
- 갱신: `src/styles/components.css` (또는 design-bundle css — *확인 필요*) — `.table-map-cta` 스타일
- 참조(읽기): `src/components/layouts/CustomerLayout.jsx` (헤더 패턴), `src/pages/customer/MapPage.jsx` (라우트 동작)
- 참조(읽기): `src/components/organisms/CategoryTabs.jsx` (카테고리 바 스타일 일관)

**구현 가이드라인:**
- `TableMapCTA.jsx` 예시 시그니처:
  ```jsx
  // 가로 카드 organism. 클릭 → /map.
  // 이미지: /map/table-location.webp 작은 썸네일(우측 또는 배경 데코).
  // 텍스트 영역: 제목 "테이블 배치도" + 보조 "주문 전 테이블 위치를 확인해 주세요" + "배치도 보기 →"
  export default function TableMapCTA() {
    return (
      <Link
        to="/map"
        data-testid="home-table-map-cta"
        className="table-map-cta"
        aria-label="테이블 배치도 보기"
      >
        ...
      </Link>
    );
  }
  ```
- `data-testid="home-table-map-cta"` 노출 — 테스트 회귀용.
- 헤더 미니맵 버튼(`data-testid="header-map-link"`)과 *testid 충돌 X*.
- 모바일 적정 크기 — 가로 100% × 세로 80~96px. 카테고리 바를 시각적으로 압도하지 않게.
- 다크/옐로우 톤 — `var(--color-elevated)` 배경, `var(--color-accent)` 강조 토큰 사용.
- 새 이미지 자산 *생성 금지*. `public/map/table-location.webp` 작은 썸네일로 활용 가능.
- 페이지 ≤120줄 정책 — MenuPage는 현재 72줄. CTA 1행 추가는 영향 미미.

**필수 테스트:**
- `src/components/organisms/__tests__/TableMapCTA.test.jsx` (신규):
  - 렌더 시 "테이블 배치도" 텍스트 표시
  - `aria-label` 또는 `data-testid="home-table-map-cta"` 노출
  - Link href가 `/map` (또는 react-router `<Link to="/map">`)
  - 보조 문구 "주문 전 테이블 위치를 확인해 주세요" 또는 "배치도 보기" 노출
- `src/pages/customer/__tests__/MenuPage.test.jsx` (갱신):
  - CTA가 `<RecentOrdersSection />` 다음 + `<CategoryTabs />` 앞 위치
  - CTA testid 노출
  - CategoryTabs 5개 탭 회귀(전체/추천/치킨/사이드/음료)
  - 카테고리 필터 기능 회귀 (한 카테고리 선택 시 메뉴 필터링)
- `src/components/layouts/__tests__/CustomerLayout.test.jsx` (회귀):
  - 헤더 미니맵 버튼(`header-map-link`)이 여전히 존재(*제거되지 않음*)
  - 인벤토리 버튼(`header-cart-link`)도 그대로
- `src/pages/customer/__tests__/MapPage.test.jsx` (회귀):
  - `/map` 진입 + 미니맵 모달 노출 그대로
  - legend 미노출(design_fix_v3 회귀)

**완료 조건:**
- 신규 + 갱신 테스트 모두 green.
- `npm test` 전건 통과.
- a11y 회귀 0건(axe-core dev-only).
- 시각 확인: `npm run dev` 후 http://localhost:5173/menu에서 CTA 노출 + 클릭 → /map. 작업 로그에 스크린샷 첨부 권장.

---

### Subagent 2 — Takeout Ready Transition Agent

**담당:**
- 매장 식사 → 기존 `READY → DINING → SETTLED` 유지.
- 포장 → `READY → SETTLED` 직접 전이로 변경.
- *서버 도메인 단일 출처*: `order-state.js`에 `opts.deliveryType` 옵션 추가.
- 프론트 `AdminCardColumn.jsx`에서 `delivery_type` 보고 buttontarget 분기.
- API 직접 호출 방어선이 도메인 단에서 작동하도록.

**의존 파일:**
- 갱신: `server/domain/order-state.js` (`canTransition`/`transition`에 `opts.deliveryType` 추가)
- 갱신: `server/repositories/order-repo.js` (`updateOrderStatus`에서 order의 delivery_type 읽어 transition에 전달)
- 참조(읽기): `server/routes/admin.js` (POST transition 라우트 동작 확인)
- 갱신: `src/components/organisms/AdminCardColumn.jsx` (`ACTION_BY_STATUS` → `getActionsForOrder(order)` 함수화)
- 참조(읽기): `src/components/organisms/RecentOrdersSection.jsx` (TERMINAL set 이미 SETTLED 포함 — 추가 변경 X)
- 참조(읽기): `server/domain/settlement.js` (SETTLED 집계 — 추가 변경 X)
- 참조(읽기): `server/domain/table-availability.js` (table_no NULL 자연 방어 — 추가 변경 X)

**구현 가이드라인:**

**(A) order-state.js 갱신:**
```js
// 의사 코드 — backwards-compatible 옵션 추가
export function canTransition(from, to, opts = {}) {
  const { deliveryType } = opts;
  // takeout 특수 케이스
  if (deliveryType === 'takeout' && from === 'READY' && to === 'SETTLED') return true;
  // takeout 방어선
  if (deliveryType === 'takeout' && from === 'READY' && to === 'DINING') return false;
  // 기본: LEGAL_TRANSITIONS 표 (dineIn 흐름)
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transition(from, to, opts = {}) {
  if (!canTransition(from, to, opts)) {
    throw new StateTransitionError(from, to);
  }
}
```

주의:
- `LEGAL_TRANSITIONS` 객체 자체는 *변경하지 않는다*. 테이블 표 그대로 유지.
- DONE 메타 회귀(우변에 DONE 없음) 그대로 유지.
- `opts` 미전달 시 기존 dineIn 흐름으로 자연 작동 — 호출자 backwards-compatible.

**(B) order-repo.js `updateOrderStatus` 갱신:**
- 함수 진입 시 현재 order를 SELECT (이미 함수 안에서 하지 않으면) → `order.delivery_type` 추출 → `transition(from, to, { deliveryType: order.delivery_type })` 호출.
- *★ 확인 필요*: 현재 `updateOrderStatus`가 from을 어떻게 받는지(인자? SELECT?) — 구현 단계 진입 시 정확히 확인 후 옵션 전달 위치 결정.

**(C) AdminCardColumn.jsx 갱신:**
```js
// 기존 ACTION_BY_STATUS 객체는 그대로 두되 사용을 함수로 감싼다.
function getActionsForOrder(order) {
  if (order.status === 'READY' && order.delivery_type === 'takeout') {
    return [{ label: '전달 완료', to: 'SETTLED', variant: 'primary' }];
  }
  return ACTION_BY_STATUS[order.status] ?? [];
}

// OrderCard 안에서:
const actions = getActionsForOrder(order);
```

- 라벨은 둘 다 "전달 완료" — 운영자 인지 부담 최소.
- DINING 카드의 "테이블 준비 완료" 버튼은 그대로(dineIn 한정으로 자연 노출 — 포장은 DINING에 진입 X).

**필수 테스트:**

`server/domain/__tests__/order-state.test.js` (갱신):
- `canTransition('READY', 'SETTLED', { deliveryType: 'takeout' })` → true
- `canTransition('READY', 'SETTLED', { deliveryType: 'dineIn'  })` → false (DINING 우회 차단)
- `canTransition('READY', 'SETTLED')` (opts 없음) → false (dineIn 기본 흐름)
- `canTransition('READY', 'DINING',  { deliveryType: 'takeout' })` → false (방어선)
- `canTransition('READY', 'DINING',  { deliveryType: 'dineIn'  })` → true (회귀)
- `canTransition('READY', 'DINING')` (opts 없음) → true (기존 호출자 backwards-compat)
- `transition('READY', 'DINING', { deliveryType: 'takeout' })` → throws StateTransitionError
- `transition('READY', 'SETTLED', { deliveryType: 'takeout' })` → no throw
- 메타 회귀: `LEGAL_TRANSITIONS` 우변 합집합에 'DONE' 없음(table_lock 회귀)
- 회귀 케이스 모두 기존 그대로:
  - `READY → DONE` 어떤 deliveryType이든 *불법*
  - `DINING → DONE` 어떤 deliveryType이든 *불법*
  - `DINING → SETTLED` 합법(회귀)
  - `DINING → CANCELED` 합법(회귀)

`server/repositories/__tests__/order-repo.test.js` (갱신):
- takeout 주문의 `updateOrderStatus(id, 'SETTLED')` → `settled_at` 자동 기록 + 정상 통과
- takeout 주문의 `updateOrderStatus(id, 'DINING')` → StateTransitionError throws
- dineIn 주문의 `updateOrderStatus(id, 'DINING')` → `dining_at` 기록 + 정상(회귀)
- dineIn 주문의 `updateOrderStatus(id, 'SETTLED')` from READY → StateTransitionError throws

`server/routes/__tests__/admin.test.js` (갱신):
- takeout 주문 `POST /admin/api/orders/:id/transition { to: 'SETTLED' }` from READY → 200
- takeout 주문 `POST /admin/api/orders/:id/transition { to: 'DINING'  }` from READY → 409 + ILLEGAL_TRANSITION
- dineIn 주문 `POST /admin/api/orders/:id/transition { to: 'DINING'  }` from READY → 200 (회귀)
- dineIn 주문 `POST /admin/api/orders/:id/transition { to: 'SETTLED' }` from READY → 409 (회귀, DINING 우회 차단)
- 이후 transition 응답에 `delivery_type` 포함 회귀

`src/components/organisms/__tests__/AdminCardColumn.test.jsx` (갱신):
- READY + delivery_type='takeout' 카드: 버튼 라벨 "전달 완료", `to='SETTLED'` 호출
- READY + delivery_type='dineIn'  카드: 버튼 라벨 "전달 완료", `to='DINING'` 호출 (회귀)
- DINING + delivery_type='dineIn' 카드: 버튼 라벨 "테이블 준비 완료", `to='SETTLED'` 호출 (회귀)
- DINING + delivery_type='takeout' 카드: 정상적으로 발생하지 않지만 *기존 ACTION_BY_STATUS.DINING* 그대로 노출(안전망)
- `formatLocationLabel`이 takeout → "포장" / dineIn → "테이블 N번" 노출(회귀)

`src/components/organisms/__tests__/RecentOrdersSection.test.jsx` (회귀):
- takeout 주문 status='SETTLED' → 카드 hide + store removeOrder(기존 TERMINAL set 작동)
- dineIn 주문 status='DINING' → 카드 hide(회귀)
- 진행 중 상태(ORDERED/PAID/COOKING/READY/HOLD) → 카드 표시 유지

`server/domain/__tests__/settlement.test.js` (회귀):
- takeout SETTLED 1건 + dineIn SETTLED 1건 → 둘 다 매출 집계 포함
- DINING 1건 남으면 마감 거부(ADR-012 회귀)
- 마감 시 takeout SETTLED 데이터도 정상 스냅샷

**완료 조건:**
- 위 테스트 모두 green. 기존 1358/1358 + 신규 (대략) 15~20건.
- `docker compose -f docker-compose.dev.yml exec dev npm test` 전건 통과.
- `npm run lint` 0 errors.

---

### Subagent 3 — Regression QA Agent

**담당:**
- 전체 회귀 매트릭스 검증 (table_lock + design_fix_v3 + design_fix_v4).
- 운영 경로 사이드체크 (ADR-033).
- 문서 동기화.
- 작업 로그 종합본.

**검증 매트릭스:**

(1) 자동 테스트 (모두 docker exec dev):
- `npm test` 전건 green (신규 + 기존)
- `npm run lint` 0 errors
- `npm run build` cross-env로 production 번들 정상 (axe-core 흔적 0 — `src/__tests__/bundle.test.js`)
- `npm run test:e2e` (Playwright smoke 기본 케이스)

(2) 운영 경로 사이드체크:
```bash
docker compose build app && docker compose up -d
curl -sI http://localhost/                            # 200
curl -sI http://localhost/map                         # 200
curl -sI http://localhost/menu                        # 200
curl -sI http://localhost/api/business-state         # 200
```

(3) 회귀 매트릭스 (CLAUDE.md "절대 깨지면 안 되는 것"):
- 쿠폰: 정규식 + ALREADY_USED 거부 + 모달 노출(design_fix_v3)
- 이체: 다른 이름 이체 + TRANSFER_REPORTED 중복 가드
- 상태 전이: ADR-025 합법 매트릭스 + table_lock READY→DINING + design_fix_v4 takeout 분기
- 영업 상태: G13 OPEN/CLOSED 머신
- 정산: ADR-012 진행 중 0건 마감 + SETTLED 집계
- 번들 위생: axe-core 흔적 0
- Docker: 호스트 npm 미사용
- admin_events: history?type=all|orders|menus|system allowlist
- 테이블 잠금/점유: 1~15 / table_locks UNIQUE / table_no NULL 포장 제외
- 미니맵: legend 미노출 + ALREADY_USED 모달

(4) 수동 시각 검수 (필수, 작업 로그에 캡처 첨부):
- 홈에서 CTA 노출 + 카테고리 바 위 위치
- CTA 클릭 → /map 진입 → 모달 노출 → 닫기 → 메뉴 페이지 복귀
- 헤더 미니맵 버튼도 여전히 작동
- 인벤토리 버튼 그대로
- 카테고리 필터 5개 탭 + 메뉴 필터링
- 포장 주문 생성(`takeout`) → READY 상태 → "전달 완료" 클릭 → DINING 컬럼에 *나타나지 않음* → 대시보드에서 사라짐
- 매장 식사 주문 생성(`dineIn`) → READY → "전달 완료" → DINING 컬럼 표시 → "테이블 준비 완료" → SETTLED
- 사용자 진행 중 주문: takeout SETTLED 후 카드 사라짐
- API 직접 호출: `POST /admin/api/orders/:id/transition { to: 'DINING' }`을 takeout 주문에 → 409

**문서 동기화:**

- `docs/DECISIONS.md` — design_fix_v4 갱신 노트(또는 ADR-036 후보):
  - `canTransition`/`transition`에 `opts.deliveryType` 추가
  - takeout `READY → SETTLED` 합법화 + `READY → DINING` 방어
  - 홈 CTA `TableMapCTA` organism 신설
- `CLAUDE.md` "절대 깨지면 안 되는 것"에 design_fix_v4 한 줄:
  - 예: "**design_fix_v4 라운드 (2026-05-20, 사용자 요청)**: ① 홈 메뉴 페이지 카테고리 바 위에 `TableMapCTA` 신규 — `Link to="/map"`로 기존 미니맵 모달 재사용. 헤더 작은 미니맵 버튼은 그대로 유지. ② 포장 주문은 `READY → SETTLED` 직접 전이 (DINING 건너뜀). `server/domain/order-state.js`의 `canTransition`/`transition`에 `opts.deliveryType` 추가 — `LEGAL_TRANSITIONS` 표는 그대로(DONE 메타 회귀 유지). `AdminCardColumn.jsx`는 `ACTION_BY_STATUS` → `getActionsForOrder(order)` 함수화. 회귀: `order-state.test.js` 분기 + `admin.test.js` transition + `AdminCardColumn.test.jsx` 버튼 + `RecentOrdersSection.test.jsx` SETTLED hide + `settlement.test.js` takeout 집계."
- `docs/IMPLEMENTATION_PROGRESS.md` 라운드 한 줄.
- `docs/tasks/2026-05-XX-design-fix-v4-{1..3}.md` 작업 로그 3건 + summary.

**완료 조건:**
- 모든 자동 테스트 green.
- 운영 경로 `curl -sI` 200.
- 수동 시각 검수 캡처 + summary 작업 로그.
- 문서 동기화 완료.

---

## 3. 구현 금지/주의

- ADR-019 쿠폰 학번 정규식 변경 금지.
- ADR-020 Pattern B(서버 가격 자체 계산) 변경 금지.
- ADR-021 학번+이름 필수 변경 금지.
- 이체 완료 요청 / 다른 이름 이체 / TRANSFER_REPORTED 중복 가드 변경 금지.
- 메뉴 토글/가격 변경 로직 변경 금지.
- 영업 상태 머신(OPEN/CLOSED) 변경 금지.
- 정산 마감(ADR-012) 정책 변경 금지 — DINING 1건이라도 남으면 마감 거부 유지.
- 테이블 번호 1~15 유지. `table_locks` 스키마 변경 금지.
- table_lock 라운드의 모든 흐름 유지 — `dining_at`/`settled_at` 직렬화, 어드민 테이블 잠금 페이지 등.
- design_fix_v3 라운드의 미니맵 legend 삭제 + ALREADY_USED 모달 유지.
- **`LEGAL_TRANSITIONS` 객체 자체는 변경 X** — DONE이 우변에 없는 메타 회귀 보호.
- **DONE 상태로의 합법 전이 추가 금지**.
- **포장 주문이 dineIn 흐름에 섞이지 않게 — `table_no IS NOT NULL` 가드 유지** (현재 자연 방어).
- **새 이미지 자산 생성 금지**. `public/map/table-location.webp` + 기존 자산만.
- **헤더의 작은 좌석 배치도 버튼 제거 금지**(★ 사용자 명시적 요청 시에만 다음 라운드로).
- `init.sql` 메뉴 시드(8 메뉴) / business_state 단일 행 CHECK / 시스템 설정 키 손대지 말 것.
- `.env`, 비밀키, DB 실데이터, 세션 파일 열람·수정 금지.

---

## 4. 커밋·브랜치 정책

- 브랜치: 현재 `design_fix_v4` 유지. *main에서 직접 작업 금지*.
- 커밋 단위: subagent별 1 커밋 최소. red→green→refactor는 같은 커밋에 묶어도 OK.
- 커밋 메시지 (한국어):
  - `feat(design_fix_v4): 홈 카테고리 바 위 TableMapCTA + Link to /map (Subagent 1)`
  - `feat(design_fix_v4): 포장 주문 READY→SETTLED 직접 전이 + 서버 도메인 방어 (Subagent 2)`
  - `chore(design_fix_v4): 회귀 매트릭스 + 문서 동기화 + 작업 로그 (Subagent 3)`
- merge 전 `npm test` / `npm run build` / `curl -sI` 회귀 통과 확인 — *각 subagent 종료 시*.

---

## 5. 진행 순서 요약

```
Subagent 1: 홈 TableMapCTA + Link to /map  → 메뉴 페이지 CTA + 회귀
       ↓
Subagent 2: 포장 READY→SETTLED + 서버 도메인 방어 + 프론트 분기
       ↓
Subagent 3: 회귀 매트릭스 + 운영 경로 + 문서 동기화
```

병렬 금지. 1 → 2 → 3 직렬.

---

## 6. 자매 문서 참고

- 설계 근거 / 코드 사실 / 권장안: `docs/design_fix_v4_development_plan.md`
- 시나리오 / 자동 테스트 / 통과 기준: `docs/design_fix_v4_qa_plan.md`
- 기반 회귀 매트릭스: `docs/table_occupancy_*.md`, `codereview/codex_table_lock_final_gate_review.md`
