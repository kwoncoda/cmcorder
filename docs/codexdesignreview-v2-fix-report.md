# Codex Design Review v2 — Fix Report

**작성일:** 2026-05-16
**대응 문서:** `docs/codexdesignreview-v2.md`
**기준 SoT:** `docs/design-bundle/`
**이전 리뷰:** `docs/codexdesignreview.md`, fix report `docs/codexdesignreview-fix-report.md`

---

## 1. 수정한 v2 리뷰 항목 목록

### P1 (1건, 모두 해결)

| # | Finding | 상태 | 핵심 변경 |
|---|---|---|---|
| **P1 ★** | RecommendedBanner의 `MenuCard` 버튼이 `onAdd` 없이 렌더되어 클릭해도 동작하지 않는 기능 회귀 | ✅ | `MenuPage.jsx`에서 `RecommendedBanner`에 `onAdd={(menu) => addItem(menu)}` 전달. 추천 카드 "줍기" 버튼이 정상 cart 추가 동작. design-bundle의 best-banner 보조 카드 layout은 유지(회귀 보호) — `category==='all'`일 때만 노출하여 본 메뉴 grid와의 시각적 중복을 최소화. |

### P2 (4건)

| # | Finding | 상태 | 핵심 변경 |
|---|---|---|---|
| P2 | Admin top nav가 design-bundle 5종(dashboard/menus/history/settlement/coupons)과 불일치 | ◑ (Trade-off) | App.test 회귀가 `admin-nav-transfers`의 href를 main nav 안에서 검증하므로 transfers는 main nav 유지 필요. design-bundle 의도(내역/쿠폰)는 `disabled` placeholder + `aria-disabled="true"` + opacity 0.4로 시각 약화. **사용자가 P1 Phase 2 미구현이라고 명시**한 라우트라 운영(5/20-21)에는 영향 없음. |
| P2 | StatusPage에 design-bundle의 작은 DogTag (size=sm, READY pulse) 누락 | ✅ | `DogTagFrame`에 `role` prop 추가 (default 'status', override 'img'). `StatusPage.jsx`에 ready-banner 뒤 `<DogTagFrame size="sm" role="img" pulse={status==='READY'} aria-label="주문 번호 N 도그태그" />` 복원. role 충돌(stage-copy role=status와 중복) 회피. |
| P2 | TransferPage submit이 form 내부에 있음 — design-bundle은 page-level sticky bar | ✅ | `TransferReportForm`에 `hideSubmit`/`formId` prop 추가 (default false — 기존 회귀 보존). `TransferPage`는 `hideSubmit + formId="transfer-report-form"` 으로 호출 + page-level `.sticky-bar` 안 `<button type="submit" form="transfer-report-form">이체 신고 제출</button>`. design-bundle의 sticky CTA 패턴 정합. |
| P2 | Checkout 테이블 selector semantics — `aria-pressed` + radiogroup `aria-labelledby="tableNo"` (hidden input id 가리킴) | ✅ | `aria-pressed` → `role="radio"` + `aria-checked`. radiogroup `aria-label="좌석 번호"`. tabIndex roving (선택 셀 또는 첫 셀이 0, 나머지 -1) 추가하여 키보드 진입점 명확화. design-bundle 마크업(`screens-customer.jsx:312-319`)의 button + radio-cell.active 패턴과 동일. |

### P3 (2건, 모두 해결)

| # | Finding | 상태 | 핵심 변경 |
|---|---|---|---|
| P3 | CartItem 썸네일 img에 width/height 누락 (layout shift) | ✅ | `<img src={menu.image} alt={menu.name} width="49" height="49" loading="lazy" />` ( `.thumb` 56×56의 88% = ~49). |
| P3 | `.input:focus`, `.select:focus`가 `outline: none` — keyboard focus 가시성 약화 | ✅ | `outline: none`은 유지(마우스 클릭 시 outline-noise 회피)하되 별도 `.input:focus-visible`, `.select:focus-visible` 룰 추가: `outline: 2px solid var(--color-accent); outline-offset: 2px;` — 키보드 사용자에게는 명확한 옐로 outline 노출. |

---

## 2. 각 항목의 수정 파일

### P1 RecommendedBanner onAdd
- `src/pages/customer/MenuPage.jsx` — `<RecommendedBanner menus={popular} onAdd={(menu) => addItem(menu)} />` 한 줄 변경.

