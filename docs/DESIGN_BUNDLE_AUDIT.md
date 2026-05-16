# DESIGN_BUNDLE_AUDIT.md

**작성일:** 2026-05-15
**대상:** `docs/design-bundle/` (시안 SoT) ↔ 현재 `src/` (React 18 구현)
**작성 목적:** 이 문서는 *분석 보조 문서*다. 코드 수정 X. 리스킨 작업의 청사진 역할.

---

## 1. 목적

- 현재 구현된 프론트엔드 UI/UX가 `docs/design-bundle/`의 시안과 크게 다르다.
- `docs/design-bundle/` 폴더가 **디자인 source of truth**임을 명확히 한다.
- 이 문서는 SoT 자체가 아닌 **보조 분석 문서**다. 구현 시 항상 원본 파일을 우선 참조하고, 이 문서는 매핑·갭 요약·작업 순서를 빠르게 조회하기 위한 색인으로 사용한다.
- 이 문서를 읽고 나면: ① 어떤 원본 파일이 어떤 화면에 대응되는지, ② 어떤 자산을 어디서 가져와야 하는지, ③ 어떤 파일을 어떻게 손봐야 시안과 일치시키는지를 알 수 있다.

---

## 2. 기준 우선순위

리스킨 작업 중 모든 의사결정은 다음 우선순위를 따른다.

1. **`docs/design-bundle/` 원본 파일** (HTML / JSX / CSS / 이미지) — 절대 기준.
2. **`docs/DESIGN_BUNDLE_AUDIT.md`** (본 문서) — 보조 색인 / 매핑표 / 작업 순서.
3. **현재 구현 코드의 *기능 로직*** (라우팅, API 호출, Zustand store, 폴링·SSE, 422/423 가드, ADR-019 학번 정규식, ADR-020 Pattern B, ADR-021 외부인, ADR-025 상태 전이 등) — 디자인과 별개로 유지.
4. **현재 구현 코드의 *디자인***(Tailwind 클래스 조합 결과물) — **신뢰하지 않음**. 시안과 어긋날 가능성이 큼.

> **금지:** design-bundle에 *없는* 색·이모티콘·아이콘·spacing·shadow·radius·animation을 임의로 추가 / 창작 / "개선"하는 것.

---

## 3. `docs/design-bundle/` 파일 구조

```text
docs/design-bundle/
├── 치킨이닭 프로토타입.html        # 진입점 — React 18 UMD + Babel standalone
├── tokens.css                       # 모든 시각 토큰 (color/font/space/radius/shadow/motion)
├── app.css                          # 2,133 줄 — semantic class 전부 (.btn, .menu-card, .dogtag, ...)
├── data.js                          # MENUS 8건 + CATEGORIES + MOCK_ADMIN_ORDERS + STATE_LABEL + STAGE_COPY
├── tweaks-panel.jsx                 # (시연용) 우하단 Tweaks 패널 — 화면 점프·상태 강제 천이
├── components.jsx                   # Atoms/Molecules (Button, StatusChip, Stamp, DogTag, Mascot,
│                                    #                  Timeline, EmptyState/LoadingState/ErrorState,
│                                    #                  BannerTop, PhoneChrome)
├── screens-customer.jsx             # C-1~C-9 사용자 화면 9종
├── screens-admin.jsx                # A-1(로그인)·A-2(대시보드)·A-5(메뉴)·A-6(정산)·A-7(내역)·A-8(쿠폰)
├── app.jsx                          # 라우터(useState) + 모바일 프레임 + 데스크톱 프레임 + Tweaks
├── assets/
│   ├── mascot.png                   # 2,444 KB — 헤더 로고 + 마스코트 + 로그인 마크 공통
│   └── items/                       # 8 × .webp (메뉴 일러스트)
│       ├── bandage.webp             # m1 후라이드 — "회복량 +10"
│       ├── first-aid.webp           # m2 양념 — "회복량 +75"
│       ├── med-kit.webp             # m3 뿌링클 — "회복량 +100"
│       ├── syringe.webp             # m4 감자튀김 — "부활"
│       ├── defib.webp               # m5 뿌링감자튀김 — "소생"
│       ├── adrenaline.webp          # m6 칠리스 — "부스트 +100%"
│       ├── painkiller.webp          # m7 콜라 — "부스트 +60%"
│       └── energy.webp              # m8 사이다 — "부스트 +40%"
└── uploads/                         # 시안 작성 시 참조한 기획 산출물 (PRD/DESIGN/USER_FLOW 등) + 원본 자산
```

자산 합계: 약 **2,519 KB** (mascot 2,445 KB + items 74 KB). public/ 으로 그대로 옮길 수 있다.

---

## 4. 화면별 원본 디자인 분석

> 사용자 화면 9 + 관리자 화면 6 = 총 15 화면. 각 화면은 `screens-customer.jsx` 또는 `screens-admin.jsx` 내 함수 컴포넌트로 구현되어 있고, 스타일은 `app.css`의 semantic class 로 매칭된다.

### 4.1 C-1 메뉴 (`ScreenMenu`, `screens-customer.jsx:32-132`)

- **목적:** 사용자 메인. 메뉴 8종 그리드 + 분류 탭 + 추천 BEST 보급품 박스 + 하단 sticky 카트.
- **주요 UI 섹션:**
  - `CustomerHeader` — `.app-header.camo-gradient` (브랜드 마크 28px + "오늘 저녁은 치킨이닭!" + stencil 서브네임 `WINNER · WINNER · CHICKEN · DINNER` + 🗺️ + 🎒 with count-badge)
  - `.cat-tabs` — 가로 스크롤 chip ("전체·추천·치킨·사이드·음료"), active 시 형광 옐로 배경
  - `.best-banner` — PUBG 보급품 박스 메타포 (camo 텍스처 + 좌 4px 옐로 보더 + 노란 stencil "WINNER WINNER / CHICKEN DINNER" 우측 텍스트)
  - `.menu-grid` 2-col `.menu-card` — `.menu-illust` (aspect-ratio 4/3, repeating-linear 45° 텍스처 + radial-gradient + `<img class="menu-img">`) + `.ammo-tag` (우하단 mono 코드 "BANDAGE" 등) + `.menu-name` + `.menu-sub` (회복량 +N) + `.menu-price` + `.pick-btn` (검정 배경 + 옐로 글자, "+ 줍기" / "✓ 인벤토리 N" / "SOLD OUT")
  - `.sticky-bar` — totalQty>0 시만 "🎒 인벤토리 N개 · 금액원 보기 →"
- **자산:** mascot.png(브랜드 마크), 8×webp(메뉴 일러스트)
- **인터랙션:** 분류 탭 클릭 → 로컬 filter. 카드 자체 onClick X — pick-btn만 이벤트. soldOut 시 grayscale + 도장.
- **반응형:** 390×780 모바일 프레임 가정. `.menu-grid` 2-col 고정.

### 4.2 C-2 카트(인벤토리) (`ScreenCart`, `screens-customer.jsx:135-208`)

- **목적:** 줍기 결과 확인 + 수량 조정 + 영수증 미리보기 + 주문 정보 입력으로 진입.
- **주요 UI 섹션:**
  - `.back-bar` — `← 🎒 인벤토리  N ITEMS` (mono meta 우측)
  - `.cart-list` → `.cart-line` (grid `56px 1fr auto`): `.thumb`(card-bg + webp img) + `.name` / `.name-sub`(tag · sub) / `.qty`(− N +) + `.remove`(×) + price
  - `.receipt` — `.line` 반복 + `.line.total` (dashed border-top, 합계 형광 옐로)
  - `.sticky-bar` "주문하기 · 금액원"
- **자산:** 메뉴 webp 썸네일.
- **인터랙션:** −/+ 수량 변경, qty=0 시 자동 제거, × 즉시 삭제.

### 4.3 C-3 주문 정보 (`ScreenCheckout`, `screens-customer.jsx:211-381`)

- **목적:** 외부인 분기·학번·이름·수령·테이블·쿠폰 입력 후 주문 접수.
- **주요 UI 섹션 (3 section):**
  - **① 신원 확인** — `.checkbox-row.emphatic` 외부인 토글 → `.field` 학번 input (mono, 9자리, 외부인 시 disabled) + 이름 input
  - **② 수령 방법** — `.radio-group` 2-col 매장식사/포장. 매장식사 시 6-col grid 테이블 번호 1~12 (`.radio-cell` `padding:10px 0`)
  - **③ 쿠폰** — `.checkbox-row` (외부인 시 미렌더, 학번 정규식 매칭 시 활성)
  - `.receipt` — 카트 라인 + 쿠폰 할인(`-1,000원`, success 색) + 합계 형광 옐로
  - `.sticky-bar` "📋 주문 접수 · 금액원" (loading 시 spinner)
