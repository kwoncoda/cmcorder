# UI 구현 분석 — design-bundle vs 기존 docs

> ⚠️ **DEPRECATED (2026-05-14)** — 이 문서는 *ADR-024 변경 전* EJS+Alpine 기준으로 작성되었습니다.
> 2026-05-14 React 18 SPA로 스택이 변경됨에 따라, 본 문서의 *변환 가이드·EJS partial 매핑·Alpine 디렉티브* 등은 *더 이상 유효하지 않습니다*.
> **현재 구현의 정답(SoT):**
> - 구현 산출물: `docs/IMPLEMENTATION_PLAN.md` (8 Phase / 52 Task, 모두 ✅ 2026-05-14 완료)
> - 컴포넌트 트리: `src/components/{atoms,molecules,organisms,state,layouts}/`
> - 페이지: `src/pages/customer/`, `src/pages/admin/`
>
> 본 문서는 *2026-05-12 시점 의사결정 이력* 보존용. 구현 참조는 위 SoT 사용.

---

**작성일:** 2026-05-12
**대상:** `docs/design-bundle/` (Claude Design handoff bundle) vs `docs/{DESIGN, UX_STRATEGY, SCREEN_STRUCTURE, COMPONENT_GUIDE}.md`
**목적:** **구현 시작 전** 시안과 기획 정합성 검증 + 누락 항목 정리. 코드는 작성하지 않음.

---

## 0. 문서 목적

`/superpowers:writing-plans` 단계로 들어가기 전에:
1. design-bundle의 *실제 구현 범위*를 확인
2. 기존 4개 docs (DESIGN.md / UX_STRATEGY.md / SCREEN_STRUCTURE.md / COMPONENT_GUIDE.md)와 *셀별 비교*
3. 사용자가 인지한 **5개 누락 사항**을 코드 레벨로 정밀 진단
4. *추가 발견*(번들 자체의 내부 불일치 포함) 정리
5. 구현 진입 시 작업 분할 + 순서 제시

---

## 1. Bundle 개요

```
docs/design-bundle/
├── HANDOFF.md                    12 KB · 디자인 의사결정 + 화면 설명 문서
├── prototype.html                37 KB · 진입점 + CSS 변수 + Stage 셸 (React+Babel CDN)
├── js/
│   ├── components.jsx             ~330줄  · Atoms/Molecules 13종 + Mock 데이터
│   ├── screens-customer.jsx       ~650줄  · 사용자 화면 6개 (C-1 ~ C-6)
│   ├── screens-admin.jsx          ~770줄  · 관리자 화면 5개 (A-1 ~ A-4 + A-5*)
│   ├── tweaks-panel.jsx           시연 검토 패널 (구현 시 제거)
│   └── app.jsx                   ~310줄  · Router + reducer + Stage 래퍼
└── uploads/                      기존 5개 docs 사본 (디자이너가 입력 자료로 사용)
```

* A-5 AdminSettlement는 코드는 존재하지만 *라우터에 연결되지 않음* (§7 G1 참조).

**디자인 의사결정 (HANDOFF.md §1 기준 — 기존 docs와 100% 정합):**

| 결정 | Bundle | 기존 docs |
|---|---|---|
| 라이트 default | ✅ `prototype.html` `:root` 라이트 (line 19-25) | DESIGN.md §2.3 (2026-05-10 정정) |
| 단일 액센트 `#F4D200` | ✅ `--color-accent` | DESIGN.md §4.1 |
| 도그태그 모든 화면 식별자 | ✅ `DogTag` 컴포넌트 4 size 변형 | UX_STRATEGY 메모러블·DESIGN §7.3 |
| Pretendard + JetBrains Mono + Black Ops One | ✅ `<link>` 로딩 + CSS 변수 | DESIGN.md §5.1 |
| 하드 오프셋 그림자 | ✅ `--shadow-card: 2px 2px 0 ...` | DESIGN.md §8 |
| 마스코트 placeholder (디자이너 작업 슬롯) | ✅ SVG 아닌 emoji+카모 박스 | DESIGN.md §10 (자산 필요로 명시) |
| 도그태그 sessionStorage 단발성 | ✅ `screens-customer.jsx:382-386` | DESIGN.md §9.3 (Finding D 반영) |

---

## 2. 화면 목록 정리

### 2.1 비교 매트릭스