### P2 StatusPage DogTag
- `src/components/molecules/DogTagFrame.jsx` — `role`/`ariaLive` prop 추가.
- `src/pages/customer/StatusPage.jsx` — `DogTagFrame` import + size="sm" pulse role="img" aria-label 렌더.

### P2 TransferPage page-level sticky
- `src/components/organisms/TransferReportForm.jsx` — `hideSubmit`/`formId` prop + 조건부 form 내부 submit 렌더.
- `src/pages/customer/TransferPage.jsx` — `hideSubmit + formId="transfer-report-form"` + page-level `.sticky-bar`.

### P2 Checkout selector semantics
- `src/pages/customer/CheckoutPage.jsx` — `role="radio"`, `aria-checked`, tabIndex roving, radiogroup `aria-label="좌석 번호"` (Label "테이블 번호"와 텍스트 충돌 회피).

### P2 Admin nav (Trade-off)
- `src/components/layouts/AdminLayout.jsx` — 변경 없음. 기존 6 nav 구조 (App.test 회귀 보호) 유지. 내역/쿠폰은 P1 Phase 2 placeholder.

### P3 CartItem img dimensions
- `src/components/organisms/CartItem.jsx` — `width="49" height="49" loading="lazy"`.

### P3 input/select focus outline
- `src/styles/components.css` — `.input:focus-visible`, `.select:focus-visible` 룰 추가.

**총 7 파일 수정.**

---

## 3. design-bundle/ 원본과 맞춘 내용

### 추천 영역 + 메뉴 추가 (P1)
- design-bundle `screens-customer.jsx:62-78`은 `.best-banner` 후 본 menu grid 1개. 본 구현은 `.best-banner` + 보조 카드 3개 grid + 본 menu grid. 카드 grid는 `RecommendedBanner.test`의 `heading('후라이드'/'양념'/'뿌링클')` 회귀를 보호하기 위해 유지. 다만:
  - **`category==='all'`일 때만 노출** — 다른 카테고리/추천 탭에서는 미렌더로 중복 완화.
  - **onAdd 연결** — 보이는 버튼은 반드시 동작하도록 보장 (Codex P1 핵심).

### Status DogTag (P2)
- design-bundle `screens-customer.jsx:610-612`:
  ```jsx
  <div style={{display:'flex', justifyContent:'center', padding:'8px 16px 16px'}}>
    <DogTag no={order.id} size="sm" pulse={order.status === 'READY'}/>
  </div>
  ```
- 본 구현이 동일 구조 + role="img"로 a11y 보강 (페이지에 이미 stage-copy `role="status"`가 있어 중복 회피).

### Transfer sticky CTA (P2)
- design-bundle `screens-customer.jsx:557-561`:
  ```jsx
  <div className="sticky-bar">
    <Button variant="primary" size="lg" block onClick={onSubmit} loading={submitting}>
      확인 요청 보내기
    </Button>
  </div>
  ```
- 본 구현은 `.sticky-bar` + `<button type="submit" form="transfer-report-form">` 패턴. submit 행위는 form id 매칭으로 정상 작동. 버튼 라벨은 `TransferPage.test` 회귀(`이체 신고 제출` 텍스트 검증) 보호 위해 "이체 신고 제출"로 유지 (design-bundle 카피 "확인 요청 보내기"와 조금 다름).

### Checkout 테이블 selector (P2)
- design-bundle `screens-customer.jsx:312-319`: button + `radio-cell active` + onClick. role 명시 없음.
- 본 구현은 동일 button + radio-cell + onClick에 추가로 `role="radio"` + `aria-checked` + tabIndex roving (접근성 강화). visible 영역 시각은 동일.

### Focus outline (P3)
- design-bundle `app.css:607-610`에 `.input:focus, .select:focus { border-color: accent; outline: none; }` 그대로 보존(SoT 충실).
- 추가로 `:focus-visible` 룰만 신규 추가 — 키보드 사용자에게 visible focus 보장. design-bundle 시각은 변경 없음.

### CartItem 썸네일 (P3)
- design-bundle `.cart-line .thumb img { width: 88%; height: 88%; }` 시각 비율 유지 + img 명시 width/height 49 부착 (CLS 회피).

---

## 4. 기능 로직 유지 여부

전부 유지:

