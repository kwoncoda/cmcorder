# Codex Design Review

## 1. Summary

현재 변경은 `docs/design-bundle/`의 자산과 주요 semantic CSS를 상당 부분 가져왔지만, 화면 구조와 상호작용이 design-bundle과 충분히 정렬되었다고 보기는 어렵습니다. 특히 공통 `CustomerLayout` 헤더 위에 화면별 `app-header`가 다시 렌더되는 중복 헤더, checkout의 쿠폰/테이블/영수증 흐름 누락, status 화면의 timeline/dogtag/sticky 상태 바 누락, 관리자 로그인과 top nav의 design-bundle 불일치가 남아 있습니다.

루트 `design-bundle/` 디렉터리는 존재하지 않았고, 저장소에는 `docs/design-bundle/`만 존재했습니다. `docs/DESIGN_BUNDLE_AUDIT.md`도 `docs/design-bundle/`를 SoT로 설명하므로, 실제 비교 기준은 확인 가능한 `docs/design-bundle/` 원본 파일로 삼았습니다.

## 2. Review Scope

- staged 변경사항: 없음 (`git diff --cached --name-status` 결과 변경 파일 없음)
- unstaged 변경사항:
  - `index.html`
  - `src/components/layouts/AdminLayout.jsx`
  - `src/components/layouts/CustomerLayout.jsx`
  - `src/components/molecules/DogTagFrame.jsx`
  - `src/components/molecules/MascotState.jsx`
  - `src/components/organisms/BoothMinimapModal.jsx`
  - `src/components/organisms/CartItem.jsx`
  - `src/components/organisms/CategoryTabs.jsx`
  - `src/components/organisms/ClosedScreen.jsx`
  - `src/components/organisms/MenuCard.jsx`
  - `src/components/organisms/MenuList.jsx`
  - `src/components/organisms/RecommendedBanner.jsx`
  - `src/components/organisms/StickyCartBar.jsx`
  - `src/pages/admin/DashboardPage.jsx`
  - `src/pages/admin/LoginPage.jsx`
  - `src/pages/customer/CartPage.jsx`
  - `src/pages/customer/CheckoutPage.jsx`
  - `src/pages/customer/CompletePage.jsx`
  - `src/pages/customer/ErrorPage.jsx`
  - `src/pages/customer/MenuPage.jsx`
  - `src/pages/customer/StatusPage.jsx`
  - `src/pages/customer/TransferPage.jsx`
  - `src/styles/components.css`
- untracked 파일:
  - `backups/auto-2026-05-15T14-29-05-548Z.zip`
  - `backups/auto-2026-05-15T15-29-05-538Z.zip`
  - `docs/DESIGN_BUNDLE_AUDIT.md`
  - `public/items/adrenaline.webp`
  - `public/items/bandage.webp`
  - `public/items/defib.webp`
  - `public/items/energy.webp`
  - `public/items/first-aid.webp`
  - `public/items/med-kit.webp`
  - `public/items/painkiller.webp`
  - `public/items/syringe.webp`
  - `public/mascot/mascot.png`
- design-bundle:
  - 루트 `design-bundle/`: 없음
  - 실제 존재 번들: `docs/design-bundle/`
  - 직접 확인한 주요 파일: `app.css`, `tokens.css`, `data.js`, `components.jsx`, `screens-customer.jsx`, `screens-admin.jsx`, `assets/`
- `docs/DESIGN_BUNDLE_AUDIT.md`: 존재함. 인코딩 출력은 깨졌지만, `docs/design-bundle/`를 보조 분석 기준으로 설명하는 문서임을 확인했습니다.
- 실행한 검증 명령:
  - `npm test`: exit 0, 통과. 단, jsdom/axe의 `window.getComputedStyle(elt, pseudoElt)` not implemented 경고와 React Router v7 future flag 경고가 출력되었습니다.
  - `npm run build`: 실행하지 않음. Vite build는 `dist/`를 덮어쓸 수 있어 "작성/덮어쓰기 가능 파일은 docs/codexdesignreview.md뿐"이라는 지시와 충돌합니다.
  - `npm run test:e2e`: 실행하지 않음. Playwright는 `test-results/` 산출물을 쓸 수 있어 동일한 이유로 제외했습니다.
  - lint/typecheck: package script가 없음.

## 3. Final Verdict