| Screen ID | SCREEN_STRUCTURE 우선순위 | Bundle 코드 | Bundle 라우팅 | HANDOFF.md 문서화 | 비고 |
|---|:---:|:---:|:---:|:---:|---|
| **사용자 (모바일)** | | | | | |
| C-1 `/menu` | P0 | ✅ `ScreenMenu` | ✅ | ✅ | 완전 구현 |
| C-2 `/cart` | P0 | ✅ `ScreenCart` | ✅ | ✅ | 완전 구현 |
| C-3 `/checkout` | P0 | ✅ `ScreenCheckout` | ✅ | ✅ | **쿠폰 로직 G2~G5 수정 필요** |
| C-4 `/orders/:id/complete` | P0 | ✅ `ScreenComplete` | ✅ | ✅ | 도그태그 단발 모션 ✅ |
| C-5 `/orders/:id/transfer-report` | P0 | ✅ `ScreenTransfer` | ✅ | ✅ | 자동 진입 ✅ (Finding B 반영) |
| C-6 `/orders/:id/status` | P0 | ✅ `ScreenStatus` | ✅ | ✅ | 카피 1건 기획서와 차이 |
| C-7 `/map` | P1 | ❌ | ❌ | ❌ | 약도 이미지 수령 후 |
| C-8 에러 페이지 (404·500) | P1 | 부분 (`ErrorState` 인라인만) | ❌ | ❌ | 풀스크린 404·500 라우트 X |
| **관리자 (PC)** | | | | | |
| A-1 `/admin/login` | P0 | ✅ `AdminLogin` | ✅ | ✅ | PIN 7842 placeholder |
| A-2 `/admin/dashboard` | P0 | ✅ `AdminDashboard` | ✅ | ✅ | 6-column Kanban |
| A-3 `/admin/orders/:id` | P0 | ✅ `AdminOrderDetail` | ✅ | ✅ | 좌·우 grid |
| A-4 `/admin/transfers` | P0 | ✅ `AdminTransfers` | ✅ | ✅ | 3-col responsive |
| **A-5 `/admin/menus`** | **P0** | ❌ (TopNav 버튼만) | ❌ | ❌ | **완전 누락** |
| **A-6 `/admin/settlement`** | **P0** | **✅ `AdminSettlement` 존재** | **❌ 라우터 X** | **❌ HANDOFF 누락** | **사용자 G1 — 접근 경로 미연결** |
| A-7 ZIP 다운로드 (정산 내부) | P0 | ✅ (`AdminSettlement` 내부) | ❌ (A-6 부속) | ❌ | A-6 라우팅 시 자동 활성화 |
| A-8 `/admin/coupons` | P1 | ❌ | ❌ | ❌ | 미구현 |
| A-9 인기 랭킹 관리 | P2 | ❌ | ❌ | ❌ | Phase 2 |
| A-10 시스템 상태 | P2 | ❌ | ❌ | ❌ | Phase 2 |

### 2.2 화면 커버리지 점수

```
사용자 (8화면):  P0 6/6 (100%) + P1 0/2 (0%) → 8 중 6 = 75%
관리자 (10화면): P0 5/7 (71% — A-5·A-6 연결 누락) + P1 0/1 + P2 0/2 → 10 중 5 = 50%

전체 P0: 11/13 = 85% — A-5(메뉴 관리)·A-6(정산 라우팅) 둘만 보강하면 100%
```

### 2.3 화면별 핵심 정보 위계 정합 (SCREEN_STRUCTURE §3 vs Bundle)

| Screen | SCREEN_STRUCTURE §3 정의 1순위 | Bundle 구현 | 정합? |
|---|---|---|:---:|
| C-1 | 메뉴 카드 (사진·이름·가격·CTA) | `MenuGrid 2-col + MenuCard` | ✅ |
| C-1 | sticky 카트 바 | `bottom-bar` | ✅ |
| C-4 | 도그태그 + WINNER + 메인 CTA | DogTag dropping + `<h1>WINNER<br>WINNER` + AccountCard | ✅ |
| C-5 | 결제 금액 (큼) | `결제 금액 22px` | ✅ |
| C-5 | 은행 입력 + 다른 이름 옵션 | Select + Checkbox + altName 분기 | ✅ |
| C-6 | 5단계 progress bar + 현재 단계 카피 | `Timeline` 컴포넌트 + `cooking-copy` | ✅ |
| A-2 | 5단계 카드 컬럼 (6번째 DONE 포함) | Kanban 6-column | ✅ (6번째 추가) |
| A-3 | 주문번호 + 금액 + 경과 | DogTag + `#{id}` + StatusChip | ✅ |
| A-6 | "오늘 정산 마감" + ZIP 백업 다운로드 | `attemptClose()` + `downloadZip()` + modal 가드 | ✅ (라우팅만 누락) |

---

## 3. 컴포넌트 목록 정리

### 3.1 Bundle 컴포넌트 카탈로그 (`js/components.jsx`)

```
Atoms (8)
─────────
Button       — variant: primary/secondary/danger/ghost · size: xs/sm/md/lg · block · loading
Field        — label/hint/error/required wrapper
Input        — text/tel/numeric · error class
Select       — error class
Checkbox     — outline-only (DESIGN §4.2 H 반영) + sub-label
RadioGroup   — segmented
Stamp        — kind: recommended/sold-out/paid/done/canceled + rotate prop
DogTag       — size: xs/sm/md/lg · dropping prop (sessionStorage 단발성)

Molecules (5)
─────────────
StatusChip   — 8개 상태 (ORDERED~CANCELED, HOLD 포함)
CountBadge   — variant: default/warn/danger
MenuFallback — 카테고리별 색·이모지 (사진 fallback)
Mascot       — placeholder SVG, 5 state · 카모 오버레이 + idle pulse(COOKING)
Timeline     — 5-step progress bar (ORDERED→PAID→COOKING→READY→DONE)

상태 컴포넌트 (3)
─────────────────
EmptyState   — Mascot + title + body + CTA
LoadingState — Spinner + label
ErrorState   — kind: inline-card / banner-top

기타
────
TIMELINE_STEPS / STATUS_LABELS — 라벨 상수
MENUS / CATEGORIES / MOCK_ORDERS_SEED — Mock data
```

