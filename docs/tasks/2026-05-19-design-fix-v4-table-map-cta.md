# 2026-05-19 — design_fix_v4 Task 1: 홈 메뉴 페이지 TableMapCTA

## 목표

메뉴 페이지(`/menu`)의 카테고리 바("전체/추천/치킨/사이드/음료") **위쪽**에 가로 카드형 CTA를
신규 organism으로 추가. 클릭 시 `<Link to="/map">`으로 기존 미니맵(MapPage)에 진입.
헤더의 작은 좌석 배치도 버튼(`header-map-link`) 및 인벤토리 버튼(`header-cart-link`) 모두
회귀 보호. 카테고리 5탭 동작 그대로 유지.

배경: 사용자가 자주 보는 메뉴 페이지에서 테이블 위치 확인 동선을 본문으로 끌어올려
"주문 전 자리 확인" 흐름을 시각적으로 안내.

## 만든 것

- 신규 organism `src/components/organisms/TableMapCTA.jsx` (47줄)
  - `<Link to="/map">` 단일 anchor wrapper
  - `data-testid="home-table-map-cta"`
  - 카피 3종: "테이블 배치도" / "주문 전 테이블 위치를 확인해 주세요" / "배치도 보기"
  - 우측 썸네일: `public/map/table-location.webp` (72×72, lazy loading, alt="")
  - `aria-label="테이블 배치도 보기"`
- 신규 테스트 `src/components/organisms/__tests__/TableMapCTA.test.jsx` (8 케이스)
- 스타일 `.table-map-cta` 외 5개 클래스 — `src/styles/components.css`에 추가
  (다크/옐로우 토큰 활용, 최소 높이 88px, `:focus-visible` outline)

## 한 일

### 1. RED — TableMapCTA 단위 테스트 (8 케이스)
- 제목/설명/보조 카피 3종 노출 검증
- `<Link to="/map">` href 검증
- testid 노출 검증
- aria-label 검증
- 썸네일 src/alt 검증 (`/map/table-location.webp`, alt="")
- anchor 태그 단일 wrapper 검증
- 실패 확인: 파일 미존재 → 0/0 tests, suite 자체 실패

### 2. GREEN — TableMapCTA organism 구현
`src/components/organisms/TableMapCTA.jsx` 신규.
- forwardRef + className 머지 패턴 (StickyCartBar/CategoryTabs와 동일 톤)
- "배치도 보기" 텍스트와 "→" arrow를 별도 span으로 분리 — `screen.getByText('배치도 보기')` 가 exact match 통과
- 결과: 8/8 GREEN

### 3. RED — MenuPage 통합 테스트 (3 케이스 추가)
기존 `src/pages/customer/__tests__/MenuPage.test.jsx` 끝에 `describe('design_fix_v4 — TableMapCTA 통합')` 블록 추가:
- CTA가 메뉴 페이지에 렌더된다
- DOM 순서 검증: RecentOrdersSection 다음, CategoryTabs *앞* (compareDocumentPosition 사용)
- href="/map" 검증

3/3 실패 확인 (14 baseline pass 보존).

### 4. GREEN — MenuPage 갱신
`src/pages/customer/MenuPage.jsx`:
- import 1행 추가 (`TableMapCTA`)
- JSX 한 줄: `<RecentOrdersSection />` 다음, `<CategoryTabs ... />` 앞에 `<TableMapCTA />` 삽입
- 페이지 라인 수: 72 → **74줄** (≤120 제약 만족)

결과: 17/17 GREEN (MenuPage), 8/8 GREEN (TableMapCTA).

### 5. CSS 추가
`src/styles/components.css` table-lock-badge 직후, prefers-reduced-motion 블록 앞에 삽입:
- `.table-map-cta` — flex 가로 카드, min-height 88px, `var(--color-elevated)` + 옐로우 라디얼 그라디언트 + `var(--color-accent)` 4px 좌측 strip
- `:active` scale + `:focus-visible` outline
- `.table-map-cta__body / __title / __desc / __cue / __arrow / __thumb` 자식 스타일
- 토큰: `--color-elevated`, `--color-ink`, `--color-muted`, `--color-divider`, `--color-accent`, `--font-stencil`, `--radius-md`

### 6. 회귀 보호 확인
헤더 `header-map-link` / `header-cart-link` 모두 손대지 않음 — CustomerLayout.jsx 라인 88-104 unchanged. 기존 회귀:
- `src/components/layouts/__tests__/CustomerLayout.test.jsx` 라인 73 (`getByTestId('header-map-link')`) 및 라인 81-85 (href="/map") 그대로 통과.
- CategoryTabs 5탭 + 필터 회귀 12개 케이스 (`MenuPage.test.jsx`) 통과.

## 테스트 결과

### TableMapCTA + MenuPage 타깃 실행
```
docker compose -f docker-compose.dev.yml exec dev npm test -- --run \
  src/pages/customer/__tests__/MenuPage.test.jsx \
  src/components/organisms/__tests__/TableMapCTA.test.jsx
```
결과: **25/25 passed** (17 MenuPage + 8 TableMapCTA)

### Organism + Layout + Customer 페이지 통합
```
docker compose -f docker-compose.dev.yml exec dev npm test -- --run \
  src/components/organisms src/components/layouts src/pages/customer
```
결과: **384/384 passed** (27 test files)

### 전체 회귀
```
docker compose -f docker-compose.dev.yml exec dev npm test -- --run
```
결과: **1369/1369 passed** (108 test files)
- 이전 1358 → +11 (8 TableMapCTA + 3 MenuPage CTA 통합)

### Lint
```
docker compose -f docker-compose.dev.yml exec dev npm run lint
```
결과: **0 errors, 3 pre-existing warnings** (Untouched: ErrorBoundary.jsx, useApi.js, useGlobalErrorHandler.js — 모두 본 작업과 무관)

### a11y
- TableMapCTA: `<Link>` (native anchor) + aria-label + 의미 있는 텍스트 — axe 위반 없음
- MenuPage 통합: 기존 a11y 테스트 회귀 (no new violations)

## 자기 검토 결과

- [x] CTA에 "테이블 배치도", "주문 전 테이블 위치를 확인해 주세요", "배치도 보기" 3개 카피 모두 포함
- [x] `<Link to="/map">` (인플레이스 모달 만들지 않음)
- [x] `data-testid="home-table-map-cta"` 노출
- [x] MenuPage 안에서 RecentOrdersSection과 CategoryTabs *사이*에 CTA 위치
- [x] 헤더 `header-map-link` 변경 없음 (그대로 유지)
- [x] 인벤토리 `header-cart-link` 변경 없음
- [x] CategoryTabs 5탭 + 필터 회귀 통과
- [x] 새 이미지 자산 생성 없음 (기존 `public/map/table-location.webp` 재사용)
- [x] MenuPage ≤120줄 (74줄)
- [x] 모든 관련 테스트 green (해당 파일 + 전체 1369/1369)
- [x] lint 0 errors (기존 3 warnings 유지)

## 다음에 할 것

- Subagent 2 (Takeout READY→SETTLED): 별도 흐름.
- Subagent 3 (Regression QA + 문서 동기화): CLAUDE.md design_fix_v4 라운드 추가.