NEEDS FIXES: 중요한 design-bundle 불일치와 일부 UX/flow 회귀 위험이 남아 있습니다. 자산 복사와 상당수 CSS 이식은 진행되었지만, 화면별 JSX 구조가 design-bundle의 실제 화면 구조를 아직 충실히 따르지 않습니다.

## 4. Severity-Based Findings

### P0

발견 없음.

### P1

#### Finding 1

- Severity: P1
- File path: `src/components/layouts/CustomerLayout.jsx`, `src/pages/customer/CompletePage.jsx`, `src/pages/customer/StatusPage.jsx`, `src/components/organisms/ClosedScreen.jsx`, `src/App.jsx`
- Problem: customer route가 항상 `CustomerLayout`의 공통 `.app-header`를 렌더하는데, `CompletePage`, `StatusPage`, `ClosedScreen`도 내부에서 다시 `.app-header.camo-gradient`를 렌더합니다.
- Why it matters: `/orders/:id/complete`, `/orders/:id/status`, `/closed`에서 첫 화면에 헤더가 2개 보일 가능성이 큽니다. 모바일 기준 first viewport 공간을 크게 잡아먹고 design-bundle의 단일 screen header 구조와 어긋납니다.
- Evidence from design-bundle/ or current implementation: `App.jsx:66-76`은 모든 customer page를 `CustomerLayout` 아래에 둡니다. `CustomerLayout.jsx:56-82`가 공통 header를 렌더합니다. 추가로 `CompletePage.jsx:65-73`, `StatusPage.jsx:74-83`, `ClosedScreen.jsx:35-43`도 header를 렌더합니다. design-bundle은 `screens-customer.jsx:384-467`, `567-646`, `690-720`에서 각 화면 단위로 하나의 header만 보여줍니다.
- Suggested fix: customer 화면당 `.app-header`가 정확히 한 번만 렌더되도록 라우트 레이아웃과 페이지 header 책임을 정리하세요. design-bundle의 화면별 header copy를 유지하되, 공통 layout header와 중복되지 않게 해야 합니다.

#### Finding 2

- Severity: P1
- File path: `src/pages/customer/CheckoutPage.jsx`
- Problem: C-3 checkout 화면이 design-bundle의 테이블 선택, 쿠폰 활성화, 영수증 미리보기 구조와 다릅니다.
- Why it matters: 주문 접수 직전 핵심 UX입니다. 현재는 테이블 번호가 자유 입력이고, 쿠폰 섹션이 학번/이름 검증 전에도 표시되며, 쿠폰 할인과 합계가 receipt/sticky CTA에 즉시 반영되지 않습니다.
- Evidence from design-bundle/ or current implementation: current `CheckoutPage.jsx:93-99`는 테이블 번호 `<Input>`만 제공합니다. design-bundle `screens-customer.jsx:312-319`는 1~12 버튼의 6-column grid를 사용합니다. current `CheckoutPage.jsx:101-104`는 비외부인이면 항상 쿠폰 checkbox를 렌더하고, `CheckoutPage.jsx:108-112`는 sticky total에 `totalPrice`만 표시합니다. design-bundle `screens-customer.jsx:327-369`는 coupon eligibility에 따라 disabled/opacity/copy를 나누고, receipt에 `쿠폰 할인`과 할인 후 `합계`를 표시합니다.
- Suggested fix: design-bundle C-3 구조를 그대로 맞추세요. 테이블 선택은 1~12 grid로 제한하고, coupon eligibility/copy/disabled state/receipt discount/sticky total이 design-bundle과 동일하게 보여야 합니다.

#### Finding 3