### 3.2 COMPONENT_GUIDE.md 23개 vs Bundle 16개

| 기존 COMPONENT_GUIDE.md | Bundle | 비고 |
|---|:---:|---|
| **Atoms (8)** | | |
| Button | ✅ | 완전 일치 |
| Input | ✅ | |
| Select | ✅ | |
| Checkbox | ✅ | outline-only 적용 ✅ |
| Radio | ✅ (RadioGroup) | |
| Label | ✅ (Field 내부) | |
| Icon | ❌ | emoji로 대체 — 정상 |
| Spinner | ✅ (className "spinner") | |
| Divider | ✅ (className "divider-dashed") | |
| **Molecules (7)** | | |
| StampBadge | ✅ (Stamp) | rotate prop ✅ |
| PriceTag | ⚠️ `.tabular` className으로 처리 | 별도 컴포넌트 X — 시안 단계엔 OK |
| DogTagFrame | ✅ (DogTag) | dropping 모션 ✅ |
| StatusChip | ✅ | |
| CountBadge | ✅ | |
| IconLabel | ❌ | 별도 컴포넌트 없음 — emoji 인라인 |
| MenuFallback | ✅ | |
| **Organisms (8)** | | |
| MenuCard | ✅ (ScreenMenu 안 article) | 별도 export X — Screen 내부 |
| CartItem | ✅ (`cart-line` className) | 별도 컴포넌트 X |
| OrderTimeline | ✅ (Timeline) | |
| MascotState | ✅ (Mascot) | placeholder |
| TransferReportForm | ✅ (ScreenTransfer 안) | 별도 export X |
| AdminCardColumn | ✅ (Kanban col) | |
| SettlementSummary | ✅ (AdminSettlement 안) | |
| ZipDownloadCard | ✅ (AdminSettlement 안 zip-list) | |
| **상태 (3)** | | |
| EmptyState | ✅ | |
| LoadingState | ✅ | |
| ErrorState | ✅ | banner-top 변형 ✅ |
| **Templates (3)** | | |
| CustomerLayout | ✅ (CustomerStage) | |
| AdminLayout | ✅ (AdminStage + AdminTopNav + AdminSidebar) | |
| ErrorLayout | ❌ | 풀스크린 404·500 페이지 미구현 |

**일치율 23/23 = 100% — 단 4개는 별도 export 안 하고 Screen 안에 인라인** (MenuCard, CartItem, TransferReportForm, IconLabel). 구현 시 분리하면 깔끔.

### 3.3 Tweaks 패널 (시연 전용, 구현 시 제거)

`tweaks-panel.jsx` + `app.jsx 198-268`:
- 시연 모드 (customer/admin/both 양분할)
- 사용자 11개 상태 / 관리자 4개 페이지 빠른 이동
- 액센트 색상 5종 즉시 스와프
- 7개 주문 상태 강제 천이

> **구현 시 제거 대상.** 단 *디자인 토큰만* `prototype.html` 상단 `<style>` 블록에서 추출해 `tokens.css` 또는 Tailwind config로 이식.

---

## 4. 상태 화면 카탈로그 (Empty / Loading / Error)

| 상태 | 컴포넌트 | 등장 화면 | 트리거 | Bundle 구현 |
|---|---|---|---|:---:|
| Empty 카트 | `EmptyState mascot=default` | C-2 | `cart.length === 0` | ✅ |
| Empty 카테고리 | `EmptyState` | C-1 | filter 결과 0 | ✅ |
| Empty 이체 큐 | inline 초록 카드 | A-4 | TRANSFER_REPORTED 0건 | ✅ |
| Loading 첫 진입 | `LoadingState size="lg"` 700ms | C-1 | `firstLoad` | ✅ |
| Loading 제출 중 | `Button loading` spinner | C-3, C-5, A-1 | submit 후 | ✅ |
| Loading ZIP 생성 | `Button loading` 1.8s | A-6 | downloadZip | ✅ (라우팅 시 활성) |
| Error 네트워크 풀스크린 | `ErrorState` | C-1 | fetch fail (시안: setError 토글) | ✅ |
| Error SSE 끊김 banner-top | `ErrorState kind=banner-top` | C-6 | `sseDisconnected` flag | ✅ |
| Error 잘못된 주문 | `ErrorState` | A-3 | order not found | ✅ |
| Error PIN 불일치 | `pin-cell.error` + shake + 카피 | A-1 | wrong pin | ✅ |
| **Error 풀스크린 404·500** | — | — | URL 무효 / 서버 오류 | ❌ **누락** |
| 마감 가드 모달 (ADR-012) | `modal-backdrop + modal` + breakdown | A-6 | 진행 주문 1건+ | ✅ (라우팅 시 활성) |
| 마감 confirm 모달 | 동일 | A-6 | `attemptClose` 통과 후 | ✅ |

**핵심:** 13개 P0 상태 중 12개 OK, **404·500 풀스크린 페이지 1개만 누락**.

---

## 5. 라우팅 구조

### 5.1 Bundle 라우터 (`app.jsx`)

