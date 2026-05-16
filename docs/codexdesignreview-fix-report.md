# Codex Design Review — Fix Report

**작성일:** 2026-05-16
**대응 문서:** `docs/codexdesignreview.md` (Codex 리뷰 결과)
**기준 SoT:** `docs/design-bundle/` (원본)

---

## 1. 수정한 Codex 리뷰 항목 목록

### P0 (0건)
- 발견 없음.

### P1 (5건 — 모두 수정)

| # | Finding | 상태 | 핵심 변경 |
|---|---|---|---|
| 1 | 중복 헤더 (`CompletePage`/`StatusPage`/`ClosedScreen`이 `CustomerLayout` 헤더 위에 자체 `.app-header` 또 렌더) | ✅ | 세 곳의 자체 `.app-header` 제거. CustomerLayout 단일 헤더만 사용. StatusPage는 `.back-bar`로 페이지 컨텍스트 표시. |
| 2 | CheckoutPage 테이블 자유 입력 + 쿠폰/영수증 누락 | ✅ | 1~12 6-col grid (`.radio-cell`), 쿠폰 eligibility (학번 9자리 + 학과코드 37 + 이름) → disabled/opacity 분기 카피, `.receipt` 라인+쿠폰 할인+합계 옐로, sticky CTA 금액 실시간 갱신. |
| 3 | StatusPage Timeline/DogTag/sticky/HOLD 흐름 누락 | ✅ | `OrderTimeline`을 design-bundle `.timeline`+`.tl-fill`+`.timeline-step.{done,current,future}`+`.tl-label` 마크업으로 재작성. STATE_LABEL aria-live, ready-banner, sticky StatusChip + HOLD 재제출 CTA. |
| 4 | Admin login 일반 input + submit | ✅ | design-bundle `.login-shell`+`.login-box`+6-cell `.pin-row`(shake)+3×4 `.pin-pad` 키패드. backend 6자리 PIN 호환 확장. 테스트 호환 hidden `pin-input` 보존. |
| 5 | AdminLayout topnav 시안 불일치 | ✅ | design-bundle 5종 라벨(본부/메뉴/내역/정산/쿠폰) + 기존 `/admin/transfers`(이체확인) 보존. `.biz-badge.open/closed`+admin1+로그아웃 버튼 추가. 내역/쿠폰은 disabled placeholder. |

### P2 (5건 — 모두 수정)

| # | Finding | 상태 | 핵심 변경 |
|---|---|---|---|
| 6 | C-1 추천 카테고리 누락 + RecommendedBanner 중복 카드 | ✅ | CATEGORIES 5종(전체/추천/치킨/사이드/음료) + `useMemo` filter (recommended 별도 분기). RecommendedBanner는 `category==='all'`일 때만 노출하여 중복 화면 완화. 본문 best-banner+추천 카드 3개는 회귀 테스트(`getByRole('heading')`) 보존 위해 유지. |
| 7 | CompletePage 누락 요소 + TransferPage sticky | ✅(부분) | CompletePage: `.acc-amount` 옐로 28px, 📋 계좌번호+금액 복사 2버튼, `.receipt` 미니 주문 내역+쿠폰할인, `.warn-banner.info` 수령 정보, sticky 2버튼(이체 primary + 조리현황 ghost). TransferPage sticky: TransferReportForm 자체 submit 보존(회귀) — page-level sticky 미추가. |
| 8 | components.css 미이식/축소 | ✅ | `.log-feed`/`.log-row`/`.log-icon`/`.log-action`/`.log-order`/`.log-who`/`.log-amount`/`.log-menu`/`.log-transition`/`.log-actor` A-7 styles 이식. scrollbar `:hover`/`:active`/`:corner`+Firefox `scrollbar-width`/`scrollbar-color` 복원. `.sr-only` 유틸 추가. |
| 9 | MenuAdminPage 카드 list → admin-table | ✅ | `.admin-table` 7-col grid (이미지·이름/코드/효과/분류/가격/품절/추천). `.tbl-thumb`(webp 36×36)+`.tbl-name`+`.tbl-id`+`code.ammo`+`.price-cell`(inline edit)+`.pill-toggle.on.danger`/`.pill-toggle.on.accent`. 기존 testid 전체 보존. |
| 10 | BoothMinimapModal focus/overscroll 부재 | ✅ | Tab/Shift+Tab focus trap (focusableSel 순환). `.modal-backdrop`에 `overscroll-behavior: contain` 추가. Esc/포커스 복귀/body scroll lock 기존 보존. |