- **에러 표시:** `.field .err` (warning 배경 10%, 좌측 3px warning 보더)
- **인터랙션:** 학번 = `/^\d{2}\d{2}37\d{3}$/` (ADR-019), 외부인 체크 시 쿠폰 자동 off.

### 4.4 C-4 주문 완료 (도그태그) (`ScreenComplete`, `screens-customer.jsx:384-467`)

- **목적:** 절정 화면. 주문 번호 도그태그 + 입금 안내 + 다음 액션 CTA.
- **주요 UI 섹션:**
  - `.app-header.camo-gradient` (brand-mark + "주문 접수 완료" + `ORDER · ISSUED` stencil)
  - `.dogtag-stage` → `<DogTag dropping pulse>` (240×, accent 배경, mono 56px `#N`, stencil `ORDER NO`, 상단 ::before 14px 구멍, drop+pulse 600ms+1s 단발 모션)
  - `.winner-copy` — stencil 28px 옐로 "WINNER WINNER / CHICKEN DINNER!" + small 13px display ink
  - `.account-card` — `.acc-label`(stencil 옐로) + `.acc-bank`(muted 14) + `.acc-no`(mono 22px ink user-select:all) + `.acc-amount`(mono 28px 옐로 dashed border-top) + 2개 secondary 버튼
  - `.receipt` (주문 내역 미니)
  - `.warn-banner.info` 매장식사 테이블/포장 안내
  - `.warn-banner.danger` "이체 후 확인 요청 버튼을 꼭" (강조)
  - `.sticky-bar` (flex-column 2버튼: primary "💸 이체했어요…" + ghost "🍗 조리 현황 보기")
- **모션:** dogtag drop 1회 (sessionStorage `dogtag-shown-{id}` 키로 멱등), pulse 1회.

### 4.5 C-5 이체 확인 요청 (`ScreenTransfer`, `screens-customer.jsx:470-564`)