**사용자 (state.screen 기반 — URL 없음, 시안 단계):**
```
menu → cart → checkout → complete → transfer → status
                              ↓                    ↑
                              └────────────────────┘
                              "조리 현황 보기" 버튼
```

**관리자 (adminState.page 기반):**
```
login → dashboard ⇄ detail (selectedId) ⇄ transfers
                     ↑                       ↓
                     └───── 상세에서 액션 ────┘
```

### 5.2 SCREEN_STRUCTURE.md §1 사이트맵과 비교

| 라우트 | SCREEN_STRUCTURE | Bundle state | Bundle 라우터 |
|---|---|---|:---:|
| `/` (랜딩 → `/menu` redirect) | ✅ | n/a (시안은 `/menu`로 시작) | partial |
| `/menu` | ✅ | screen=`menu` | ✅ |
| `/cart` | ✅ | screen=`cart` | ✅ |
| `/checkout` | ✅ | screen=`checkout` | ✅ |
| `/orders/:id/complete` | ✅ | screen=`complete` (id는 state.order.id) | ✅ |
| `/orders/:id/transfer-report` | ✅ | screen=`transfer` | ✅ |
| `/orders/:id/status` | ✅ | screen=`status` | ✅ |
| `/map` | P1 | n/a | ❌ |
| `/error/{404,500}` | P1 | n/a | ❌ |
| `/admin/login` | ✅ | page=`login` | ✅ |
| `/admin/dashboard` | ✅ | page=`dashboard` | ✅ |
| `/admin/orders/:id` | ✅ | page=`detail` (selectedId) | ✅ |
| `/admin/transfers` | ✅ | page=`transfers` | ✅ |
| **`/admin/menus`** | **P0** | n/a | **❌ — placeholder 버튼만** |
| **`/admin/settlement`** | **P0** | n/a | **❌ — 코드 있지만 미연결** |
| `/admin/coupons` | P1 | n/a | ❌ |

### 5.3 구현 시 라우팅 결정 사항

**시안은 state.screen 기반 (Single-Page state)**. 실제 구현에선 *URL-based 라우팅* 필요:

| 결정 | 추천 |
|---|---|
| 라이브러리 | Express + EJS 서버 렌더 (ADR-024) — `/menu`, `/cart` 등 GET 페이지로 |
| 동적 부분 (state.cart, state.order) | Alpine.js + cookie/sessionStorage (ADR-024 클라이언트 인터랙션) |
| 상태 푸시 | SSE `/api/orders/:id/stream` (ADR-015) |
| 관리자 SPA-lite? | EJS + Alpine으로 충분 (5초 폴링은 Alpine `setInterval`) |

> **시안은 React인데 실제는 EJS·Alpine.** HANDOFF.md §6.1도 "각 Screen 파일을 라우트 페이지로 매핑" 권장. 변환 시 컴포넌트는 EJS partial로, 상태는 Alpine `x-data`로.

---

## 6. 디자인 토큰 정합성 (CSS vs DESIGN.md)

`prototype.html` 상단 `:root` 변수 ↔ `DESIGN.md §3-9` *1:1 매핑*. 토큰 비교:

| Group | DESIGN.md | Bundle CSS | 일치 |
|---|---|---|:---:|
| 라이트 default | #F5EFE0 / #EAE3D0 / #2A2C20 | ✅ 동일 | ✅ |
| 다크 보조 | #1A1A14 / #25241A / #F5EFE0 | ✅ `respect-dark` 클래스에서 | ✅ |
| 액센트 옐로 | #F4D200 | ✅ | ✅ |
| 카모 4색 | olive·sand·earth·leaf | ✅ | ✅ |
| 시맨틱 | success/warning/danger/info | ✅ | ✅ |
| 도장 컬러 | red·black·green | ✅ | ✅ |
| 폰트 3종 | Pretendard·JetBrains Mono·Black Ops One | ✅ link + var | ✅ |
| 타입 스케일 | 10~64px (8단계) | ✅ | ✅ |
| 간격 | 4px base 9단계 | ✅ | ✅ |
| 라디우스 | 0/2/4/8/12/pill | ✅ | ✅ |
| 그림자 | hard-offset (blur 없음) | ✅ `2px 2px 0` | ✅ |
| 모션 | duration·ease 토큰 | ✅ | ✅ |

**토큰 일치율 100%**. 구현 시 `prototype.html` `<style>` 블록 상단 ~150줄을 `tokens.css`로 잘라내면 Tailwind config의 `theme.extend` 또는 CSS 변수로 즉시 활용 가능.

---

## 7. 사용자 5개 누락 사항 정밀 진단

### G1 — 정산하기 버튼 missing in admin

**현황:**
- `screens-admin.jsx:436-765`에 **`AdminSettlement` 함수 완전 구현** (정산 마감 modal · ZIP 다운로드 버튼 · 메뉴별 판매 grid · 시간대별 그래프 · 백업 이력 · ADR-012/016/022 가드 모두)
- `screens-admin.jsx:769` `Object.assign(window, {... AdminSettlement})` — export ✅
- **`app.jsx:155-165` `renderAdmin()` 함수의 분기에 settlement 미포함 ❌**
- **`screens-admin.jsx:78` AdminTopNav에 "메뉴 관리"·"통계" 버튼 placeholder (onClick 없음) ❌**
- **`HANDOFF.md` 화면 목록 A-1~A-4만 명시, A-5 누락 ❌**
- **`app.jsx 237-246` Tweaks 패널 관리자 빠른 이동에도 settlement 없음 ❌**