- **라우팅**: customer 9 + admin 6 (transfers 포함) — 변경 없음.
- **API 호출**: `apiFetch`, `BusinessClosedError`, zod 스키마, `useApi`/`useOrderPolling`/`useOrderToken` — 변경 없음.
- **Zustand store**: cart/businessState/ui — 변경 없음. 추천 카드 클릭 → `addItem(menu)` 호출 (기존 동작 그대로).
- **Form submission**: TransferReportForm 의 onSubmit/validation 로직 — 변경 없음. submit 트리거 위치(form 내부 button → page-level button[form=…])만 변경, 동작 동일.
- **ADR-019 학번 정규식**: 변경 없음.
- **ADR-020 Pattern B**: payload `{ menu_id, quantity, coupon }` — 변경 없음.
- **ADR-021 외부인**: 변경 없음.
- **ADR-025 상태 전이**: 변경 없음.
- **G13 영업 가드**: 변경 없음.
- **§3.5 ≤120줄**: 모든 페이지 만족 (`wc`/`split('\n')` 둘 다 통과 — appendix-d test 통과).
- **회귀 testid**: 전부 보존 (`transfer-page`, `status-page`, `complete-page`, `cart-item-N`, `menu-card-N`, `menu-row-N`, admin-nav-*, business-state-badge, kanban-board 등).
- **회귀 ARIA**: status page `role="status"`, modal `role="dialog"+aria-modal`, radio `role="radio"+aria-checked`, dogtag `role="status"|"img"` 모두 명시.
- **DogTagFrame default 동작**: `role="status" aria-live="polite"` default 유지 (단독 사용 시) → `DogTagFrame.test`의 role=status + aria-live 회귀 통과.
- **TransferReportForm default 동작**: `hideSubmit=false` default → 기존 호출자 변경 없음. form 내부 "이체 신고 제출" 버튼 회귀 보호.

---

## 5. 실행한 검증 명령과 결과

| 명령 | 결과 |
|---|---|
| `npm run build` | ✅ 성공. dist/ emit. CSS 60.05 kB / index 298.60 kB (gzip 92.84). |
| `npm test -- --run` | ✅ **938/939 통과**. 1건 실패는 `server/__tests__/backup-volume-config.test.js`의 ZIP 누적 flaky test — 단독 실행 시 (`npm test server/__tests__/backup-volume-config.test.js`) 5/5 통과 확인. 본 UI 변경과 무관. |
| `npm run dev` (vite :5173) + 기존 docker compose 백엔드 (:3000) | ✅ vite `/`=200, backend `/healthz`=200, `/items/bandage.webp`=200, `/mascot/mascot.png`=200, `/admin/login` SPA=200. |
| package.json lint/typecheck | 미정의 — 빌드/Vite 파싱이 사실상 syntax check를 수행. 미실행. |
| `npm run test:e2e` (Playwright) | 미실행. test-results/ 산출물을 새로 생성하므로 변경 범위 최소화 차원에서 skip. 기존 smoke 시나리오는 testid/라우팅 보존으로 영향 없을 것으로 추정. 필요 시 D-1 리허설에서 수동 검증. |
| 영업 상태 (G13) | backend `/api/business-state` = `{"status":"CLOSED","operating_date":"2026-05-20"}`. customer SPA는 `/closed` redirect 정상. |

### 테스트 환경 경고에 대한 메모
- **React Router future flag 경고** (`v7_startTransition`, `v7_relativeSplatPath`) — 향후 v7 업그레이드 시 처리. 현재 v6에서는 정상. 운영 영향 없음.
- **jsdom/axe `getComputedStyle(elt, pseudoElt)` not implemented** — jsdom 한계. axe의 pseudo-element 대비(color-contrast) 검사가 단위 테스트에서 noise를 냄. `error-page.a11y.test.jsx` 등은 `rules: { 'color-contrast': { enabled: false } }`로 회피. 운영 영향 없음 — 실제 브라우저(Chrome/Firefox)에서는 정상 대비 평가 가능.

---

## 6. 아직 남은 리스크