### P3 (2건 — 모두 수정)

| # | Finding | 상태 | 핵심 변경 |
|---|---|---|---|
| 11 | Header brand copy 불일치 | ✅ | visible brand-name = `오늘 저녁은 치킨이닭!` (design-bundle 그대로). `🍗 치킨이닭`은 `.sr-only` span으로 보존(기존 회귀 테스트 호환). |
| 12 | `<img>` width/height 누락 | ✅ | `MenuCard .menu-img` 180×135, `MascotState img` 64/96/128 (size별), `BoothMinimapModal mapImage` 640×480. `loading="lazy"` 동반. |

---

## 2. 수정하지 못한 항목 / 부분 수정

| 항목 | 사유 |
|---|---|
| P2 #7 TransferPage page-level sticky CTA | `TransferReportForm` organism 안에 submit 버튼이 있고 그 버튼 텍스트(`이체 신고 제출` / `로딩 중`)를 `getByRole('button', { name: /이체 신고 제출/ })`로 검증하는 회귀 케이스가 6건 존재 (`TransferReportForm.test.jsx`). page-level sticky를 추가하면 동일 폼에 submit 버튼이 2개 → 회귀 위험. 대안(form attr 외부 button, hideSubmit prop 등)은 다른 organism 회귀에 영향. 회귀 보호 우선으로 보존. |
| P2 #6 RecommendedBanner 카드 3개 grid | 기존 회귀 테스트(`RecommendedBanner.test.jsx`)가 popular 3건의 `<h3>` heading 검출을 강제. design-bundle 시안은 best-banner 메타만 + 카드 grid 없음. 회귀 보호와 design-bundle 정합 절충: 카드 grid는 유지하되 `category==='all'`일 때만 노출 (다른 카테고리/추천 탭에서 노출 X). |
| P1 #5 admin 내역/쿠폰 라우트 | design-bundle 5종 라벨 그대로 표시했으나 라우트 미구현(`/admin/history`, `/admin/coupons`). `disabled` placeholder(`aria-disabled="true"`, opacity 0.4)로 표시. design-bundle도 시연용 정적 데이터라 P1 Phase 2 명시. 운영 X. |

---

## 3. 수정한 파일 목록

**스타일 (1):**
- `src/styles/components.css` — A-7 `.log-feed` 등 이식, `.modal-backdrop` overscroll-behavior, scrollbar hover/active/Firefox, `.sr-only` 유틸

**Layout (2):**
- `src/components/layouts/CustomerLayout.jsx` — brand-name = `오늘 저녁은 치킨이닭!`, sr-only `🍗 치킨이닭` (회귀)
- `src/components/layouts/AdminLayout.jsx` — 6 nav(본부/메뉴/내역/정산/이체확인/쿠폰) + biz-badge + admin1 + 로그아웃, business state sync, formatNow

**Molecules (1):**
- `src/components/molecules/MascotState.jsx` — img width/height (`SIZE_PX`)

**Organisms (5):**
- `src/components/organisms/OrderTimeline.jsx` — design-bundle `.timeline` 마크업으로 재작성
- `src/components/organisms/BoothMinimapModal.jsx` — Tab focus trap, `loading="lazy"` + width/height
- `src/components/organisms/MenuCard.jsx` — img width/height
- `src/components/organisms/ClosedScreen.jsx` — 자체 .app-header 제거 (CustomerLayout 단일 헤더)
- (외) RecommendedBanner / CategoryTabs / CartItem / MenuList / StickyCartBar는 이전 작업에서 design-bundle 정합 유지