**결론:** 코드는 있지만 *4 군데가 끊겨있어 접근 불가능*.

**구현 시 수정 (4단계):**
```
1. app.jsx renderAdmin()에 추가:
   {adminState.page === 'settlement' && <AdminSettlement adminState={...} setAdmin={...} />}

2. AdminTopNav에 "📒 정산" nav-link 추가 + onClick={() => setAdmin({...adminState, page: 'settlement'})}

3. (선택) Tweaks 패널에 "A-5 정산" 빠른 이동 버튼 추가

4. HANDOFF.md §3에 "A-5 /admin/settlement — 정산 화면" 섹션 추가
```

### G2 — 쿠폰 카피 = "쿠폰 사용(컴모융 1학년 한정 1,000원 할인)"

**현황 (`screens-customer.jsx:348`):**
```jsx
<Checkbox ...>쿠폰 사용 (1학년 한정 1,000원 할인)</Checkbox>
```

**사용자 요구:** `쿠폰 사용(컴모융 1학년 한정 1,000원 할인)`

**차이:** 한 단어 — "**컴모융**" 추가 (그리고 공백 제거 옵션). 사용자 카피 그대로 적용 권장.

**구현 시 수정 (1줄):**
```jsx
<Checkbox ...>쿠폰 사용 (컴모융 1학년 한정 1,000원 할인)</Checkbox>
```

**sub 카피도 일관성 점검 필요 (line 345-347):**
```jsx
sub={couponEligible
  ? '✓ 1학년 (2026학번) — 1,000원 할인 적용 가능'
  : '※ 1학년(2026 학번)만 사용 가능. 학번 입력 시 자동 판정.'}
```
→ `1학년 (2026학번)`을 `컴모융 1학년 (학번 202637...)`로 수정 (ADR-019의 prefix 202637과 일치하게).

### G3 — 학번 없음 체크 시 쿠폰 사용 버튼 사라져야

**현황 (`screens-customer.jsx:340-349`):**
```jsx
<div className="col gap-3">
  <div className="section-label">③ 쿠폰</div>
  <Checkbox checked={coupon} onChange={setCoupon} sub={...}>
    쿠폰 사용 (1학년 한정 1,000원 할인)
  </Checkbox>
</div>
```
→ `external` 값과 무관하게 *항상 렌더*. 외부인이 체크해도 `couponEligible`이 false라 동작은 안 하지만 *시각적으로 표시됨*.

**구현 시 수정:**
```jsx
{!external && (
  <div className="col gap-3">
    <div className="section-label">③ 쿠폰</div>
    <Checkbox ...>...</Checkbox>
  </div>
)}
```

**부가:** 외부인이 도중에 "학번 없음"으로 전환하면 `coupon` 상태도 자동 false로 리셋:
```jsx
useEffect(() => { if (external && coupon) setCoupon(false); }, [external]);
```

### G4 — 쿠폰 사용 누르면 합계 낮아져야

**현황 (`screens-customer.jsx:243-244`):**
```jsx
const couponEligible = !external && /^2026\d{5}$/.test(sid);
const discount = coupon && couponEligible ? 1000 : 0;
const total = subtotal - discount;
```

**평가:**
- eligible 학생이 체크 → discount=1000 → total 즉시 갱신 → 영수증 라인에 `쿠폰 할인 -1,000원` 추가 표시 ✅ **이미 작동**
- 비-eligible 사용자가 체크 → 시각 변화 0 (체크박스만 켜짐) ❌

**문제:** G3에서 외부인은 체크박스 숨김으로 해결. 학번 *형식 오류*나 *prefix 불일치*인 학생이 체크하면 여전히 동작 없음. **G3 + G5와 묶어 통합 가드:**

```jsx
const sidIs9 = /^\d{9}$/.test(sid);
const sidPrefixOK = sid.startsWith('202637');     // ADR-019 컴모융
const nameValid = name.trim().length >= 1;        // G5
const couponEligible = !external && sidIs9 && sidPrefixOK && nameValid;

// 쿠폰 섹션 표시 조건 (G3+G4+G5 통합)
const showCouponSection = !external && couponEligible;
```

→ 표시되는 순간 누르면 *반드시 작동*. 시각·기능 일관.

### G5 — 쿠폰 사용은 학번+이름 무조건 입력 + 중복 사용 대조 + 알림

**현황 (`screens-customer.jsx`):**
- couponEligible은 **학번 prefix만 체크** (line 243)
- 이름 검증 X (이름은 submit 시에만 검증 line 248)
- **중복 사용 검증 (used_coupons UNIQUE) 클라이언트 측 호출 0**
- submit 시점에 서버가 검증하지만 *사용자는 검증 결과까지 모름*

**구현 시 수정 (3 영역):**

**(a) 클라이언트 사전 검증 (UX-9 회복 가능한 실패):**
```jsx
const couponEligible = sidIs9 && sidPrefixOK && nameValid;  // G4 통합
```