- Severity: P1
- File path: `src/pages/customer/StatusPage.jsx`, `src/components/organisms/OrderTimeline.jsx`
- Problem: C-6 status 화면이 design-bundle의 `Timeline`, `DogTag`, `stage-copy`, `ready-banner`, `sticky-bar` 흐름을 완전히 재현하지 못합니다.
- Why it matters: 주문 진행 상황은 사용자 회복/수령 flow의 핵심입니다. 현재 status UI는 design-bundle CSS의 `.timeline`, `.tl-fill`, `.timeline-dot`, `.dogtag-sm`, sticky status bar를 거의 사용하지 않아 시각적 정렬과 READY/HOLD UX가 달라집니다.
- Evidence from design-bundle/ or current implementation: current `StatusPage.jsx:97`은 기존 `OrderTimeline`을 호출하고, `OrderTimeline.jsx:54-127`은 Tailwind progressbar wrapper와 `ol` 기반 점 표시를 사용합니다. design-bundle `screens-customer.jsx:591-643`은 `.timeline`, `Mascot`, `ready-banner`, `DogTag size="sm"`, HOLD 재제출 CTA가 포함된 `.sticky-bar`를 요구합니다. current `StatusPage.jsx:103-115`에는 READY banner와 HOLD warning은 있으나 dogtag와 sticky status/action bar가 없습니다.
- Suggested fix: `OrderTimeline` 또는 status page markup을 design-bundle `Timeline` 구조와 class contract에 맞추고, DogTag/sticky status bar/HOLD CTA를 복원하세요.

#### Finding 4

- Severity: P1
- File path: `src/pages/admin/LoginPage.jsx`
- Problem: A-1 admin login 화면이 design-bundle의 4-cell PIN row + 3x4 numeric keypad가 아니라 일반 password input + submit button입니다.
- Why it matters: 로그인은 관리자 첫 진입 화면이고, design-bundle에서 가장 구체적으로 정의된 interaction 중 하나입니다. 현재 UI는 `.pin-row`, `.pin-cell`, `.pin-pad`, `.pin-key`, shake state CSS를 전혀 사용하지 않습니다.
- Evidence from design-bundle/ or current implementation: current `LoginPage.jsx:38-54`는 `Input type="password"`와 하나의 submit button만 사용합니다. design-bundle `screens-admin.jsx:165-192`는 `.pin-row` 4칸, `.pin-pad` 12키, 오류 시 shake를 사용합니다. 단, 현재 backend는 `server/routes/admin.js:33`에서 6자리 PIN을 요구하므로 design-bundle의 4자리 시안과 기능 계약이 충돌합니다.
- Suggested fix: 디자인과 backend PIN 길이 계약을 먼저 명확히 맞추세요. 기존 API 6자리 요구를 보존해야 한다면 6자리 PIN pad로 design-bundle 구조를 확장할지, 또는 design-bundle 자체를 갱신할지 결정해야 합니다. 현재처럼 input 기반으로 두는 것은 design-bundle 이식으로 보기 어렵습니다.

#### Finding 5

- Severity: P1
- File path: `src/components/layouts/AdminLayout.jsx`
- Problem: A-2 admin topnav가 design-bundle의 nav 구성과 다릅니다.
- Why it matters: admin 정보 구조가 design-bundle과 어긋납니다. 내역/쿠폰/영업상태/로그아웃이 topnav에서 사라지고, 대신 design-bundle에 없는 `이체확인` route가 들어가 있어 운영자 flow가 source of truth와 달라집니다.
- Evidence from design-bundle/ or current implementation: current `AdminLayout.jsx:6-39`는 본부/메뉴/정산/이체확인 4개 nav와 weekday/admin1만 표시합니다. design-bundle `screens-admin.jsx:49-75`는 본부/메뉴/내역/정산/쿠폰 5개 nav, `.biz-badge`, 날짜/시간, admin1, 로그아웃 button을 포함합니다.
- Suggested fix: 기존 라우팅 보존이 필요한 항목과 design-bundle nav를 명확히 매핑하세요. 적어도 design-bundle의 visible topnav affordance인 내역, 쿠폰, 영업상태 badge, 로그아웃은 누락되지 않아야 합니다.

### P2

#### Finding 6

- Severity: P2
- File path: `src/pages/customer/MenuPage.jsx`, `src/components/organisms/RecommendedBanner.jsx`
- Problem: C-1 category tabs와 recommended section이 design-bundle과 다릅니다.
- Why it matters: menu first screen의 scanning flow가 달라집니다. `추천` tab이 누락되어 추천 필터가 불가능하고, `RecommendedBanner`가 별도 3-column card grid를 추가해 전체 메뉴 목록과 중복 노출될 수 있습니다.
- Evidence from design-bundle/ or current implementation: current `MenuPage.jsx:19-24`는 `전체/치킨/사이드/음료` 4개 category만 정의합니다. design-bundle `data.js:18`은 `전체/추천/치킨/사이드/음료`입니다. current `RecommendedBanner.jsx:34-44`는 추천 카드 3개 grid를 별도로 렌더합니다. design-bundle `screens-customer.jsx:62-78`는 best-banner 다음에 필터링된 `.menu-grid`를 렌더합니다.
- Suggested fix: category set과 recommended rendering을 design-bundle C-1과 일치시키세요. 추천은 tab/filter의 일부로 동작하고, best-banner가 임의의 중복 카드 grid를 만들지 않게 해야 합니다.