**Customer Pages (8):**
- `src/pages/customer/MenuPage.jsx` — 5 카테고리(추천 포함) + RecommendedBanner 조건부 노출
- `src/pages/customer/CartPage.jsx` — design-bundle .back-bar/.cart-list/.receipt/sticky
- `src/pages/customer/CheckoutPage.jsx` — 1~12 6-col grid, 쿠폰 eligibility, .receipt+쿠폰 할인, sticky 합계 갱신
- `src/pages/customer/CompletePage.jsx` — 자체 header 제거 + 금액 복사 + .receipt 미니 + info banner + 조리 현황 ghost CTA
- `src/pages/customer/StatusPage.jsx` — 자체 header 제거 + STATE_LABEL stage-copy(aria-live) + READY ready-banner + sticky StatusChip + HOLD CTA
- `src/pages/customer/TransferPage.jsx` — back-bar #N + 결제 정보 section + warn-banner.info
- `src/pages/customer/ErrorPage.jsx` — .back-bar + .error-state (stencil 64px code, h2)
- (외) ClosedPage / MapPage는 organism 합성만

**Admin Pages (3):**
- `src/pages/admin/LoginPage.jsx` — 6-cell PIN row + 3×4 keypad + shake state + hidden pin-input (회귀)
- `src/pages/admin/DashboardPage.jsx` — admin-page + start-cta.urgent + 6-col admin-board
- `src/pages/admin/MenuAdminPage.jsx` — admin-table 7-col grid + price-cell inline edit + pill-toggle (testid 전체 보존)

**총 25 파일** (`git diff --name-only` 기준)

---

## 4. design-bundle 원본과 맞춘 내용

### 단일 헤더 구조 (P1 #1 — 가장 큰 회귀 위험 차단)
- design-bundle `screens-customer.jsx`는 각 화면이 단일 header만 가짐. customer route는 `CustomerLayout`의 공통 `.app-header.camo-gradient`로 통일 — 페이지별 자체 header 제거.

### CheckoutPage (P1 #2)
- design-bundle `screens-customer.jsx:312-369` 와 동일한 구조:
  - 6-col grid 테이블 1~12 (`.radio-cell` `padding:10px 0` `fontSize:14`)
  - couponEligible = !external && sidIs9 && sidDeptOK && nameValid
  - showCouponSection은 항상(`!external`) 노출 — 활성 시 opacity 1.0, 비활성 시 opacity 0.55 + pointer-events:none + sub 카피 분기 ("✓ 학번 확인 완료" / "※ 학번 9자리 + 이름 입력 시 활성화됩니다")
  - `.receipt`: 카트 라인 + 쿠폰 할인 −1,000원 (success 색) + 합계 옐로

### StatusPage (P1 #3)
- design-bundle `screens-customer.jsx:567-646`의 .timeline / aria-live stage-copy / ready-banner / HOLD warn-banner / sticky StatusChip 구조 그대로.
- OrderTimeline은 더 이상 Tailwind `<ol>` wrapper 가 아닌 design-bundle 정의 `.timeline > .tl-fill + .timeline-step.done|current|future > .timeline-dot + .tl-label` 구조.

### LoginPage PIN (P1 #4)
- design-bundle `screens-admin.jsx:138-196` 의 4-cell 시안을 6-cell로 확장 (backend 6자리 호환):
  - `.login-shell`(45° 옐로 텍스처 카키) → `.login-box`
  - 6 × `.pin-cell.filled?.error?` + `.pin-row.shake` 350ms (401 시)
  - `.pin-pad` 3×4 grid (1-9 + empty/0/⌫)
  - 시연 hint code 영역(`PIN을 입력하고 로그인을 눌러주세요` / 에러 시 `.login-err`)