- **목적:** 이체 신고 폼. 본부가 통장과 대조 → PAID 진행.
- **주요 UI 섹션:**
  - `.back-bar` "💸 이체 확인 요청 · #N"
  - **결제 정보 확인 section** — `.receipt` 변형 (주문번호 옐로 #N, 주문자, 결제 금액 옐로)
  - **이체하신 은행 section** — `.select` 7옵션 (카카오뱅크/국민/신한/우리/농협/토스/기타) + `.checkbox-row` "다른 이름으로 이체" → 조건부 input
  - `.warn-banner.info` "이름·은행·금액·시각 4가지" 안내
  - `.sticky-bar` "확인 요청 보내기" (loading 시 spinner)

### 4.6 C-6 조리 현황 (`ScreenStatus`, `screens-customer.jsx:567-646`)

- **목적:** SSE/폴링 실시간 상태판. 마지막 단계 READY 절정.
- **주요 UI 섹션:**
  - `.app-header.camo-gradient` ("🍗 조리 현황" + `ORDER #N · LIVE` stencil + 🗺️)
  - `BannerTop` (SSE 끊김 시 `rgba(199,62,29,0.18)` 빨간 상단 띠 + 재시도 링크)
  - `Timeline` — 5-step `<div class="timeline">` (접수·입금·확인·조리·수령) — `::before` 3px divider track + `.tl-fill` 옐로 채워짐 + `.timeline-dot` 24px(done=옐로, current=옐로+box-shadow pulse)
  - `Mascot` size="md" (cooking 시 idle 흔들 모션, ready/done 시 arrived)
  - 분기:
    - `READY`: `.ready-banner` (accent 배경, 3px 검정 보더, stencil 26px "✅ #N번 / 수령 가능해요!", flash 모션 1초 ×2)
    - 그 외: `.stage-copy` (display 20px big + muted 13px sub, `STAGE_COPY` 카피 사용)
  - DogTag size="sm" (READY 시 pulse)
  - `HOLD` 시 `.warn-banner.danger` + sticky 재제출 버튼
  - `.sticky-bar` 상단 우측 `StatusChip status={order.status}` 표시

### 4.7 C-7 부스 미니맵 모달 (`MinimapModal`, `screens-customer.jsx:649-687`)

- **목적:** 우상단 🗺️ 또는 ?order_id 진입. 본인 테이블 형광 옐로 펄스.
- **주요 UI 섹션:**
  - `.modal-backdrop` 풀스크린(0.75 black) + 200ms fade-in
  - `.modal-head` (배너 `🗺️ 부스 미니맵` stencil + ✕ icon-btn)
  - `.minimap` — repeating-linear 45° 옐로 텍스처 + elevated 배경 + mono `BOOTH · A-12` / `NORTH ↑`
  - `.grid` 4-col `.table` (mono 13px "T1"~"T12") + `.table.mine` (옐로 배경, box-shadow 3px 옐로, scale 1.08 펄스 1.2s)
  - `.entrance` (dashed 2px border, mono `🚪 ENTRANCE`)
  - `.minimap-legend` (mono 옐로 16px `#N` 또는 `— (포장)`)
  - `.modal-foot` primary "닫기"

### 4.8 C-8 풀스크린 오류 (404/500) (`ScreenError`, `screens-customer.jsx:723-747`)

- `.back-bar "오류"`
- `.error-state` — stencil 64px danger 코드 + Mascot md + display 18px h3 + muted 14px p + primary "홈으로"

### 4.9 C-9 영업 외 안내 (`ScreenClosed`, `screens-customer.jsx:690-720`)

- `.app-header.camo-gradient` (subname `CLOSED`)
- `.closed-screen` — 🔒 48px + display 22px "영업 시간이 아니에요" + Mascot + `.schedule` (stencil 옐로 label + mono 13px item: "5/20 (수) 16:30 오픈" 2줄) + secondary "🔄 새로고침"

### 4.10 A-1 관리자 로그인 (`AdminLogin`, `screens-admin.jsx:138-196`)

- `.login-shell` 카키 + 45° 옐로 텍스처 → `.login-box` 320px (surface, lg radius)
- `.login-mark` — mascot.png 48×48 rounded
- 4-cell `.pin-row` (36×44 mono 20px 옐로, filled=옐로 8% bg) — 오답 시 `.shake` 350ms
- `.pin-pad` 3×4 grid 48px keys (elevated, 옐로 hover, scale 0.95 active)
- 시연 hint `code` 옐로 8% bg `7842`

### 4.11 A-2 본부 대시보드 (`AdminDashboardBody`, `screens-admin.jsx:199-268`)

- `.admin-topnav` (h:48, surface, stencil 옐로 14px logo + 5 nav-link tabs + 우측 `.biz-badge.open/closed` + 시간/admin1/로그아웃)
- CLOSED: `.start-cta.urgent` — *yellow blink* 1.6s 무한 (`cta-pulse`) + 좌우 4px 옐로/검정 dashed-line + stencil 22px "🚀 장사 시작" + lg primary 56px stencil "장사 시작 →"
- OPEN: `.open-status` — success 12% bg + 좌 3px success 보더 + 펄스 점 + "영업 중 · HH:MM 시작 · 사용자 주문 가능"
- `.admin-board` — **6-col Kanban grid** (`grid-template-columns: repeat(6, minmax(0, 1fr))`)
  - 6 컬럼: `ORDERED · TRANSFER_REPORTED · PAID · COOKING · READY · HOLD`
  - `.col-head` (elevated, badge count) — `.warn`/`.danger` 변형 (5분/10분 overdue)
  - `.order-card` — 8×10 padding 6px radius, mono 14px 옐로 `#N`, ago `1분 전`, 외부인 칩, 액션 버튼 (변경 단계별: 취소·확인/보류·조리시작·조리완료·전달완료·재확인/취소)
- `.admin-toast` — bottom center success pill "✓ #N → 상태"

### 4.12 A-5 메뉴 관리 (`AdminMenus`, `screens-admin.jsx:330-487`)

- `.admin-page` + `.admin-page-head` ("메뉴 관리" display 20px + 우측 `.admin-tab` 분류 pill)
- `.admin-info-bar` — 안내 "가격 클릭 → 편집" + 즉시 반영 메시지
- `.admin-table` — 7-col grid (`2fr 1.1fr 1.2fr 0.7fr 1.5fr 0.9fr 0.9fr`)
  - 헤더 행: elevated bg, 11px stencil muted
  - 데이터 행: `.tbl-thumb`(40×40 card-bg + webp) + `.tbl-name`/`.tbl-id`(mono 10px) + `.ammo` 코드 + sub + cat + `.price-cell`(− mono price +, 클릭 시 input 편집, 저장 ✓ pop) + `.pill-toggle`(품절·추천)

### 4.13 A-6 정산 (`AdminSettlement`, `screens-admin.jsx:638-746`)

- `.admin-page-head` + 일자 select
- `.admin-info-bar.warn`/`.ok` (진행 중 0건일 때만 마감 가능 — ADR-012)
- `.settle-grid` 2-col:
  - 정산 요약 `.settle-card` — `.settle-line` 반복 + `.strong` 합계 형광 옐로 18px + 통장 입금 합계 수동 입력 → 차이 색 분기 (=0:success / <1000:warning / >=1000:danger)
  - ZIP 백업 `.settle-card` — "마지막 자동 백업 · 17:30" + primary block "📥 수동 백업" + 자동 백업 3건 mono 목록
  - 메뉴별 판매 `.settle-card.wide` — `.bar-row` (200px name + 1fr `.bar-track`/`.bar-fill` + 160px mono meta)

### 4.14 A-7 주문 내역(감사 로그) (`AdminHistory`, `screens-admin.jsx:489-578`)

- `.admin-info-bar` + 검색 input + CSV 내보내기
- 필터 tab(전체·주문·메뉴·시스템) + count 표시
- `.log-feed` — `.log-row` grid `80px 32px 1fr 80px`:
  - mono 시각 + `.log-icon`(28×28 round-md, action 색 보더+이모지) + `.log-action`(display 800 13px) + `.log-order`(옐로 chip `#N`) + `.log-amount` + `.log-menu` + `.log-transition`(`code → code`) + `.log-actor`(elevated chip)
- 액션 색맵 `LOG_META`: CREATED·TRANSFER_REPORTED·PAID·COOKING·READY·DONE·HOLD·CANCELED·PRICE_CHANGED·SOLDOUT_ON 등 18종

### 4.15 A-8 쿠폰 사용 내역 (`AdminCoupons`, `screens-admin.jsx:749-783`)

- 사용 23명 · 총 할인 23,000원 · 거부 시도 16건 통계
- `.settle-card.wide` 4-col 표 (학번 mono · 이름 · 시각 mono · 주문 옐로)
- 시안에 "P1 — Phase 2 구현" 명시 → 실 구현 우선순위 낮음.

---

## 5. 현재 프로젝트 화면/컴포넌트 구조

### 5.1 라우팅 (`src/App.jsx`)

```
BrowserRouter
├── ErrorBoundary
└── Suspense
    ├── <CustomerLayout/>     (헤더 🍗 치킨이닭 + 🗺️ 지도, 423/CLOSED 가드)
    │   ├── /         → Navigate /menu
    │   ├── /menu     → MenuPage
    │   ├── /cart     → CartPage
    │   ├── /checkout → CheckoutPage
    │   ├── /orders/:id/complete → CompletePage
    │   ├── /orders/:id/transfer → TransferPage
    │   ├── /orders/:id/status   → StatusPage
    │   ├── /map      → MapPage
    │   └── /closed   → ClosedPage
    ├── <AdminLayout/>        (React.lazy 코드 스플릿)
    │   ├── /admin/login      → AdminLoginPage
    │   ├── /admin/dashboard  → AdminDashboardPage
    │   ├── /admin/orders/:id → AdminOrderDetailPage
    │   ├── /admin/transfers  → AdminTransfersPage
    │   ├── /admin/menus      → AdminMenuPage
    │   └── /admin/settlement → AdminSettlementPage
    └── *  → ErrorPage(404)
```

### 5.2 컴포넌트 트리

```
src/
├── App.jsx
├── main.jsx
├── styles/
│   ├── tokens.css            ✅ design-bundle/tokens.css 와 동일
│   ├── globals.css           Tailwind base/components/utilities + reset + reduced-motion
│   └── components.css        ★ 114 줄 — keyframe 6종만 (dogtag-drop/pulse, mascot-fade/cooking-idle, business-badge-blink, start-cta-press, booth-table-pulse)
├── components/
│   ├── ErrorBoundary.jsx
│   ├── layouts/
│   │   ├── CustomerLayout.jsx  ← 헤더는 `🍗 치킨이닭` + 🗺️ 만 (design-bundle 의 brand-mark 이미지·stencil subname·🎒 count-badge 없음)
│   │   └── AdminLayout.jsx
│   ├── atoms/                  Button / Input / Label / Select / Checkbox / Radio / Icon / Spinner / Divider
│   ├── molecules/              StampBadge / PriceTag / StatusChip / CountBadge / IconLabel / MenuFallback / DogTagFrame / MascotState
│   ├── organisms/              MenuCard / CartItem / OrderTimeline / TransferReportForm / BusinessStateBadge /
│   │                           StartBusinessCTA / ClosedScreen / BoothMinimapModal / CategoryTabs / MenuList /
│   │                           StickyCartBar / RecommendedBanner / DeliveryTypeSelector / AdminCardColumn /
│   │                           KeyboardHelpModal
│   └── state/                  EmptyState / LoadingState / ErrorState
├── pages/customer/             MenuPage · CartPage · CheckoutPage · CompletePage · TransferPage · StatusPage · MapPage · ClosedPage · ErrorPage
├── pages/admin/                LoginPage · DashboardPage · OrderDetailPage · TransfersPage · MenuAdminPage · SettlementPage
├── store/                      cart.js · ui.js · businessState.js (Zustand)
├── hooks/                      useApi · useOrderStream · useOrderPolling · useOrderToken · useMenuData · useGlobalErrorHandler
├── api/                        client.js · routes.js · schemas.js (zod)
├── constants/                  menus.js · admin-columns.js
└── public/
    ├── items/.gitkeep          ★ 비어 있음 — webp 8종 미배치
    ├── mascot/.gitkeep         ★ 비어 있음 — mascot.png 미배치
    └── map/.gitkeep            ★ 비어 있음
```

### 5.3 스타일링 전략 비교

| 항목 | design-bundle | 현재 |
|---|---|---|
| 토큰 | `tokens.css` :root vars | `src/styles/tokens.css` :root vars **(동일)** |
| Tailwind | X (CDN React UMD) | ✅ `tailwind.config.js` 에 tokens 1:1 매핑 (color/font/space/radius/shadow/duration) |
| 컴포넌트 스타일 | `app.css` 2,133 줄 semantic class (`.app-header`, `.menu-card`, `.pick-btn`, `.dogtag`, `.account-card`, `.warn-banner`, `.timeline`, `.ready-banner`, `.modal-backdrop`, `.minimap`, `.admin-board`, `.col`, `.order-card`, `.start-cta.urgent`, `.login-shell`, `.pin-pad`, `.admin-table`, `.settle-grid`, `.log-feed`, ...) | Tailwind 유틸 (`flex flex-col gap-md p-md bg-elevated rounded-md`) — *시안의 풍부한 디테일이 거의 누락*. `src/styles/components.css` 는 keyframe 만. |
| 일러스트 | `.menu-illust` 안에 `<img src="assets/items/{name}.webp">` + `.ammo-tag` 코드 | `MenuFallback` 이모지 fallback 만 사용 (자산 미배치) |
| 모션 | `app.css` 안에 keyframe + `tag-drop`/`tag-pulse`/`mascot-cooking-idle`/`table-pulse`/`cta-pulse`/`ready-flash`/`shake`/`saved-pop`/`toast-in`/`fade-in`/`spin`/`open-pulse`/`dot-pulse` 13종 | `components.css` 에 6종만 (`dogtag-drop`, `dogtag-pulse`, `mascot-fade`, `mascot-cooking-idle`, `business-badge-blink`, `start-business-cta-press`, `booth-table-pulse`) — 7종 누락 또는 변형 |
| 폰트 | `Pretendard Variable` + `JetBrains Mono` + `Black Ops One` (Google Fonts/jsdelivr CDN) | `index.html` 확인 필요 (`tokens.css` 에 동일 family 선언 — 실제 로드 여부 별도 확인) |

---

## 6. design-bundle 원본 ↔ 현재 구현 매핑표

> "수정 필요"는 **디자인 정합성** 기준 (기능 로직은 별개). ✅=정합 / ◐=부분 정합 / ❌=재작업 필요.

### 6.1 시각 토큰·스타일 자산

| design-bundle 원본 | 현재 프로젝트 파일 | 대응 화면/컴포넌트 | 수정 필요 여부 | 비고 |
|---|---|---|---|---|
| `tokens.css` | `src/styles/tokens.css` | 전체 — CSS 변수 | ✅ | 완전 동일. 변경 X. |
| `app.css` (2,133줄) | `src/styles/components.css` (114줄) + Tailwind 유틸 | 전체 — semantic class | ❌ | **갭 1,900+ 줄**. 대다수 컴포넌트 디테일 누락 — 본 작업의 핵심. |
| `assets/mascot.png` | `public/mascot/.gitkeep` | 헤더 brand-mark · Mascot · 로그인 mark · CTA mascot | ❌ | 파일 복사 필요. |
| `assets/items/*.webp` × 8 | `public/items/.gitkeep` | MenuCard 일러스트 · CartItem thumb · 정산 메뉴별 판매 bar-row · 메뉴 관리 tbl-thumb | ❌ | 파일 복사 + MenuCard 등 img src 연결. |
| 폰트(Pretendard / JetBrains Mono / Black Ops One) | `index.html` 또는 별도 CDN | 본문 / 도그태그 mono / stencil 카피 | (검증 필요) | `index.html` 에 link 태그 누락 시 추가. |

### 6.2 사용자 화면 매핑

| design-bundle 원본 | 현재 프로젝트 파일 | 대응 화면/컴포넌트 | 수정 필요 여부 | 비고 |
|---|---|---|---|---|
| `screens-customer.jsx` `CustomerHeader` (`:9-29`) | `src/components/layouts/CustomerLayout.jsx` | 사이트 헤더 | ❌ | brand-mark(28px mascot) · 두 줄 브랜드(메인+stencil 서브) · 🎒 카트 카운트 배지 모두 누락. 현재는 `🍗 치킨이닭` + 🗺️ 만. |
| `ScreenMenu` (`:32-132`) | `src/pages/customer/MenuPage.jsx` + 하위 organisms | C-1 메뉴 | ❌ | `.best-banner`(보급품 박스 메타포) 누락, `.cat-tabs` 디자인 다름, `.menu-card.menu-illust`(4:3 텍스처) + `.ammo-tag` + `.pick-btn`(검정+옐로) 누락. |
| `ScreenCart` (`:135-208`) | `src/pages/customer/CartPage.jsx` | C-2 카트 | ❌ | `.back-bar` 아이콘 변경, `.cart-line` 그리드(thumb+name+name-sub+qty+remove+price) 누락, `.receipt` 박스 누락. |
| `ScreenCheckout` (`:211-381`) | `src/pages/customer/CheckoutPage.jsx` | C-3 주문 정보 | ❌ | `.section-label`(stencil 옐로) · `.checkbox-row.emphatic` · 6-col 테이블 grid · 마지막 receipt 미리보기 · sticky `📋 주문 접수` 모두 누락. |
| `ScreenComplete` (`:384-467`) | `src/pages/customer/CompletePage.jsx` | C-4 완료(절정) | ❌ | `.dogtag-stage` · `.winner-copy` · `.account-card`(stencil label + mono 22/28px) · `.warn-banner.info/danger` · 2-button sticky 모두 갭. 현재는 단순 div + Button. |
| `ScreenTransfer` (`:470-564`) | `src/pages/customer/TransferPage.jsx` | C-5 이체 신고 | ❌ | `.back-bar #N` meta · 결제 정보 section · 은행 select + `.checkbox-row` 다른이름 + `.warn-banner.info` 4-tuple 안내 필요. |
| `ScreenStatus` (`:567-646`) | `src/pages/customer/StatusPage.jsx` | C-6 조리 현황 | ❌ | `.app-header.camo-gradient` · `BannerTop`(빨간 SSE 끊김 띠) · `.timeline` 5-step + `.tl-fill` · Mascot 상태 분기 · `.ready-banner`(절정) · `.stage-copy` · sticky `StatusChip` 누락. |
| `MinimapModal` (`:649-687`) | `src/pages/customer/MapPage.jsx` + `BoothMinimapModal` | C-7 미니맵 | ◐ | organism 존재. 다만 `.modal-backdrop` 풀스크린 fade-in · `.minimap` 45° 옐로 텍스처 · `BOOTH · A-12` mono 헤더 · `.entrance` dashed border · legend 디테일 확인·정합 필요. |
| `ScreenClosed` (`:690-720`) | `src/pages/customer/ClosedPage.jsx` + `ClosedScreen` organism | C-9 영업 외 | ◐ | `.closed-screen` + `.schedule`(stencil 옐로 label + mono 13px 2 items) 디테일 정합 필요. |
| `ScreenError` (`:723-747`) | `src/pages/customer/ErrorPage.jsx` | C-8 404/500 | ❌ | stencil 64px danger code + Mascot md + display 18px h3 누락 가능. |

### 6.3 관리자 화면 매핑

| design-bundle 원본 | 현재 프로젝트 파일 | 대응 화면/컴포넌트 | 수정 필요 여부 | 비고 |
|---|---|---|---|---|
| `screens-admin.jsx` `AdminLogin` (`:138-196`) | `src/pages/admin/LoginPage.jsx` | A-1 PIN 로그인 | ❌ | `.login-shell`(45° 옐로 텍스처) · `.login-box` 320px · 4-cell `.pin-row`(filled/error/shake) · `.pin-pad` 3×4 grid · 시연 hint code 누락. |
| `AdminApp.admin-topnav` (`:48-76`) | `src/components/layouts/AdminLayout.jsx` | 어드민 공통 nav | ❌ | stencil 옐로 logo · `.biz-badge.open/closed` chip · admin1·시간 mono · 5 nav-link tab(`.nav-link.active`) 누락 가능. |
| `AdminDashboardBody` (`:199-268`) | `src/pages/admin/DashboardPage.jsx` + `AdminCardColumn` | A-2 본부 대시보드 | ❌ | **CLOSED 시 `.start-cta.urgent`(노란 펄스 + 좌우 dashed-line + stencil 56px 버튼)** · **OPEN 시 6-col Kanban** · `.col-head.warn/.danger` overdue · `.order-card.actions` 단계별 버튼 · `.admin-toast` 액션 피드백 — 모두 핵심. 현재는 grid-cols-2/3 단순. |
| `AdminMenus` (`:330-487`) | `src/pages/admin/MenuAdminPage.jsx` | A-5 메뉴 관리 | ❌ | `.admin-table` 7-col grid · `.tbl-thumb` webp · `.ammo` chip · `.price-cell`(-/+/inline edit + ✓pop) · `.pill-toggle` 디자인 갭. |
| `AdminSettlement` (`:638-746`) | `src/pages/admin/SettlementPage.jsx` | A-6 정산 | ❌ | `.admin-info-bar.warn/.ok` 마감 가드 · `.settle-grid` 2-col 카드 + `.settle-card.wide` 메뉴별 bar-row · 통장 차이 색분기 누락. |
| `AdminHistory` (`:489-578`) | (현재 미구현 — 가까운 화면: `AdminTransfersPage.jsx`, `OrderDetailPage.jsx`) | A-7 감사 로그 | ❌ | 현재 별도 페이지 없음. 신규 구성 또는 매핑 결정 필요. |
| `AdminCoupons` (`:749-783`) | (없음) | A-8 쿠폰 | — | 시안에 "P1 Phase 2" 표기 — 일회성 운영 1주일 전이므로 구현 보류 가능. |

### 6.4 컴포넌트 매핑 (atoms/molecules/organisms)

| design-bundle (`components.jsx`) | 현재 파일 | 수정 필요 여부 | 비고 |
|---|---|---|---|
| `Button` (`:8-20`) | `src/components/atoms/Button.jsx` | (검증) | variant primary/secondary/danger/ghost · size lg/sm · block · loading spinner · btn-icon-only 모두 매칭 확인 필요. `.btn` h:44 / `.btn-lg` h:56 / `.btn-sm` h:36 사이즈 정합 확인. |
| `StatusChip` (`:23-41`) | `src/components/molecules/StatusChip.jsx` | (검증) | 8 상태 (ORDERED/TRANSFER_REPORTED/PAID/COOKING/READY/DONE/HOLD/CANCELED) 이모지 + 색·border 정합 확인. |
| `Stamp` (`:44-46`) | `src/components/molecules/StampBadge.jsx` | (검증) | recommended / sold-out / paid / done / canceled / best 6종. stencil + rotate(-3deg/-5deg/-10deg) + hard shadow. |
| `DogTag` (`:49-75`) | `src/components/molecules/DogTagFrame.jsx` | ❌ | size md/sm · sessionStorage 멱등 모션 · `::before` 14px 구멍 · accent 배경 · mono 56px 번호 + `/total` small + date mono · drop + pulse 모션. 현재 keyframe 정의는 있으나 실제 .dogtag CSS 클래스 누락. |
| `Mascot` (`:78-83`) | `src/components/molecules/MascotState.jsx` | ❌ | mascot.png 자산 미배치 → 렌더 불가. 사이즈 sm/md/lg, cooking-idle 모션 정합 확인. |
| `Timeline` (`:86-112`) | `src/components/organisms/OrderTimeline.jsx` | ◐ | 5-step (접수/입금/확인/조리/수령) · `.tl-fill` 옐로 채워짐 · `.timeline-dot` done/current/future 분기 · current dot-pulse. 현재 organism 존재하나 디자인 정합 검증 필요. |
| `EmptyState` / `LoadingState` / `ErrorState` (`:115-146`) | `src/components/state/*.jsx` | ◐ | spinner 32px 3px divider+옐로 border-top · stencil 64px error code · Mascot 동반 정합 확인. |
| `BannerTop` (`:149-151`) | (없음) | ❌ | SSE 끊김 빨간 상단 띠. 별도 organism 또는 StatusPage 인라인 추가. |
| `PhoneChrome` (`:154-168`) | (없음·불필요) | — | 시안 프레임용 — 실 구현 X. |
| `tweaks-panel.jsx` | (불필요) | — | 시연용. 실 구현 X. |
| `data.js` `MENUS` (8건) | `src/constants/menus.js` + `server/data/menus.json` (또는 동일 SoT) | (검증) | 본명(G10) + tag/sub(PUBG 매핑) 유지 여부 확인. 가격 데이터는 서버 권위. |
| `data.js` `STATE_LABEL` / `STAGE_COPY` | `src/pages/customer/StatusPage.jsx` 내 `STATE_LABEL` | ◐ | 카피 일치 검증. design-bundle의 stage copy는 emoji 포함 · 라인브레이크 포함. |
| `data.js` `MOCK_ADMIN_ORDERS` | (테스트용·실 미사용) | — | 서버 실 데이터 사용. |

---

## 7. 디자인 토큰 분석

> `tokens.css` 와 `tailwind.config.js` 는 1:1 매핑. **토큰은 추가 작업 없음.** 토큰 외 임의 색·간격 사용 금지.

### 7.1 색상

| 토큰 | hex | 용도 |
|---|---|---|
| `--color-bg` | `#2E3A26` | 페이지 전역(군복 짙은 카키그린) |
| `--color-surface` | `#3A4A2E` | 헤더·sticky bar·sidebar |
| `--color-elevated` | `#485B38` | 카드·input bg·section·receipt |
| `--color-ink` | `#E8E0C8` | 본문 텍스트(밝은 베이지) |
| `--color-muted` | `#A8A48C` | 보조 텍스트 |
| `--color-divider` | `#4F5A3B` | 보더·dashed |
| `--color-card-bg` | `#C8B894` | 메뉴 카드 배경(흙색, PUBG 인벤토리 톤) |
| `--color-card-surface` | `#B8A684` | 메뉴 카드 일러스트 배경 |
| `--color-card-ink` | `#2A2820` | 메뉴 카드 본문(가격·이름 — 카드 내 형광 옐로 텍스트 금지) |
| `--color-card-muted` | `#48402C` | 메뉴 카드 sub |
| `--color-card-divider` | `#9C8C68` | 카드 보더 |
| `--color-accent` | `#F4D200` | 형광 옐로(CTA/주문번호/도장 단일 사용) |
| `--color-accent-pressed` | `#D9BB00` | active state |
| `--camo-olive/sand/earth/leaf` | `#5C5D3A`/`#9A8E6B`/`#4F3D2A`/`#6E7544` | 카모 텍스처·scrollbar(어드민) |
| `--color-success/warning/danger/info` | `#5A8C42`/`#E59B0C`/`#C73E1D`/`#3A6B7E` | 시맨틱 |
| `--stamp-red/black/green` | `#B5301A`/`#1F1B14`/`#4A6B2D` | 도장 + pick-btn 검정 배경 |

### 7.2 폰트

| 토큰 | family | 용도 |
|---|---|---|
| `--font-body` | `Pretendard Variable` | 본문 |
| `--font-display` | `Pretendard Variable` (weight 800/900) | 제목·h2·`.btn` |
| `--font-mono` | `JetBrains Mono` / `D2Coding` | 숫자(가격·주문번호·시각·계좌번호) — `tabular-nums` |
| `--font-stencil` | `Black Ops One` | 카피("WINNER WINNER", "ORDER NO", section-label, biz-badge, 카테고리 코드 등 일부) |

### 7.3 폰트 크기

`--text-3xs:10 / 2xs:12 / xs:14 / sm:16 / base:18 / lg:20 / xl:24 / 2xl:32 / 3xl:48 / 4xl:64`
- 본문 14–16 / 카드 이름 15 / 메뉴 카드 sub 11(mono) / dogtag no 56 / winner-copy 28 / error code 64.

### 7.4 여백 (4px base)

`--space-3xs:2 / 2xs:4 / xs:8 / sm:12 / md:16 / lg:24 / xl:32 / 2xl:48 / 3xl:64`

### 7.5 border-radius

`--radius-none:0 / xs:2 / sm:4 / md:8 / lg:12 / tag:8px 8px 4px 4px / pill:9999px`

### 7.6 shadow (하드 오프셋만 — 부드러운 그림자 X)

| 토큰 | 값 |
|---|---|
| `--shadow-card` | `2px 2px 0 rgba(0,0,0,.30)` |
| `--shadow-elevated` | `4px 4px 0 rgba(0,0,0,.35)` |
| `--shadow-stamp` | `2px 2px 0 currentColor` |
| `--shadow-tag` | `0 4px 0 -1px rgba(0,0,0,.4), 0 8px 16px rgba(0,0,0,.25)` (도그태그만 예외) |

### 7.7 animation / motion

| 토큰 | 값 |
|---|---|
| `--duration-tap` | 100ms |
| `--duration-card` | 200ms |
| `--duration-stamp` | 150ms |
| `--duration-tag` | 600ms |
| `--duration-mascot` | 400ms |
| `--ease-out` | `cubic-bezier(.16, 1, .3, 1)` |
| `--ease-stamp` | `cubic-bezier(.34, 1.56, .64, 1)` |
| `--ease-tag` | `cubic-bezier(.17, .67, .32, 1.5)` |

### 7.8 layout 규칙

- **모바일 사용자:** 390×780 가정. `.app-header` h:auto 8/16/12 padding + `.app-body` flex-1 overflow-y + `.sticky-bar` 12/16/16 padding.
- **데스크톱 어드민:** 1024×720 (`.desktop` 프레임 시안용). `.admin-shell` flex-col + `.admin-topnav` 48px + `.admin-board` `grid-template-columns: repeat(6, minmax(0, 1fr))` 6-col Kanban.
- **카드 영역(메뉴·체크아웃 receipt)** 만 *밝은 흙색* 배경(`--color-card-bg`), 나머지 페이지는 짙은 카키.
- **카드 내부 텍스트 금지 색:** 형광 옐로 텍스트(`--color-accent`) — *대비 1.31:1*. 단 버튼 배경에는 OK.
- **카모 gradient** `.camo-gradient` — 헤더·sticky bar 배경 5–10% opacity로 합성.
- **어드민 영역 scrollbar** — 10px 너비, camo gradient + 옐로 detail (DESIGN-bundle `app.css:2036-2120`).

---

## 8. assets 사용 계획

`docs/design-bundle/assets/` → `public/` 으로 복사 (경로 단일 — 메뉴 데이터·CSS 양쪽이 동일 path 참조).

| asset 경로 (design-bundle) | 복사 대상 경로 (public) | 사용 위치 | 대체 금지 여부 | 비고 |
|---|---|---|---|---|
| `assets/mascot.png` (2,444 KB) | `public/mascot/mascot.png` 또는 `public/mascot.png` | `.app-header .brand-mark` · `Mascot` 컴포넌트 · `.login-mark` · `.start-cta .cta-mascot` · `EmptyState` · `ErrorState` · `ClosedScreen` | ✅ 금지 | 동일 이미지 다용도. URL을 `tokens.css`/`app.css` `url('assets/mascot.png')` → `url('/mascot/mascot.png')` 로 재배치. |
| `assets/items/bandage.webp` | `public/items/bandage.webp` | MenuCard m1(후라이드) 일러스트 | ✅ 금지 | `data.js` 의 `img:'assets/items/bandage.webp'` 와 짝. |
| `assets/items/first-aid.webp` | `public/items/first-aid.webp` | MenuCard m2(양념) | ✅ |  |
| `assets/items/med-kit.webp` | `public/items/med-kit.webp` | MenuCard m3(뿌링클) | ✅ |  |
| `assets/items/syringe.webp` | `public/items/syringe.webp` | MenuCard m4(감자튀김) | ✅ |  |
| `assets/items/defib.webp` | `public/items/defib.webp` | MenuCard m5(뿌링감자튀김) | ✅ |  |
| `assets/items/adrenaline.webp` | `public/items/adrenaline.webp` | MenuCard m6(칠리스) | ✅ |  |
| `assets/items/painkiller.webp` | `public/items/painkiller.webp` | MenuCard m7(콜라) | ✅ | G10 본명 유지 — 콜라/사이다 이름 X PUBG 코드만 UI에 노출. |
| `assets/items/energy.webp` | `public/items/energy.webp` | MenuCard m8(사이다) | ✅ |  |
| (없음 — 부스 약도) | `public/map/booth.png` (선택) | `BoothMinimapModal` | — | 시안은 CSS grid 만으로 4×4 박스 렌더. 실 이미지 X. `public/map/` 디렉토리는 비워둬도 OK. |
| (없음 — `uploads/배틀그라운드_인게임.jpg` 등) | (복사 X) | — | — | 시안 작성용 참조 — 운영 X. |

**경로 정책 결정 필요(이 단계에서는 결정 보류):**
- (A) `public/items/bandage.webp` 직접 — `data.js` 와 동일 path 유지, `<img src="/items/bandage.webp">`.
- (B) `src/assets/items/bandage.webp` Vite import — 빌드 시 해시 처리.
- 현재 메뉴 데이터(`src/constants/menus.js`)와 서버 측 데이터의 image 필드 형태를 작업 직전 한 번 더 확인 후 선택.

---

## 9. 현재 구현과 다른 부분 (화면별 갭 요약)

> 디자인 정합성 기준. 기능 로직(라우팅·검증·API 호출)은 별개. 갭은 *체크리스트*로 정리해 작업 단위로 쪼개기 쉽게 한다.

### 9.1 사이트 헤더 (`CustomerLayout.jsx`)

- [ ] mascot.png 28×28 brand-mark 누락 (현재 🍗 이모지)
- [ ] "오늘 저녁은 치킨이닭!" + stencil "WINNER · WINNER · CHICKEN · DINNER" 두 줄 브랜드 누락
- [ ] 🎒 인벤토리 아이콘 + count-badge (옐로 18px round) 누락
- [ ] `.camo-gradient` 헤더 배경 누락
- [ ] `.icon-btn` 36×36 round-md 보더 스타일 누락

### 9.2 C-1 메뉴 (`MenuPage.jsx`)

- [ ] `.best-banner` 보급품 박스(camo + 우측 stencil "WINNER WINNER / CHICKEN DINNER") — 현재 `RecommendedBanner` 는 단순 grid-3
- [ ] `.cat-tabs` 가로 스크롤 chip — "전체·추천·치킨·사이드·음료" 5종 (현재 4종, "추천" 누락)
- [ ] `.menu-card` 4:3 `.menu-illust` 텍스처 배경(repeating-linear 45° + radial-gradient)
- [ ] `.menu-img` `<img>` 78%·drop-shadow + `.ammo-tag` 우하단 mono code chip
- [ ] `.pick-btn` 검정 배경 + 옐로 텍스트 + 인벤토리 상태 분기(`+ 줍기` / `✓ 인벤토리 N` / `SOLD OUT`)
- [ ] sticky bar "🎒 인벤토리 N개 · 금액원 보기 →" 카피

### 9.3 C-2 카트 (`CartPage.jsx`)

- [ ] `.back-bar` (← + h1 "🎒 인벤토리" + mono meta "N ITEMS") — 현재 h2 단독
- [ ] `.cart-line` grid `56px 1fr auto` thumb img + name/name-sub(tag·sub) + qty − N + + remove × + price
- [ ] `.receipt` 박스 (소계 · 쿠폰 안내 · 합계 형광 옐로)

### 9.4 C-3 주문 정보 (`CheckoutPage.jsx`)

- [ ] 3 section 박스(`.section` elevated + `.section-label` stencil 옐로)
- [ ] `.checkbox-row.emphatic`(외부인) 2px 옐로 보더 + 옐로 8% bg
- [ ] 6-col grid 테이블 번호 1~12 — 현재 `<Input type=text>`
- [ ] 쿠폰 `.checkbox-row` 활성/비활성 opacity 0.55 분기
- [ ] 마지막 `.receipt` 미리보기(라인 + 쿠폰 할인 success 색 + 합계 옐로)
- [ ] sticky "📋 주문 접수 · 금액원"

### 9.5 C-4 완료 (`CompletePage.jsx`)

- [ ] `.app-header.camo-gradient` "주문 접수 완료 · ORDER · ISSUED" — 현재 헤더 없음
- [ ] `.dogtag-stage` 32/16/16 padding center 정렬
- [ ] `.winner-copy` stencil 28px 옐로 2줄 + small display 13px ink
- [ ] `.account-card` (acc-label stencil + acc-bank muted + acc-no mono 22 + acc-amount mono 28 옐로 dashed top + 2개 secondary 버튼)
- [ ] `.receipt` 주문 내역 미니
- [ ] `.warn-banner.info` 매장식사/포장 안내
- [ ] `.warn-banner.danger` "이체 후 확인 요청 버튼" 강조 (현재 단순 텍스트)
- [ ] sticky 2-button (이체했어요 primary + 조리 현황 ghost)

### 9.6 C-5 이체 신고 (`TransferPage.jsx`)

- [ ] `.back-bar #N` mono meta
- [ ] 결제 정보 section (주문번호 옐로 #N · 주문자 · 금액 옐로)
- [ ] 은행 7옵션 `.select`
- [ ] `.checkbox-row` "다른 이름으로 이체" + 조건부 input
- [ ] `.warn-banner.info` "이름·은행·금액·시각 4가지 일치" 안내

### 9.7 C-6 조리 현황 (`StatusPage.jsx`)

- [ ] `.app-header.camo-gradient` "🍗 조리 현황 · ORDER #N · LIVE" — 현재 단순 h1 + chip
- [ ] `BannerTop` 빨간 SSE 끊김 상단 띠 + 재시도 링크 — 현재 작은 text-warning text-xs 만
- [ ] `.timeline` 5-step `.tl-fill` 옐로 채워짐 + `.timeline-dot` done(체크)/current(pulse) 시각 — `OrderTimeline` 디자인 정합 검증
- [ ] Mascot 분기 (default / cooking-idle / arrived) 시각화
- [ ] `.ready-banner` 옐로 배경 + 3px 검정 보더 + stencil 26px "✅ #N번 / 수령 가능해요!" + ready-flash 1s ×2
- [ ] `.stage-copy` display 20px big + muted 13 sub (STAGE_COPY 카피)
- [ ] DogTag sm size + READY 시 pulse
- [ ] HOLD 분기 `.warn-banner.danger` + sticky "이체 정보 다시 보내기"
- [ ] sticky 우측 StatusChip 인디케이터

### 9.8 C-7 미니맵 (`MapPage.jsx` + `BoothMinimapModal.jsx`)

- [ ] `.modal-backdrop` fade-in 200ms + 0.75 black
- [ ] `.modal-head` (stencil h2 "🗺️ 부스 미니맵" + ✕ icon-btn)
- [ ] `.minimap` 45° 옐로 텍스처 + `BOOTH · A-12` / `NORTH ↑` mono 헤더
- [ ] `.grid` 4-col 12 테이블 `T1~T12` + `.table.mine` 옐로 펄스 — 현재 organism 디테일 정합 검증

### 9.9 C-8 오류 (`ErrorPage.jsx`)

- [ ] `.back-bar "오류"` (404/500 분기) 헤더
- [ ] stencil 64px danger 코드
- [ ] Mascot md
- [ ] display 18px h3 + muted 14 p

### 9.10 C-9 영업 외 (`ClosedPage.jsx` + `ClosedScreen.jsx`)

- [ ] `.app-header.camo-gradient` (subname "CLOSED")
- [ ] `.closed-screen` 🔒 48 + display 22 h1 + Mascot
- [ ] `.schedule` (stencil 옐로 label + mono 13px 2 items "5/20 (수) 16:30 오픈" 등)
- [ ] secondary "🔄 새로고침"

### 9.11 A-1 PIN 로그인 (`LoginPage.jsx`)

- [ ] `.login-shell` 45° 옐로 텍스처 카키 배경
- [ ] `.login-box` 320px surface lg-radius shadow
- [ ] 4-cell `.pin-row` 36×44 mono 20 옐로 + filled 옐로 8% bg + error danger + shake 350ms
- [ ] `.pin-pad` 3×4 grid 48px keys (elevated, 옐로 hover, scale 0.95 active)
- [ ] 시연 hint `code` 옐로 8% bg `7842` (운영 환경에서는 보안 검토 후 노출 결정)

### 9.12 A-2 본부 대시보드 (`DashboardPage.jsx` + `AdminCardColumn.jsx`)

- [ ] 전체 admin-topnav 디자인 (stencil 옐로 logo + 5 nav-link tab + biz-badge open/closed chip)
- [ ] **CLOSED `.start-cta.urgent`** — 노란 펄스 1.6s + 좌우 4px dashed-line + 80×80 cta-mascot + stencil 22 h2 "🚀 장사 시작" + lg primary 56 stencil 버튼 "장사 시작 →"
- [ ] OPEN `.open-status` — success 12% bg + 좌 3px success 보더 + 펄스 점 + "영업 중 · HH:MM 시작" + 우측 hint
- [ ] **6-col Kanban grid** — 현재는 grid-cols-2/3
- [ ] `.col-head.warn/.danger` 5분/10분 overdue 색상 분기
- [ ] `.order-card` 단계별 액션 버튼 + warn/danger 보더
- [ ] `.admin-toast` 액션 피드백

### 9.13 A-5 메뉴 관리 (`MenuAdminPage.jsx`)

- [ ] `.admin-table` 7-col grid (헤더 + 데이터 행)
- [ ] `.tbl-thumb` 40×40 webp + `.tbl-id` mono 10
- [ ] `.ammo` 코드 chip
- [ ] `.price-cell` (− mono price + / 클릭 시 inline input edit / 저장 ✓pop)
- [ ] `.pill-toggle` 품절(danger)·추천(accent)

### 9.14 A-6 정산 (`SettlementPage.jsx`)

- [ ] `.admin-info-bar.warn/.ok` 마감 가드 (ADR-012 진행 중 0건만 마감 가능)
- [ ] `.settle-grid` 2-col + `.settle-card` (요약 / ZIP 백업 / 메뉴별 판매 wide)
- [ ] 통장 입금 합계 수동 입력 + 차이 색분기 (=0:success / <1000:warning / >=1000:danger)
- [ ] `.bar-row` 메뉴별 판매(`200px 1fr 160px`)

### 9.15 A-7 감사 로그 (현재 미구현 / `AdminTransfersPage` 와 인접)

- [ ] 신규 페이지 또는 기존 페이지에 통합 결정 필요
- [ ] `.log-feed` `.log-row` grid `80px 32px 1fr 80px`
- [ ] 18종 액션 색맵 + 필터 tab + CSV 내보내기

### 9.16 A-8 쿠폰 (P1 Phase 2)

- [ ] 일회성 운영 D-5 이내. *작업 보류*. 통계만 어드민 토글로 노출 (선택).

---

## 10. 수정 작업 계획 (리스킨 순서)

> 일회성 운영(5/20·21)을 위한 시급도 우선. 토큰·자산은 이미 절반 완료(토큰 동일). 본 작업은 *2,000줄 가까운 semantic CSS 이식* 가 본질.
>
> **전제: 본 단계에서는 코드 수정 X.** 아래 순서는 후속 단계 청사진.

### Phase 0 — 자산·토큰 정합 (1회 작업, 빠름)

1. `docs/design-bundle/assets/mascot.png` → `public/mascot.png` 복사 (또는 `public/mascot/mascot.png` — 결정 필요).
2. `docs/design-bundle/assets/items/*.webp` (8 파일) → `public/items/` 복사.
3. `index.html` 에 design-bundle HTML 의 폰트 link 3종 추가 확인 (Pretendard CDN, JetBrains Mono Google Fonts, Black Ops One Google Fonts).
4. `tokens.css` 는 *변경 없음* — 이미 동일.

### Phase 1 — semantic CSS 이식 (핵심)

5. `docs/design-bundle/app.css` (2,133줄) 의 컴포넌트별 섹션을 분할하여 `src/styles/components.css` (또는 `src/styles/components/*.css` 모듈) 로 이식. 우선순위:
   1. `.btn`, `.btn-primary/secondary/danger/ghost/lg/sm/block/icon-only` (atoms — 모든 화면 의존)
   2. `.app-header`, `.brand-mark`, `.icon-btn`, `.count-badge`, `.back-bar`, `.camo-gradient` (layout)
   3. `.cat-tabs`, `.menu-grid`, `.menu-card`, `.menu-illust`, `.ammo-tag`, `.pick-btn`, `.best-banner` (C-1)
   4. `.cart-line`, `.receipt`, `.sticky-bar` (C-2/C-3 공통)
   5. `.section`, `.section-label`, `.checkbox-row`, `.checkbox-row.emphatic`, `.radio-group`, `.radio-cell`, `.field`, `.input`, `.select` (C-3 form)
   6. `.dogtag`, `.dogtag-sm`, `.dogtag-stage`, `.winner-copy`, `.account-card`, `.warn-banner.info/.danger` (C-4)
   7. `.timeline`, `.tl-fill`, `.timeline-dot`, `.tl-label`, `.stage-copy`, `.ready-banner`, `.chip` (C-6)
   8. `.modal-backdrop`, `.modal-head/body/foot`, `.minimap`, `.grid .table.mine`, `.entrance`, `.minimap-legend` (C-7)
   9. `.empty-state`, `.loading-state`, `.error-state`, `.spinner` (3 상태)
   10. `.closed-screen`, `.schedule` (C-9)
   11. `.login-shell`, `.login-box`, `.pin-row`, `.pin-cell`, `.pin-pad`, `.pin-key`, `shake` keyframe (A-1)
   12. `.admin-shell`, `.admin-topnav`, `.biz-badge.open/closed`, `.start-cta.urgent`, `.cta-pulse`, `.open-status` (어드민 공통 + A-2 CLOSED/OPEN)
   13. `.admin-board`, `.col`, `.col-head.warn/.danger`, `.col-body`, `.order-card.warn/.danger`, `.order-card .actions`, `.admin-toast` (A-2 OPEN)
   14. `.admin-page`, `.admin-page-head`, `.admin-tab`, `.admin-info-bar.warn/.ok`, `.admin-foot-tip`, `.admin-table`, `.tbl-thumb`, `.ammo`, `.price-cell`, `.bump-btn`, `.price-display`, `.saved-tick`, `.pill-toggle` (A-5)
   15. `.settle-grid`, `.settle-card`, `.settle-line`, `.bar-row`, `.bar-track`, `.bar-fill` (A-6)
   16. `.log-feed`, `.log-row`, `.log-icon`, `.log-action`, `.log-order`, `.log-who`, `.log-amount`, `.log-menu`, `.log-transition`, `.log-actor` (A-7 — 신규 페이지 결정 후)
   17. `.admin-shell` scrollbar 카모 스타일 (선택, 시각 디테일)
   18. `prefers-reduced-motion` 일괄 정적화

### Phase 2 — 컴포넌트별 JSX 정합

6. **atoms** — Button 디자인 검증 (variant/size/loading/block/icon-only) + Icon/Spinner/Label/Input/Checkbox/Radio/Select 의 design-bundle `.input/.select` 클래스 적용.
7. **molecules** — StampBadge·PriceTag·StatusChip·DogTagFrame·MascotState 의 마크업/클래스를 design-bundle 컴포넌트와 정합. DogTagFrame은 `.dogtag` `.tag-label` `.tag-no` `.tag-date` 구조 + `::before` 14px 구멍.
8. **organisms** — MenuCard, CartItem, OrderTimeline, BoothMinimapModal, CategoryTabs, MenuList, RecommendedBanner, StickyCartBar, BusinessStateBadge, StartBusinessCTA, ClosedScreen, AdminCardColumn 모두 .className 기반 마크업으로 변경. Tailwind 유틸은 *남기되 semantic class 와 공존 가능* — `@apply` 또는 직접 className 둘 다 허용.

### Phase 3 — 페이지 합성

9. CustomerLayout 헤더 재구성 (brand-mark + 2줄 브랜드 + 🗺️ + 🎒 with count-badge + `.camo-gradient`).
10. 각 페이지의 외곽 마크업을 design-bundle screens-*.jsx 의 구조로 재구성 (header + back-bar + section/receipt/sticky-bar).
11. STAGE_COPY 카피 정합. STATE_LABEL 라벨 정합.

### Phase 4 — 어드민 페이지 합성

12. AdminLayout 의 admin-topnav (stencil logo + nav tab + biz-badge + 우측 메타) 재구성.
13. DashboardPage CLOSED `.start-cta.urgent` + OPEN 6-col Kanban + AdminCardColumn 카드 마크업 + .admin-toast 추가.
14. MenuAdminPage 의 .admin-table 7-col grid + price-cell inline edit + pill-toggle.
15. SettlementPage 의 .settle-grid + 통장 차이 색분기 + 메뉴별 bar-row.
16. (선택) AdminHistory(A-7) 신규 페이지 또는 기존 TransfersPage 흡수 결정.

### Phase 5 — 검증·반복

17. `npm run build` / `npm test` / `npm run test:e2e`.
18. dev 서버에서 9 + 6 = 15 화면 시각 확인 + design-bundle HTML 직접 비교.
19. 회귀 매트릭스 통과 확인 (Pattern B 가격 계산, ADR-019 쿠폰 정규식, ADR-025 상태 전이, G13 영업 상태, ADR-012 정산 마감 — 모두 *기능 회귀*는 본 작업으로 손대지 않음).

### 유지(불변) 사항

- `server/domain/*` (백엔드 도메인 — TDD strict)
- API 경로·zod 스키마·`api/client.js`
- Zustand store(cart·businessState·ui) 동작
- ADR-019/020/021/023/024/025·G13·§3.5 React 8조 — *원래 기능*은 그대로
- 라우팅 경로(`/menu`, `/cart`, `/checkout`, `/orders/:id/{complete,transfer,status}`, `/map`, `/closed`, `/admin/*`)

### 교체 사항

- 페이지·컴포넌트의 *마크업 + 클래스*
- public/ 아래 자산 배치
- `src/styles/components.css` 의 keyframe-only → semantic class 전면 이식
- header(`CustomerLayout`) 의 시각 표현
- Tailwind 유틸 클래스는 *제거 강제 X* — semantic class 와 공존 OK. 다만 design-bundle 의 디테일과 충돌하면 semantic class 우선.

---

## 11. 검증 계획

### 11.1 자동 검증

| 단계 | 명령 | 기준 |
|---|---|---|
| 단위·통합 테스트 | `npm test` | 835/835 통과 유지 |
| 빌드 | `npm run build` | `dist/` 생성 + 자산 emit 확인 (mascot.png, *.webp) |
| Playwright smoke | `npm run test:e2e` | 기존 시나리오 통과 |
| Lint (선택) | (현재 ESLint 설정 검증 필요) | 추가 위반 0건 |

### 11.2 수동 시각 검증

브라우저에서 design-bundle HTML 과 dev 서버를 *동시 띄워 비교*. Chrome DevTools 디바이스 모드 — `iPhone 12 Pro (390×844)` 또는 `iPhone 14 (393×852)`.

| 화면 | URL (dev) | design-bundle 대조 | 체크 포인트 |
|---|---|---|---|
| C-1 메뉴 | `http://localhost:5173/menu` | `ScreenMenu` | 헤더 brand-mark · stencil 서브 · 🎒 count-badge · `.best-banner` 보급품 박스 · `.cat-tabs` 5종 · `.menu-card` 4:3 일러스트 + ammo-tag + pick-btn · `.sticky-bar` 카피 |
| C-2 카트 | `/cart` | `ScreenCart` | back-bar · cart-line grid · receipt · 합계 옐로 |
| C-3 주문 정보 | `/checkout` | `ScreenCheckout` | 3 section · section-label stencil · emphatic checkbox · 6-col 테이블 grid · receipt 미리보기 |
| C-4 완료 | `/orders/N/complete` (테스트 주문) | `ScreenComplete` | dogtag drop 모션(첫 진입) · WINNER WINNER 2줄 · account-card + 2버튼 · warn-banner danger 강조 · sticky 2버튼 |
| C-5 이체 | `/orders/N/transfer` | `ScreenTransfer` | back-bar #N · 결제 정보 · 은행 select · 다른이름 checkbox · warn-banner info |
| C-6 현황 | `/orders/N/status` | `ScreenStatus` | camo-gradient 헤더 · BannerTop SSE 끊김 (강제 토글 시) · timeline 5-step + 옐로 fill · Mascot 상태별 · ready-banner 절정 · stage-copy 카피 · dogtag sm · sticky StatusChip |
| C-7 미니맵 | `/map` 또는 헤더 🗺️ | `MinimapModal` | modal-backdrop fade · minimap 텍스처 + 4-col grid · 본인 테이블 펄스 · entrance dashed |
| C-8 404 | 임의 경로 | `ScreenError` 404 | stencil 64 danger code + Mascot + 홈으로 |
| C-8 500 | (가능 시 에러 강제) | `ScreenError` 500 | 동일 |
| C-9 영업외 | `/closed` | `ScreenClosed` | camo-gradient (CLOSED subname) · 🔒 + 22 h1 · Mascot · schedule 2 items · 새로고침 secondary |
| A-1 PIN | `/admin/login` | `AdminLogin` | 45° 옐로 텍스처 bg · login-box · 4 pin-cell + shake · 3×4 pin-pad · hint code |
| A-2 본부 (CLOSED) | `/admin/dashboard` (CLOSED 시) | `AdminDashboardBody` CLOSED | start-cta.urgent 노란 펄스 + dashed-line 좌우 + 56px stencil 버튼 |
| A-2 본부 (OPEN) | `/admin/dashboard` (OPEN 시) | `AdminDashboardBody` OPEN | open-status + 6-col Kanban + col-head 5분/10분 · order-card 단계별 액션 · admin-toast |
| A-5 메뉴 | `/admin/menus` | `AdminMenus` | 7-col grid · webp 썸네일 · ammo chip · price-cell inline edit + ✓pop · pill-toggle |
| A-6 정산 | `/admin/settlement` | `AdminSettlement` | admin-info-bar.warn/.ok · settle-grid · 통장 차이 색분기 · bar-row 메뉴별 |
| (선택) A-7 | `/admin/transfers` 또는 신규 | `AdminHistory` | log-feed · 18종 액션 색맵 · 필터 tab · CSV |

### 11.3 반응형 확인

- **모바일 우선** (390–430). 사용자 9 화면은 *모바일 가정*. 데스크톱·태블릿은 호환만 — 디자인 SoT 의무 X.
- **데스크톱** (1024+). 어드민 6 화면은 *데스크톱 가정*. 모바일은 호환만.
- 임계값:
  - 360 (작은 안드로이드) — 메뉴 카드 2-col 유지, sticky bar 가독성.
  - 390 (iPhone 14/15 mini) — 시안 기준.
  - 430 (iPhone Plus/Pro Max) — 여백 자연스럽게 확장.
  - 768 (iPad) — 데스크톱 admin 만 6-col 유지, 사용자 화면은 모바일 그대로 가운데 정렬.
  - 1024 — 어드민 6-col Kanban 1행 유지.

### 11.4 design-bundle 비교 체크리스트(공통)

- [ ] 모든 페이지 — 본문 16px / 헤더 16/15 · sticky bar h:auto+44 버튼
- [ ] 카드 안 텍스트에 형광 옐로(`--color-accent`) X (대비 1.31:1, AI 슬롭 #26)
- [ ] 그림자는 *하드 오프셋만* (`box-shadow: 2px 2px 0 ...`) — soft blur X
- [ ] 모션: tap 100ms / card 200ms / stamp 150ms / tag 600ms — duration 토큰 사용
- [ ] DogTag 모션 단발 (sessionStorage 멱등) — `dogtag-shown-{id}` 키
- [ ] camo-gradient 5–10% opacity 합성 (헤더·sticky bar)
- [ ] prefers-reduced-motion 시 keyframe 정적화 + `.minimap .table.mine` 정적 box-shadow
- [ ] 자산 경로 통일 (`/items/{name}.webp`, `/mascot.png` 또는 `/mascot/mascot.png` — 결정 일관)
- [ ] design-bundle HTML 의 폰트 link 3종 모두 `index.html` 에 적재 + tokens.css 의 font-family 와 정합

---

## 작업 순서 요약

1. **자산 복사** — `mascot.png` + 8 webp → `public/`.
2. **폰트 link 확인** — `index.html` 의 Pretendard/JetBrains Mono/Black Ops One.
3. **`src/styles/components.css`** 를 `docs/design-bundle/app.css` 기반으로 전면 이식 (section 별로 점진 머지). keyframe은 기존 6종 + 추가 누락분.
4. **CustomerLayout 헤더** 재구성 (brand-mark + 2줄 브랜드 + 🗺️ + 🎒 count-badge).
5. **organisms 마크업 정합** — MenuCard / CartItem / RecommendedBanner / OrderTimeline / BoothMinimapModal / ClosedScreen / AdminCardColumn 등.
6. **각 사용자 페이지** 마크업 재구성 (header → body → sticky-bar 패턴).
7. **AdminLayout admin-topnav** + DashboardPage CLOSED `.start-cta.urgent` + OPEN 6-col Kanban.
8. **A-5 / A-6** 표·grid·통장 차이 정합.
9. **A-7 감사 로그** — 신규 또는 통합 결정 후 구현.
10. `npm test` / `npm run build` / 브라우저 수동 검증 → 잔여 갭 재점검 → 반복.

> 본 audit 문서는 *분석만*. 다음 작업 단계에서 위 순서대로 PR/커밋 단위를 쪼개되, *기능 로직(API·검증·라우팅·상태 전이)은 손대지 않는다*. 어긋남 발견 시 → 항상 `docs/design-bundle/` 원본을 다시 본다.