#### Finding 7

- Severity: P2
- File path: `src/pages/customer/CompletePage.jsx`, `src/pages/customer/TransferPage.jsx`
- Problem: C-4/C-5의 일부 design-bundle 요소가 빠졌거나 다른 위치에 있습니다.
- Why it matters: 주문 완료 후 입금 안내와 이체 신고는 결제 flow의 연속 화면입니다. design-bundle이 요구한 receipt, 수령 정보 info banner, 금액 복사 button, status secondary button, transfer page sticky CTA가 빠지면 사용자가 다음 행동을 놓치기 쉽습니다.
- Evidence from design-bundle/ or current implementation: current `CompletePage.jsx:83-112`는 account-card와 danger banner, 단일 sticky CTA만 있습니다. design-bundle `screens-customer.jsx:410-464`는 계좌 복사와 금액 복사, 주문내역 receipt, 수령 정보 info banner, 이체 CTA와 조리 현황 ghost CTA를 포함합니다. current `TransferPage.jsx:78-92`는 `TransferReportForm` 내부 버튼에 의존하고 page-level `.sticky-bar`가 없습니다. design-bundle `screens-customer.jsx:557-561`는 sticky submit bar를 별도로 둡니다.
- Suggested fix: C-4/C-5 화면별 누락된 receipt/info/sticky action을 design-bundle 구조에 맞춰 복원하세요.

#### Finding 8

- Severity: P2
- File path: `src/styles/components.css`
- Problem: `docs/design-bundle/app.css`가 완전 이식되지 않았고, 일부 source-of-truth 스타일이 삭제되거나 약화되었습니다.
- Why it matters: CSS가 "대부분 복사" 상태에서 원본과 달라지면 어떤 차이가 의도인지 알기 어렵습니다. 특히 아직 JSX가 사용하지 않는 디자인 class까지 누락되면 다음 화면 구현 때 source-of-truth와 다시 벌어집니다.
- Evidence from design-bundle/ or current implementation: `docs/design-bundle/app.css`는 2131 lines, current `src/styles/components.css`는 2066 lines입니다. no-index diff에서 design-bundle `app.css:1937-2024`의 `.log-feed`, `.log-row`, `.log-time`, `.log-icon` 등 A-7 audit log styles가 current CSS에 없습니다. scrollbar hover/active/Firefox styles도 축소되었습니다.
- Suggested fix: source CSS에서 제거한 부분을 의도적으로 추적하세요. design-bundle에 존재하는 semantic class를 삭제하지 말고, 실제 미사용이면 구현 범위/phase를 보고서나 코드 주석으로 분리해야 합니다.

#### Finding 9

- Severity: P2
- File path: `src/pages/admin/MenuAdminPage.jsx`, `src/styles/components.css`
- Problem: A-5 admin menu screen은 active route인데 design-bundle의 `.admin-table` 7-column table 구조를 사용하지 않습니다.
- Why it matters: `components.css`에는 `.admin-table`, `.tbl-thumb`, `.price-cell`, `.pill-toggle`이 들어왔지만 실제 page는 card/list + Tailwind utility 구조입니다. 디자인 이식 완료처럼 보이지만 route UI는 여전히 이전 디자인입니다.
- Evidence from design-bundle/ or current implementation: current `MenuAdminPage.jsx:68-104`는 `ul`/`li` card list입니다. design-bundle `screens-admin.jsx:330-487`은 `.admin-table` 7-column grid, thumb, ammo chip, price-cell inline edit, pill-toggle를 요구합니다.
- Suggested fix: A-5 route markup을 design-bundle의 table class contract에 맞추거나, 해당 화면을 이번 migration 범위 밖으로 명확히 표시하세요.

#### Finding 10