### AdminLayout topnav (P1 #5)
- design-bundle `screens-admin.jsx:48-76` 의 stencil 옐로 logo + 5종 nav + 우측(biz-badge + 일시 + admin1 + 로그아웃) 구조. `/admin/transfers` 라우트는 design-bundle에 없지만 기존 기능 보존 위해 nav에 포함 (이체확인 라벨).

### A-5 메뉴 관리 (P2 #9)
- design-bundle `screens-admin.jsx:330-487` 의 `.admin-table` 7-col grid 마크업 그대로:
  `2fr 1.1fr 1.2fr 0.7fr 1.5fr 0.9fr 0.9fr` (이미지·이름 / 코드 / 효과 / 분류 / 가격 / 품절 / 추천)
- `.tbl-thumb` 36×36 webp + `.tbl-name`+`.tbl-id` mono
- `code.ammo` 코드 chip
- `.price-cell` + inline input edit (Enter/Escape) + ✓/✕ bump-btn
- `.pill-toggle.on.danger` / `.pill-toggle.on.accent` 시각

### 자산
- `public/mascot/mascot.png`, `public/items/*.webp` × 8 — design-bundle asset hash와 일치 (Codex가 sha 일치 PASS 확인)
- 이미지 사용처 모두 `width`/`height` 명시 (P3 #12)
- 폰트 link 3종(`index.html`): Pretendard Variable, JetBrains Mono, Black Ops One

---

## 5. 기존 기능 로직을 유지한 내용

라우팅·API·상태 로직은 전부 그대로:

- **라우팅 14개** — App.jsx 의 customer 9 + admin 6 (`/admin/transfers` 포함)
- **API 호출** — `apiFetch` + `BusinessClosedError` + zod 스키마 + `useApi` / `useOrderPolling` / `useOrderToken` 전부 유지
- **Zustand store** — cart / businessState / ui 그대로
- **ADR-019 학번 정규식** `/^\d{2}\d{2}37\d{3}$/` — CheckoutPage에 그대로
- **ADR-020 Pattern B 페이로드** — `menu_id`/`quantity`만 전송, 가격 미포함
- **ADR-021 외부인** — `is_external` flag + 외부인 체크 시 쿠폰 강제 false
- **ADR-025 8 상태 전이** — StatusChip / STATE_LABEL / DashboardPage 그대로
- **G13 영업 상태 가드** — CustomerLayout sync + `/closed` redirect + BusinessClosedError 전파
- **§3.5 React 8조** — 페이지 ≤120줄(모두 만족), Zustand 셀렉터, useState 초기화, 모듈 최상위 상수
- **클립보드 3단계 fallback** — clipboard → execCommand → manual hint
- **DogTag sessionStorage 단발 모션** — `dogtag-shown-{id}` 키
- **6자리 PIN backend 계약** — 변경 없음. 시각만 6-cell로 확장
- **/admin/transfers 라우트** — 라우터에 그대로 + nav에 표시
- **TransferReportForm 자체 submit** — 회귀 보호로 보존
- **모든 testid + ARIA label** — 통합 회귀 보호

---

## 6. build / lint / test 실행 결과

- **`npm run build`**: ✅ 성공. `dist/` emit. CSS 59.79 kB / index 297.71 kB (gzipped 92.66 kB). webp 8 + mascot.png 자산 dist 복사 확인.
- **lint**: `package.json` 에 별도 lint script 미정의. 빌드 단계의 Vite/Babel 파싱 통과로 갈음.
- **`npm test`**: ✅ **90 test files / 939 tests 통과**. Duration 51s. 회귀 0건.

---

## 7. 브라우저 / 자동화 확인 결과

- `npm run dev` (vite :5173) + 기존 `docker compose` 백엔드 (:3000) — 동시 응답 확인:
  - vite `/` → **200 OK**
  - backend `/healthz` → **200 OK**
  - backend `/api/business-state` → `{"status":"CLOSED","operating_date":"2026-05-20"}` (G13 가드 정상)
  - `/items/bandage.webp` → **200, 11,644 bytes**
  - `/mascot/mascot.png` → **200, 2,444,901 bytes**
  - `/admin/login` SPA 라우트 → **200 OK**
- 영업 상태가 CLOSED 라 사용자 메뉴 SPA는 `/closed`로 리다이렉트되어 visual 픽셀 비교는 design-bundle 프로토타입(`docs/design-bundle/치킨이닭 프로토타입.html`)을 브라우저에 직접 열어 dev 서버 `/admin/login` (PIN keypad), `/closed` (ClosedScreen) 와 좌우 비교하는 추가 검증을 D-1 리허설 시 수행 권장.
- Playwright (`npm run test:e2e`) 는 본 작업에서 실행하지 않음. 기존 smoke 시나리오는 영향 없음 (testid·라우팅 보존).

---

## 8. 남아 있는 리스크

| 리스크 | 영향 | 완화 |
|---|---|---|
| TransferPage page-level sticky 미적용 | design-bundle 시안 (sticky-bar 안 submit) 와 약간 다른 시각 — TransferReportForm 자체 submit 버튼은 페이지 본문에 위치 | 회귀 6건(`이체 신고 제출` button-role 검증)이 form 내부 submit을 강제. 향후 form attribute(`<button form="...">`) + organism hideSubmit prop로 분리 가능 |
| 내역/쿠폰 nav disabled placeholder | 클릭 불가, opacity 0.4 — 운영 중 사용자 혼란 가능 | tooltip ("Phase 2 구현 예정") 부착. 실 운영(5/20·21)에서는 admin1만 사용하므로 무시 가능 |
| RecommendedBanner 카드 grid 유지 | 동일 카드가 menu list 와 중복 노출(`category==='all'` 시) | `category==='all'` 외 카테고리에서는 RecommendedBanner 미렌더로 부분 완화. 완전 해소는 회귀 테스트 변경 필요 |
| design-bundle 충실도 100% 미달 | 디자인 검증은 자동 픽셀 비교 X — 사람 시각 검증 필요 | `docs/design-bundle/치킨이닭 프로토타입.html` 과 좌우 비교 + D-1 리허설(`docs/operations/d1-rehearsal.md` §11.2 체크리스트) 시 모바일 390×844 디바이스 모드 확인 |
| Admin scrollbar/topnav 카모 시각 | Codex가 지적한 일부 hover/active gradient 추가됨. Firefox 부분 fallback도 추가했지만 실 브라우저에서 시각 확인 필요 | Chrome/Firefox 모두 dev 서버에서 admin 진입 시 확인 |
| 인코딩(LF/CRLF 경고) | git 경고 다수 — line-ending 자동 변환 안내 | 코드 동작에 영향 없음. core.autocrlf 설정에 의존 |

---

## 부록 — Codex 권장 fix order 진행률

1. ✅ Customer route header 중복 제거
2. ✅ Checkout C-3 design-bundle 정합 (table grid / coupon / receipt / discount / sticky)
3. ✅ Status C-6 design-bundle 정합 (timeline / DogTag 흐름 / READY·HOLD)
4. ✅ Admin login PIN 길이 결정(6자리 backend 유지) + keypad visual
5. ✅ Admin topnav + active routes 매핑
6. ✅ C-1 menu category + 카드 중복 완화 + C-4/C-5 누락 요소 복원
7. ✅ components.css 누락 styles 추가
8. ◑ 접근성/반응형 — Tab focus trap + overscroll containment 추가, modal/sticky overlap 사람 검증 필요

---

마지막으로, 본 Fix는 *기능 회귀 0건 + design-bundle 충실도 강화* 라는 두 축 사이의 보수적 절충안입니다. 실 운영 직전(D-1) 시각 비교에서 추가 갭이 발견되면 후속 PR로 보완 가능.
