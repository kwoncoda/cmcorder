# 2026-05-19 — 메뉴 카드 빼기 버튼 + 어드민 개발자 메모 정리

## 목표

D-1(2026-05-19) 리허설 직전 두 가지 UX 마찰 해소:

1. 홈(메뉴) 화면에서 한 메뉴를 두 번 줍기 후 한 번 빼고 싶을 때, **인벤토리 페이지까지 들어가야만** 수량 감소가 가능했던 문제. 카드 위에서 바로 빼기 가능하도록 보조 버튼 추가.
2. 어드민 메뉴 탭 푸터의 `※ POST /admin/api/menus/:id — Pattern B (ADR-020): 가격 계산은 서버 권위, 클라이언트는 표시만.` 개발자 메모 노출. 정산 탭의 close-guard 메시지 꼬리 `(ADR-012)`. 본부 운영자에게 의미가 없는 문구라 제거.

## 만든 것

- `MenuCard` 의 새 prop **`onDec`** + 카트 담긴 순간만 등장하는 빼기 보조 버튼(`.pick-btn-dec`)
- `MenuList` 의 `onDec` pass-through
- `MenuPage` 의 `handleDec` 핸들러(store getState 패턴, 리렌더 0)
- CSS 토큰 `.menu-card .pick-btn-group` / `.menu-card .pick-btn-dec`
- MenuCard 회귀 테스트 4건, MenuPage 회귀 테스트 1건

## 한 일

### 작업 1 — 메뉴 카드 빼기 보조 버튼

- `src/components/organisms/MenuCard.jsx`
  - `onDec` prop 추가 (`23` line, 옵셔널 — 미전달 시 빼기 미표시 → 호환)
  - `handleDec` 추가, soldOut 가드(`53–56`)
  - `mainAriaLabel`(품절·담김·기본 3분기), `showDec` 플래그(`77–82`)
  - 단일 `<button>` 을 `<div className="pick-btn-group">` 으로 감싸고, 안에 메인 + 조건부 빼기 버튼(`133–155`). `−` 텍스트는 `<span aria-hidden="true">` 처리 — a11y 라벨은 `${menu.name} 한 개 빼기`
- `src/components/organisms/MenuList.jsx`
  - `onDec` prop 추가 → MenuCard 로 전달(`7, 24`)
- `src/pages/customer/MenuPage.jsx`
  - `handleDec` 추가(`30–35`) — `useCartStore.getState()` 이벤트-콜백 패턴(§3.5 2조, 셀렉터 구독 X)
  - quantity ≤ 1 → `removeItem`, else `changeQty(-1)` — CartItem 패턴과 동일
  - `<MenuList ... onDec={handleDec} />` (`66`)
  - 페이지 라인: 64 → **72** (≤120 룰 OK)
- `src/styles/components.css`
  - `.pick-btn-group { margin-top:8px; display:flex; gap:4px; }`
  - `.pick-btn-group .pick-btn { margin-top:0; flex:1; }` (기존 margin 충돌 회피)
  - `.pick-btn-dec { flex:0 0 44px; height:36px; background:var(--color-success); … }` — 메인 `data-incart` 초록과 동톤
  - `.pick-btn-dec:active { transform:scale(0.96) }` — 터치 피드백

### 작업 2 — 어드민 ADR/Pattern UI 노출 정리

- `src/pages/admin/MenuAdminPage.jsx`
  - `<div className="admin-foot-tip">…Pattern B (ADR-020)…</div>` 블록 전체 삭제. 107 → **103** line
  - CSS `.admin-foot-tip` (components.css:1776, 1786) 는 잔존 — surgical changes 원칙, 운영 종료 후 dead code 정리 시점에 함께
- `src/pages/admin/SettlementPage.jsx`
  - close-guard 메시지에서 ` (ADR-012)` 꼬리 제거. 본문 `진행 중 주문 N건이 있어 마감할 수 없어요.` 유지. testid `close-guard` 그대로

## 테스트 결과

### 단위·통합 (docker)

```bash
docker compose -f docker-compose.dev.yml exec dev npm test -- --run
```

→ **Test Files 101 passed | Tests 1170 passed** (222s)

신규/변경 영향:
- `src/components/organisms/__tests__/MenuCard.test.jsx` — 12 → **16건** (beforeEach cart 초기화 + 4 신규 케이스: 빼기 표시·클릭 콜백, onDec 미전달 호환, soldOut+담김 가드, a11y axe 담긴 상태)
- `src/pages/customer/__tests__/MenuPage.test.jsx` — **+1건** (`★ 빼기 버튼 클릭 시 수량 감소 + 1→0 시 카트에서 제거`)
- `MenuAdminPage.test.jsx`, `SettlementPage.test.jsx` 무영향 (각각 footer 검사 없음 + close-guard testid만 검사)

### Production 빌드 (docker, ADR-034 가드)

```bash
docker compose -f docker-compose.dev.yml exec dev npm run build
```

→ **built in 7.80s** — 190 modules transformed. CSS 63.27kB / JS 302.33kB(main). Cross-env NODE_ENV=production 정상 작동.

### E2E (Playwright)

dev 컨테이너에 chromium-headless-shell 미설치(환경 이슈, 본 변경 무관) — 통과 확인 못 함. 본 변경은 프론트 컴포넌트만 수정해 서버 라우트·미들웨어·nginx 무영향이므로 ADR-033 사고 패턴(정적 자산 가로채기) 회귀 위험 낮음.

### 수동 시각 검증 권장 (D-1 리허설 직전)

```bash
docker compose -f docker-compose.dev.yml exec dev npm run dev
# 브라우저 http://localhost:5173
#  - 후라이드 줍기 → '✓인벤1' + 빼기 버튼 등장
#  - 빼기 1회 → 카드 다시 '＋ 줍기' 라벨 복귀
#  - 다른 메뉴도 동일 확인
#  - /admin → 메뉴 탭 푸터 문구 사라짐 확인
#  - /admin → 정산 탭 진행 주문 있는 상태에서 '(ADR-012)' 사라짐 확인
```

## 다음에 할 것

없음 — D-day(5/20) 까지 동결. 운영 중단 후 dead `admin-foot-tip` CSS 클래스 정리(저우선) 정도가 잔여.