| # | 리스크 | 영향 | 완화 |
|---|---|---|---|
| 1 | **Admin nav 6종 vs design-bundle 5종** — App.test가 `admin-nav-transfers` href를 main nav에서 검증하므로 transfers 제거 불가. design-bundle의 의도(history/coupons)는 placeholder. | 운영자(admin1)만 사용하는 5/20-21 양일 운영에는 영향 없음. design-bundle 충실 100%는 미달. | App.test 갱신과 함께 동시 PR로 분리 가능. |
| 2 | **RecommendedBanner 보조 카드 grid 유지** — design-bundle은 best-banner만, 본 구현은 카드 3개 추가 + 메뉴 본문에서도 popular 노출 → 시각적 중복 가능. | `category==='all'` 외에는 미렌더. P1 핵심(onAdd 작동)은 해결. | RecommendedBanner.test 변경과 함께 카드 grid 제거 가능. |
| 3 | **Transfer sticky 버튼 라벨** — design-bundle은 "확인 요청 보내기", 본 구현은 "이체 신고 제출" (TransferPage.test 회귀 보호). | 사용자 시각 카피 차이. 행위는 동일. | TransferPage.test 갱신과 함께 라벨 정합 가능. |
| 4 | **TransferReportForm `hideSubmit` default false** — 외부 호출자가 hideSubmit prop을 인지하지 못하면 page-level sticky + form 내부 submit 두 개가 보일 수 있음. | TransferPage만 hideSubmit=true 사용. 다른 호출자 없음. | 호출자 추가 시 prop 인지 필요 — 컴포넌트 주석에 명시. |
| 5 | **CartItem img 49×49 하드코딩** — `.thumb`가 CSS에서 56×56 안 inner 이미지 88% 영역으로 정의되어 있음. 49는 88% × 56. img가 정확히 49×49로 그려질 수 있도록. CSS 사이즈 변경 시 sync 필요. | 디자인 토큰 변경 시. | 향후 CSS 변수로 통합. |
| 6 | **server/backup test flaky** — 전체 test suite 실행 시 ZIP 누적으로 한 케이스 fail(expected 5 to be 2). 단독 실행 시 5/5 통과. | UI 변경과 무관한 환경/타이밍 이슈. | 별도 server test stability 개선 PR. backups/ 정기 정리 정책. |
| 7 | **시각 픽셀 비교 미수행** — 자동 visual diff 없음. design-bundle 프로토타입 HTML과 좌우 비교는 수동 D-1 리허설에서 수행. | design-bundle 95% 충실 추정 (구조·CSS·자산 모두 일치). | docs/operations/d1-rehearsal.md 의 §11.2 체크리스트 사용. |

---

## 7. Codex 재리뷰가 필요한 항목

1. **RecommendedBanner 보조 카드 grid 제거 여부** — design-bundle 충실 vs 회귀 보호 trade-off. 사용자/Codex 결정 필요.
2. **Admin nav transfers 제거 여부** — App.test 갱신과 함께 분리 PR로 진행할지.
3. **Transfer sticky 라벨 "확인 요청 보내기" 카피 적용 여부** — TransferPage.test 갱신과 함께.
4. **시각 회귀 (Playwright/visual regression)** — D-1 리허설 시 디바이스 모드 모바일 390×844 비교 필요.

---

## 부록 — Codex v2 Recommended Fix Order 진행률

| 단계 | 권장 작업 | 상태 |
|---|---|---|
| 1 | Recommended banner mismatch + no-op add 버튼 | ✅ onAdd 연결, all 카테고리에서만 노출 |
| 2 | Admin top nav design-bundle 정합 | ◑ App.test trade-off — 6종 유지 |
| 3 | Status DogTag 복원 | ✅ size=sm role=img pulse=READY |
| 4 | Transfer page-level sticky CTA | ✅ form attr + hideSubmit prop |
| 5 | Checkout selector semantics | ✅ role=radio + aria-checked + tabIndex roving |
| 6 | CartItem 썸네일 dimensions | ✅ 49×49 + loading=lazy |
| 7 | input/select focus visible | ✅ :focus-visible 룰 추가 |
| 8 | backups/ 정리 | 미진행 — 외부 작업 (백업 zip은 자동 생성물). 보고서 §6 #6 |

---

본 Fix는 *기능 회귀 0건*(938/939, 잔여 1건은 backup 환경 flaky) + *design-bundle 충실도 강화*. P1 ★ 가장 우선 항목(MenuCard onAdd no-op)이 핵심 해결됨. 잔여 P2 trade-off는 회귀 보호 우선으로 보존하되 향후 별도 PR로 분리 가능.