- Severity: P2
- File path: `src/components/organisms/BoothMinimapModal.jsx`, `src/styles/components.css`
- Problem: modal interaction/accessibility가 부분적으로만 보강되어 있습니다.
- Why it matters: modal은 keyboard와 mobile scroll 처리가 중요합니다. 현재 Escape, initial focus, body overflow lock은 있으나 focus trap/inert가 없고 `.modal-backdrop`에 `overscroll-behavior: contain`도 없습니다.
- Evidence from design-bundle/ or current implementation: current `BoothMinimapModal.jsx:23-38`은 close button focus와 Escape listener만 설정합니다. `components.css:1074-1082`의 `.modal-backdrop`에는 `overscroll-behavior`가 없습니다. Web Interface Guidelines는 modal/drawer/sheet에서 `overscroll-behavior: contain`과 keyboard containment를 확인 대상으로 봅니다.
- Suggested fix: design-bundle visual을 유지하면서 modal focus containment와 overscroll containment를 추가 검증하세요.

### P3

#### Finding 11

- Severity: P3
- File path: `src/components/layouts/CustomerLayout.jsx`
- Problem: header brand copy가 design-bundle과 다릅니다.
- Why it matters: 작지만 first-viewport brand signal입니다.
- Evidence from design-bundle/ or current implementation: current `CustomerLayout.jsx:60`은 `🍗 치킨이닭`입니다. design-bundle `screens-customer.jsx:16`은 `오늘 저녁은 치킨이닭!`입니다.
- Suggested fix: 단일 header 책임 정리와 함께 design-bundle copy를 그대로 맞추세요.

#### Finding 12

- Severity: P3
- File path: `src/components/organisms/MenuCard.jsx`, `src/components/molecules/MascotState.jsx`, `src/components/organisms/BoothMinimapModal.jsx`
- Problem: `<img>`에 explicit `width`/`height`가 없습니다.
- Why it matters: layout shift와 이미지 로딩 중 카드 높이 흔들림 위험이 있습니다. design-bundle의 fixed visual ratio를 구현 코드에서도 안정화해야 합니다.
- Evidence from design-bundle/ or current implementation: current `MenuCard.jsx:75-80`, `MascotState.jsx:58-64`, `BoothMinimapModal.jsx:77`의 images는 `width`/`height` 속성이 없습니다. `.menu-illust` aspect-ratio는 도움이 되지만 actual image dimensions는 빠져 있습니다.
- Suggested fix: design-bundle 비율을 유지하는 명시적 dimensions 또는 CSS aspect constraints를 추가 검증하세요.

## 5. Design-Bundle Compliance Issues

- Layout: P1 findings의 중복 header가 가장 큽니다. design-bundle은 화면별 단일 header 구조인데 current customer route는 일부 화면에서 2개의 `app-header`가 됩니다.
- Spacing: 많은 화면이 design-bundle의 `.app-body`, `.section`, `.sticky-bar` 구조 대신 inline `style={{ height: 96 }}`, `padding`, `position: fixed`를 반복합니다. 결과적으로 spacing source가 CSS와 JSX에 분산됩니다.
- Colors: asset/card/menu colors는 대부분 token 기반으로 들어왔습니다. 다만 inline `style={{ color: 'var(--color-accent)' }}`가 여러 곳에 남아 색상 적용 위치가 흩어집니다.
- Typography: `index.html`에 Pretendard, JetBrains Mono, Black Ops One link가 추가된 점은 design-bundle과 맞습니다. 그러나 admin/menu/status 일부 UI는 기존 Tailwind typography를 그대로 써 design-bundle semantic typography와 섞입니다.
- Radius/shadow: `components.css`에 radius/shadow class가 다수 이식되었습니다. 하지만 admin menu route처럼 실제 JSX가 semantic class를 쓰지 않는 화면이 있습니다.
- Assets/images: `public/mascot/mascot.png`와 8개 `public/items/*.webp`는 design-bundle asset hash와 일치합니다. 이 부분은 PASS입니다.
- Icons/emoji: customer header map/cart emoji는 bundle과 가깝지만 header copy가 다릅니다. admin topnav의 business state icon/badge/logout affordance는 누락되었습니다.
- Motion: dogtag/motion CSS는 일부 보존되었습니다. 반면 admin login의 `.pin-row.shake`, `.pin-pad`는 CSS만 있고 actual login UI에서 사용되지 않습니다.
- Interactions: checkout table/coupon/receipt, status sticky/HOLD action, admin login keypad, admin nav tabs가 design-bundle과 다릅니다.

## 6. Functional Regression Risks