**(b) 체크박스 활성화 시점에 서버 호출 (중복 검증):**
```jsx
async function onCouponToggle(checked) {
  if (!checked) { setCoupon(false); return; }

  // API_DRAFT 신설 후보: GET /api/coupons/check?sid=...&name=...
  setCouponChecking(true);
  try {
    const res = await fetch(`/api/coupons/check?sid=${sid}&name=${encodeURIComponent(name)}`);
    if (res.status === 409) {
      // 이미 사용됨
      setCouponError('이 학번은 이미 쿠폰을 사용했어요. 즐거운 축제 보내세요! 🎉');
      return;
    }
    if (res.status === 200) {
      setCoupon(true);
      setCouponError(null);
    }
  } finally {
    setCouponChecking(false);
  }
}
```

**(c) 에러 표시 — 알림 모달이 아닌 *인라인* (UX-9 + DESIGN.md §11 #16 토스트 회피):**
```jsx
{couponError && (
  <div className="warn-banner" style={{ background:'rgba(199,62,29,0.10)', borderColor:'var(--color-danger)' }}>
    <span>⚠️</span><span>{couponError}</span>
  </div>
)}
```

**API_DRAFT.md 신설 필요:**
```
GET /api/coupons/check?sid=202637042&name=홍길동

응답:
- 200 { ok: true, eligible: true, discount: 1000 }
- 400 { ok: false, error: { code: 'COUPON_FORMAT'|'COUPON_PREFIX'|'COUPON_NAME' } }
- 409 { ok: false, error: { code: 'COUPON_DUPLICATE', message: '이 학번은 이미 쿠폰을 사용했어요...' } }
```

→ `docs/API_DRAFT.md §1.4` 다음에 §1.4b 추가. POST /api/orders (서버 자체 계산, ADR-020)에도 동일 검증 흐름 보장.

> **참고: ADR-019 검증 4단계** — (1) 9자리 (2) prefix 202637 (3) 이름 1자+ (4) used_coupons UNIQUE. 번들은 1·2만 클라이언트 사전 검증, 3·4는 서버 의존. *클라이언트 (1)~(3) 사전 + 서버 (1)~(4) 최종*이 정답.

---

## 8. 추가 발견 사항 (사용자 5개 외)

### F1 — HANDOFF.md vs 코드 내부 불일치

- HANDOFF.md §0 "관리자 화면 A-1 ~ A-4"
- 실제: `screens-admin.jsx`에 A-5 AdminSettlement 코드 존재 (765줄까지)
- HANDOFF.md §6.4 누락 방지 체크리스트에도 settlement 미포함
- → HANDOFF.md를 *bundle 코드 기준*으로 1차 보강 권장 (구현 시 우리는 어차피 새 docs로 통합)

### F2 — TopNav placeholder 버튼 2개

- `screens-admin.jsx:78` `<button className="nav-link">메뉴 관리</button>` (onClick 없음)
- `screens-admin.jsx:79` `<button className="nav-link">통계</button>` (onClick 없음)
- → 구현 시 이 둘을 *실제 라우터에 연결* 또는 *시안 단계에선 disabled로 명시*

### F3 — ScreenStatus 카피 1건이 기획서와 불일치

| 상태 | UX_STRATEGY §7.4 (기획) | Bundle ScreenStatus (line 571) |
|---|---|---|
| TRANSFER_REPORTED | `"입금 확인 중이에요. 잠시만 기다려 주세요 👀"` | `"💸 본부가 통장을 확인하는 중"` |

- 둘 다 톤 OK이지만 *기획서와 시안이 다름*. 구현 시 *기획서 카피로 통일* 또는 *시안 카피로 기획서 갱신*. 사용자 결정 필요 (gap 후보).

### F4 — 외부인 분기에서 sub 카피 "가족·친구 등 학번이 없으신 분"

`screens-customer.jsx:273`:
```jsx
<Checkbox checked={external} onChange={setExternal}
  sub="가족·친구 등 학번이 없으신 분">학번 없음 (외부인)</Checkbox>
```

UX_STRATEGY §8.6 (Finding F)와 충돌 X — *외부인 친구·가족 공유 가치*가 의도된 동작. 카피 자연스러움.

### F5 — Mock 데이터 ID 16번이 "외부인"

`components.jsx:314` `{ id:16, who:'정수민', sid:'', external:true, ... }`

→ 외부인 시연 데이터 명시 ✅. 구현 시 동일하게 `external=true` 분기 처리.

### F6 — 본부 PIN 7842 placeholder

`screens-admin.jsx:22`. ADR-024·25 명시되어 있고 시안 힌트로 노출 ("힌트: 7842"). **운영 시 환경변수 `ADMIN_PINS` 필수** + 시안의 `if (next === '7842')` 부분을 *서버 검증*으로 교체.

### F7 — 메뉴 이미지 fallback이 placeholder

`MenuFallback` (components.jsx:200-213) — 이모지 + 카테고리 색. ADR-006 기준 일치. 실 사진 수령 시 fallback과 *동일 비율(1:1)·동일 높이* 필수 (HANDOFF §6.3 운영 1주일 전 체크리스트).

### F8 — DogTag dropping prop 활용

`screens-customer.jsx:382-386`:
```jsx
const dropKey = 'dogtag-shown-' + o.id;
const [drop, setDrop] = useState(() => !sessionStorage.getItem(dropKey));
useEffect(() => { if (drop) sessionStorage.setItem(dropKey, '1'); }, []);
```

→ DESIGN.md §9.3 Finding D 그대로 구현 ✅. 구현 시 *Order ID당 1회* 핵심 동작 유지.

### F9 — Stamp 회전 prop

`screens-customer.jsx:88` `<Stamp kind="recommended" rotate={-6} />` `screens-customer.jsx:91` `<Stamp kind="sold-out" rotate={-12} />`

→ DESIGN.md Risk 1 (진짜 도장 회전·blur 외곽) 부분 구현. *외곽 turbulence*는 CSS pseudo로 대신, 실 SVG 자산 수령 시 *진짜 거친 외곽*으로 교체.

---

## 9. 구현 진입 시 작업 분할

D-day 5/20까지 8일 남음 (2026-05-12 기준). 사용자 "구현 시작" 신호 후 작업 순서:

### Phase 0 — 기반 설정 (반나절)

| # | 작업 | 산출물 |
|---|---|---|
| 0.1 | Docker compose + Express + better-sqlite3 셋업 | `docker-compose.yml`, `Dockerfile`, `src/server.js` |
| 0.2 | `prototype.html` `:root` 토큰 → `public/css/tokens.css` 추출 | tokens.css |
| 0.3 | Tailwind config의 theme.extend로 매핑 | `tailwind.config.js` |
| 0.4 | DB migration 001-init.sql (DB_DRAFT.md 11개 테이블) | `db/migrations/001-init.sql` |
| 0.5 | 폰트 3종 self-host 또는 CDN preconnect | `views/layouts/customer.ejs` head |

### Phase 1 — 도메인·API 기반 (1.5일)

| # | 작업 | 산출물 |
|---|---|---|
| 1.1 | `domain/pricing.js` Pattern B (ADR-020) + 단위 테스트 4 케이스 | `src/domain/pricing.js`, `tests/unit/pricing-adr020.test.js` |
| 1.2 | `domain/coupon-validation.js` (ADR-019 4단계 + name 추가) | `src/domain/coupon-validation.js` |
| 1.3 | `domain/order-state.js` 상태 전이 머신 | `src/domain/order-state.js` |
| 1.4 | `routes/api/coupons/check` 신설 (**G5 핵심**) | `src/routes/api/coupons.js` |
| 1.5 | `routes/api/orders` POST (Pattern B) | `src/routes/api/orders.js` |

### Phase 2 — 사용자 화면 (2일)

bundle의 `screens-customer.jsx`를 EJS+Alpine 변환:

| # | Bundle → EJS·Alpine | 핵심 수정 |
|---|---|---|
| 2.1 | ScreenMenu → `views/customer/menu.ejs` + `public/js/menu.js` | — |
| 2.2 | ScreenCart → `views/customer/cart.ejs` | 영수증의 "쿠폰 (1학년, 다음 단계 적용)" 카피 명확화 |
| 2.3 | ScreenCheckout → `views/customer/checkout.ejs` | **G2~G5 모두 적용** (카피·외부인 분기·이름 검증·중복 검증 호출) |
| 2.4 | ScreenComplete → `views/customer/complete.ejs` | DogTag sessionStorage Alpine `x-init`로 |
| 2.5 | ScreenTransfer → `views/customer/transfer.ejs` | 자동 진입 redirect (Finding B) |
| 2.6 | ScreenStatus → `views/customer/status.ejs` + SSE 클라이언트 | F3 카피 통일 |

### Phase 3 — 관리자 화면 (2.5일)

| # | 작업 | 비고 |
|---|---|---|
| 3.1 | AdminLogin → `views/admin/login.ejs` + scrypt PIN 해시 검증 | 환경변수 사용 |
| 3.2 | AdminDashboard → `views/admin/dashboard.ejs` + Alpine 5초 폴링 | Kanban 6-col |
| 3.3 | AdminOrderDetail → `views/admin/orders/:id.ejs` | |
| 3.4 | AdminTransfers → `views/admin/transfers.ejs` | |
| 3.5 | **AdminSettlement → `views/admin/settlement.ejs`** (**G1**) | **TopNav에 "📒 정산" 링크 + 라우터 GET /admin/settlement + ZIP API** |
| 3.6 | A-5 메뉴 관리 신설 | CRUD + 품절 토글 + 추천 토글 |

### Phase 4 — 부속 (반나절)

| # | 작업 |
|---|---|
| 4.1 | C-7 `/map` 약도 페이지 (이미지 수령 후) |
| 4.2 | C-8 풀스크린 404·500 (마스코트 canceled + 홈으로) |
| 4.3 | SSE Hub + auto-snapshot 30분 cron |
| 4.4 | ZIP 다운로드 stream (archiver) |

### Phase 5 — 자산·통합 검증 (1일)

| # | 작업 |
|---|---|
| 5.1 | 마스코트 5종 SVG 외주 도착 → `public/images/mascot/` 교체 |
| 5.2 | 도장 5종 SVG → `Stamp` 컴포넌트 자산 교체 |
| 5.3 | 메뉴 사진 9장 1:1 720px → `public/images/menus/` |
| 5.4 | 부스 약도 이미지 → C-7 |
| 5.5 | 학생회 계좌·예금주·PIN → `.env` |
| 5.6 | E2E 10 시나리오 (TEST_PLAN §8.2) — Playwright |

### Phase 6 — D-1 리허설 (5/19)

| # | 작업 |
|---|---|
| 6.1 | 운영진 5명+ 가상 주문 30건 흐름 |
| 6.2 | 1원 단위 실제 이체 → 본부 매칭 → 조리 토글 → 수령 |
| 6.3 | ZIP 다운로드 USB 복사 검증 |
| 6.4 | 다크/라이트 부스 환경 최종 검증 (Finding A) |
| 6.5 | 발견 이슈 → 5/20 오전까지 hotfix |

**예상 일정 표:**
```
5/12 (오늘) — 이 분석 + 사용자 "구현 시작" 신호 검토
5/13       — Phase 0 (반나절) + Phase 1 (1.5일) 시작
5/14       — Phase 1 마무리
5/15       — Phase 2 (2일)
5/16       — Phase 2 + Phase 3 시작
5/17       — Phase 3
5/18       — Phase 3 마무리 + Phase 4 (반나절)
5/19       — Phase 5 (자산 통합) + D-1 리허설 (Phase 6)
5/20 16:30 — 운영 시작
```

> **위험 신호:** Phase 1~5 합 = 7.5일. Phase 6 D-1 리허설 포함 시 8일. **남은 8일 = 거의 빠듯**. 자산 도착 지연 시 Phase 5가 가장 큰 변수. 마스코트·도장 자산은 *외주 의뢰 즉시 시작 권장*.

---

## 10. 다음 단계 결정

이 문서는 *분석*. 다음 결정 사항:

| # | 결정 항목 | 옵션 |
|---|---|---|
| D1 | G1~G5 + F1~F9를 **DESIGN.md·UX_STRATEGY.md에 반영할지** | (a) 모두 반영 (b) G1~G5만 반영 (c) DESIGN_REVIEW.md 식으로 별도 추적 |
| D2 | F3 카피 충돌 (TRANSFER_REPORTED) 어느 것 채택 | (a) 기획서 "입금 확인 중이에요 👀" (b) 시안 "본부가 통장을 확인하는 중" |
| D3 | A-5 메뉴 관리 신설 시점 | (a) Phase 3 포함 (b) Phase 2 후 별도 (c) Phase 2 운영부터 |
| D4 | `prototype.html` 자체를 *디자인 참조 자산*으로 git 보관할지 | (a) 보관 (b) `.gitignore` (c) `docs/design-bundle/` 그대로 |
| D5 | "구현 시작" 신호 시점 | 사용자 결정 |

> 모두 사용자 결정 — 이 분석은 **선택지를 명확하게 제시**까지만.

---

## 11. 결론 (Executive Summary)

**Bundle 평가:**
- 디자인 토큰·컴포넌트·도그태그 메모러블·라이트 default·자동 진입·sessionStorage 단발 등 **DESIGN.md / UX_STRATEGY.md / DESIGN_REVIEW.md의 모든 정합 결정**을 *충실히* 구현
- 토큰 일치율 100%, 컴포넌트 일치율 23/23 (4개는 Screen 인라인)
- HANDOFF.md 자체에 *내부 불일치 1건* (A-5 코드 있으나 문서 누락) + 라우팅 미연결 → **G1의 원인**

**누락 (5개 사용자 인지 + 4개 추가):**
- G1 정산 라우팅 미연결 (코드는 있음)
- G2 쿠폰 카피 "컴모융" 누락
- G3 외부인 시 쿠폰 숨김 X
- G4 쿠폰 시각 피드백 (G3·G5와 통합 해결)
- G5 쿠폰 중복 검증 API 미존재
- F1 HANDOFF.md 내부 불일치
- F2 TopNav placeholder 2개 (메뉴 관리·통계)
- F3 카피 충돌 (TRANSFER_REPORTED)
- F8 A-5 메뉴 관리 화면 자체 없음

**구현 진입 준비도: 85%.** 남은 작업은:
1. G1~G5 수정 (1일 안 끝남)
2. A-5 메뉴 관리 신설 (반나절)
3. C-7 약도 + C-8 풀스크린 에러 (반나절)
4. EJS+Alpine 변환 (React 시안 → 실 코드)
5. 마스코트·도장·메뉴 사진 자산 교체

**최종 권장:** **D1·D2·D3 결정 → `/superpowers:writing-plans`로 진입**. D5("구현 시작") 신호 받으면 Phase 0부터 시작.

---

**STATUS:** DONE
**REASON:** Bundle 13개 파일 모두 분석 + 기존 4 docs 셀별 비교 + 사용자 5개 누락 + 추가 9개 발견 정리.
**ATTEMPTED:** `WebFetch`(404, 인증 필요), zip 수동 다운로드 → 13개 파일 모두 Read → 비교 매트릭스 작성.
**RECOMMENDATION:** D1·D2·D3 결정 후 `/superpowers:writing-plans`. 사용자 "구현 시작" 신호 대기.