- Duplicate header risk: `CustomerLayout` 공통 header와 page header가 중첩되어 mobile route에서 navigation/copy가 중복됩니다. 기능 API를 깨지는 않지만 주요 customer flow의 first screen을 크게 망가뜨릴 수 있습니다.
- Checkout risk: table number가 자유 입력이라 design-bundle의 1~12 constrained selection보다 오류 입력 가능성이 큽니다. coupon checked state는 UI total에 반영되지 않아 서버 계산 결과와 사용자가 본 금액이 달라질 수 있습니다.
- Admin login risk: design-bundle의 4-digit PIN pad를 그대로 구현하면 현 backend 6-digit contract와 충돌합니다. 현재 구현은 기능은 보존하지만 design-bundle과 다릅니다.
- Admin navigation risk: topnav에 logout, business state badge, 내역/쿠폰 affordance가 빠져 design-bundle의 admin user flow와 다릅니다. 기존 `/admin/transfers` routing은 보존되어 있으나 source-of-truth 화면명과 매핑이 불명확합니다.
- Status risk: status page에서 design-bundle의 sticky status/HOLD action이 빠져 HOLD 상태에서 사용자가 재제출 CTA를 놓칠 수 있습니다.
- Build verification risk: build/e2e는 파일 쓰기 제한 때문에 실행하지 않았습니다. `npm test`는 통과했지만 production bundle 검증은 되지 않았습니다.

## 7. Accessibility and Responsive Issues

- Keyboard navigation: `CategoryTabs`는 `role="tablist"`/`role="tab"`을 쓰지만 arrow-key roving tabindex는 없습니다. 기본 button tab 이동은 가능하지만 tab widget semantics와 완전 일치하지 않습니다.
- Focus states: design CSS의 global `:focus-visible` 계열은 존재하지만, inline/fixed sticky elements와 modal focus trap은 추가 검증이 필요합니다.
- Semantic HTML: icon-only header links에는 aria-label이 있어 양호합니다. modal도 `role="dialog"`와 `aria-modal`은 있습니다.
- Modal: focus trap/inert가 없고 `overscroll-behavior: contain`도 없습니다. mobile modal scroll bleed 위험이 있습니다.
- Contrast: 자동 contrast 검증은 jsdom/axe 경고 때문에 완전 신뢰하기 어렵습니다. `npm test`는 통과했지만 axe가 pseudo-element computed style 미구현 경고를 냈습니다.
- Alt text: menu/mascot/modal image alt는 존재합니다.
- Responsive: duplicate header와 fixed sticky bars가 mobile viewport에서 가장 큰 위험입니다. admin board는 CSS에서 6/3/2 column media query를 추가했지만 design-bundle은 desktop admin 6-col 기준이므로 tablet/mobile fallback 의도는 별도 확인이 필요합니다.

## 8. Code Quality Issues

- `src/styles/components.css`가 2000+ lines의 monolithic CSS로 들어왔고, 원본 `docs/design-bundle/app.css`와 일부 차이가 있습니다. source-of-truth diff 추적이 어렵습니다.
- semantic CSS와 Tailwind utility, inline styles가 섞여 있습니다. 예: sticky bars, receipt inner styles, minimap header styles가 JSX inline style에 반복됩니다.
- 일부 CSS는 사용되지 않습니다. `.pin-*`, `.admin-table`, `.timeline`, `.biz-badge` 등은 CSS에 있지만 주요 active JSX가 사용하지 않거나 부분 사용만 합니다.
- 일부 design-bundle CSS는 삭제되었습니다. 특히 A-7 `.log-feed` 계열은 source에는 있으나 current CSS에는 없습니다.
- `AdminLayout.jsx:37`의 `new Date().toLocaleDateString(...)`와 `admin1`은 hardcoded display입니다. design-bundle의 날짜/시간/admin/logout right section을 재현하지 못하면서 유지보수성도 낮습니다.
- untracked `backups/*.zip`는 리뷰 대상 목록에는 포함했지만 binary backup artifact라 frontend implementation diff로 검토하지 않았습니다.

## 9. Recommended Fix Order

1. Customer route header 중복을 먼저 제거하세요. 이 문제가 mobile first viewport 전체를 흔듭니다.
2. Checkout C-3를 design-bundle 기준으로 맞추세요: table grid, coupon eligibility, receipt, discount total, sticky CTA.
3. Status C-6를 design-bundle 구조로 맞추세요: timeline class contract, DogTag, READY/DONE/HOLD copy, sticky status/action.
4. Admin login의 design-vs-backend PIN 길이 충돌을 결정하고, keypad visual을 source-of-truth에 맞추세요.
5. Admin topnav와 active admin routes를 design-bundle의 본부/메뉴/내역/정산/쿠폰 구조와 매핑하세요.
6. C-1 menu category/recommended layout과 C-4/C-5 완료/이체 화면 누락 요소를 맞추세요.
7. `components.css`를 design-bundle `app.css`와 다시 대조해 삭제된 source styles, unused styles, inline style 중복을 정리하세요.
8. 접근성/반응형 검증을 실제 browser에서 수행하세요. 특히 modal focus, mobile sticky overlap, image layout shift를 확인해야 합니다.

## 10. Commands Run

- `Get-Content -Raw C:\ACoding\09_order\.agents\skills\web-design-guidelines\SKILL.md`
  - 결과: UI/accessibility review skill 지침 확인.
- Web fetch: `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
  - 결과: icon labels, form labels/autocomplete, focus states, modal overscroll, image dimensions 등 review criteria 확인.
- `git status --short`
  - 결과: 처음에는 dubious ownership으로 실패.
- `git -c safe.directory=C:/ACoding/09_order status --short`
  - 결과: unstaged 23 modified files, untracked backup/docs/assets 확인.
- `git -c safe.directory=C:/ACoding/09_order diff --name-status`
  - 결과: 23 modified files 확인.
- `git -c safe.directory=C:/ACoding/09_order diff --cached --name-status`
  - 결과: staged 변경 없음.
- `git -c safe.directory=C:/ACoding/09_order ls-files --others --exclude-standard`
  - 결과: untracked backup zip, audit doc, public assets 확인. Git ignore permission warning이 출력됨.
- `Test-Path design-bundle`
  - 결과: `False`.
- `rg --files`
  - 결과: `docs/design-bundle/` 존재 확인.
- `Get-ChildItem -Path docs\design-bundle -Recurse -File`
  - 결과: bundle CSS/JSX/data/assets/upload docs 확인.
- `Get-FileHash docs\design-bundle\assets\... public\...`
  - 결과: mascot 및 8개 item webp의 source/public hash 일치.
- `Get-FileHash docs\design-bundle\app.css,src\styles\components.css,docs\design-bundle\tokens.css,src\styles\tokens.css`
  - 결과: `components.css`와 `app.css` hash 불일치, `tokens.css`도 prototype shell 제거로 hash 불일치.
- `git diff --no-index --unified=2 -- docs/design-bundle/app.css src/styles/components.css`
  - 결과: CSS diff 확인. A-7 log-feed styles 삭제와 scrollbar styles 축소 확인.
- `git -c safe.directory=C:/ACoding/09_order diff --stat`
  - 결과: 23 files changed, 2752 insertions, 1110 deletions.
- `npm test`
  - 결과: exit 0. Vitest 통과. jsdom/axe `getComputedStyle` 경고와 React Router v7 future flag 경고 출력.
- `git -c safe.directory=C:/ACoding/09_order status --short`
  - 결과: `npm test` 후 추가 변경 파일 없음.

## 11. Notes

- 루트 `design-bundle/`는 없었습니다. 이 리뷰는 저장소에 실제 존재하는 `docs/design-bundle/`를 기준으로 수행했습니다.
- `docs/DESIGN_BUNDLE_AUDIT.md`는 존재하지만 출력 인코딩이 깨졌고, 사용자 지시대로 보조 문서로만 취급했습니다. 실제 근거는 `docs/design-bundle/` 파일을 우선했습니다.
- visual browser screenshot 비교는 수행하지 않았습니다. 구현 파일 수정 금지와 산출물 제한 때문에 dev server/build/e2e도 실행하지 않았습니다.
- untracked backup zip은 binary artifact라 내부 압축 내용은 열지 않았습니다. frontend implementation 검토는 현재 working tree 파일과 `docs/design-bundle/` 원본 중심으로 수행했습니다.
- `npm test`는 통과했지만, 디자인 정합성을 보장하는 테스트는 아닙니다. 현재 주요 이슈는 tests 통과 여부보다 source-of-truth 화면 구조와의 불일치입니다.
