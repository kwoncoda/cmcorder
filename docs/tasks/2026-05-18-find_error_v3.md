# 2026-05-18 — find_error_v3 (수정사항_v3 6항목)

## 목표

실사용 테스트에서 발견된 6항목을 수정한다.

1. 쿠폰 중복 사용을 학번(`student_id`) 기준으로 차단 (이름이 달라도 재사용 X)
2. 관리자 내역 탭을 전체/주문/메뉴/시스템 구조로 확장 + 메뉴/시스템 이벤트 기록
3. 어드민 메뉴 페이지에 메뉴별 효과 정보 표시
4. 어드민 nav에서 이체확인 탭 제거 (라우트/API/컴포넌트는 보존)
5. 쿠폰 문구 단순화 + `admin1` 표시를 `어드민`으로
6. 관리자 UI/UX를 `docs/design-bundle` 기준으로 개선 + 이모지 제거 + 취소 버튼 톤 다운

## 사용한 워크플로

Superpowers `subagent-driven-development` + `test-driven-development`. subagent 5개 *순차* 실행 (동시 실행 금지). 각 subagent는 (1) 실패 테스트 작성 (2) 실패 확인 (3) 최소 구현 (4) 통과 확인 순서.

| 순서 | subagent | 핵심 산출 |
|---|---|---|
| 1 | Coupon Policy Agent | `used_coupons` UNIQUE를 `(student_id, name)`→`(student_id)`로 변경. `coupon.js`/`coupon-repo.js`/`bootstrap.js` 마이그레이션 `004-coupon-student-unique`. 1086/1086 통과. |
| 2 | Admin History/Event Agent | 신규 `admin_events` 테이블 + `admin-events-repo.js` + `GET /admin/api/history?type=all\|orders\|menus\|system` 통합 응답. 메뉴 toggle / business open / admin login / auto snapshot 이벤트 기록. `HistoryPage.jsx` 4탭 필터. 1115/1115 통과. |
| 3 | Admin Menu Effects Agent | `src/constants/menu-effects.js` 신규 (MENUS의 `sub`에서 derive). `MenuAdminPage.jsx`의 효과 컬럼에서 `effectForCode(m.code)` 호출. DB/API 미수정. 1124/1124 통과. |
| 4 | Admin Navigation & Copy Agent | `AdminLayout` nav 6 → 5 (이체확인 제거, 라우트/API 보존). 쿠폰 라벨 `🎫 쿠폰 사용 (컴모융 학생 한정 1,000원 할인)` → `컴모융 학생 1,000원 할인`. 학과 코드 안내 문구 삭제. `displayActor` helper로 admin1 → 어드민 변환. 1141/1141 통과. |
| 5 | Admin UI Design Agent | CLOSED 시 `.start-cta` 카드 안에 `<StartBusinessCTA>` 배치 + 6컬럼 동시 렌더. 어드민 페이지 텍스트 이모지 9곳 제거 (OPEN dot은 CSS `.biz-dot` / `.open-status .open-dot::before`로 유지). `.col`/`.col-head`/`.col-body`/`.order-card` 클래스 적용. `.btn-danger-outline`로 취소 버튼 톤 다운. 1153/1153 통과. |
| 사후 | (controller) | `package.json` build 스크립트 `vite build` → `NODE_ENV=production vite build`로 명시. dev 컨테이너의 `NODE_ENV=development`가 prod 번들에 axe-core를 흘려보내는 사전 잠재 회귀 차단 (운영 경로 사이드체크). |

## 만든 것 / 한 일

### 정책 변경

- 쿠폰 중복 기준 = `student_id` 단일. 같은 학번은 이름을 바꿔도 쿠폰 재사용 불가. 쿠폰 없이 일반 주문은 가능. 에러 코드 `ALREADY_USED`, 메시지 `이미 쿠폰을 사용한 학번이에요.`.
- 자동 백업 / 관리자 로그인 / 장사 시작 / 메뉴 품절·해제·가격 변경이 어드민 내역 시스템·메뉴 로그로 기록.
- 어드민 화면 표시 `admin1` → `어드민` (내부 actor 값은 보존, 표시 계층에서만 변환).

### 신규 파일

- `server/repositories/admin-events-repo.js` — `logAdminEvent` + `listAdminEvents(category 필터)`.
- `server/repositories/__tests__/admin-events-repo.test.js` — 7 케이스.
- `src/constants/menu-effects.js` — `MENU_EFFECT_BY_CODE` (frozen, MENUS에서 derive) + `effectForCode(code)`.
- `src/constants/__tests__/menu-effects.test.js` — 5 케이스.
- `src/utils/admin-display.js` — `displayActor(actor)` (`admin`/`admin1` → `어드민`).
- `src/utils/__tests__/admin-display.test.js` — 8 케이스.
- `src/components/layouts/__tests__/AdminLayout.test.jsx` — nav 5종 / biz-badge dot / admin1 부재 7 케이스.

### DB 스키마 / 마이그레이션

- `init.sql`: `used_coupons.UNIQUE(student_id, name)` → `UNIQUE(student_id)`. 신규 `admin_events` 테이블 + 3 인덱스 (idempotent CREATE IF NOT EXISTS).
- `bootstrap.js`: 마이그레이션 `004-coupon-student-unique` (idempotent table-rebuild) + `005-admin-events`.

### 백엔드 라우트

- `routes/admin.js`:
  - `POST /admin/login` 성공 → `ADMIN_LOGIN` system 이벤트.
  - `POST /admin/api/business/open` 실제 전환 → `BUSINESS_OPEN` system 이벤트 (멱등 시 skip).
  - `POST /admin/api/menus/:id/toggle` → patch 항목별 menu 이벤트 (`SOLDOUT_ON/OFF`, `RECOMMEND_ON/OFF`, `PRICE_CHANGED`). before==after면 skip.
  - `GET /admin/api/history?type=all|orders|menus|system` → `order_events` + `admin_events` 통합 응답 (created_at DESC, ISO 8601 Z).
- `jobs/auto-snapshot.js`: `tick()` 성공 시 `AUTO_BACKUP` system 이벤트. note=zip 파일명.

### 프론트엔드

- `AdminLayout.jsx`: ITEMS 5종 (이체확인 제거). biz-badge 이모지 → `.biz-dot.is-open/is-closed` CSS dot. `admin1` → `displayActor('admin1')`.
- `HistoryPage.jsx`: 4탭 필터 (전체/주문/메뉴/시스템) + 카운트 + 빈 상태. actor 표시 `displayActor()` 사용. 117줄.
- `DashboardPage.jsx`: CLOSED 시 `.start-cta` 카드 안에 `<StartBusinessCTA>` 배치 + `<div className="admin-board">` 6컬럼 동시 렌더. 어드민 이모지 5곳 제거. 116줄.
- `MenuAdminPage.jsx`: `effectForCode(m.code)` 호출. 이모지 5곳 제거 (`🍽️`/`💡`/`✓`→`저장`/`✕`→`취소`/`🔥`).
- `CouponsPage.jsx`, `SettlementPage.jsx`, `TransfersPage.jsx`: 어드민 이모지 제거.
- `CheckoutPage.jsx`: 쿠폰 라벨 단순화 + 학과 코드 안내 문구 제거.
- `AdminCardColumn.jsx`: `.col`/`.col-head`/`.col-body` + `.order-card`/`.order-card.warn`/`.order-card.danger` 클래스 추가. variant=`danger` 액션 → `btn-danger-outline`.
- `StartBusinessCTA.jsx`, `BusinessStateBadge.jsx`: 이모지 제거 (CSS dot 사용).
- `components.css`: `.biz-dot`, `.open-status .open-dot::before`, `.btn-danger-outline` 신규 (~39줄).

### 빌드 안정화

- `package.json`: `build` 스크립트에 `NODE_ENV=production` prefix. dev 컨테이너 환경변수가 prod 빌드를 오염시켜 axe-core가 dist에 흘러들어가던 회귀를 사전 차단 (운영 컨테이너 빌드 경로 보호).

## 테스트 결과

```
docker compose -f docker-compose.dev.yml exec dev npm test -- --run
→ Test Files 101 passed (101)
→ Tests       1153 passed (1153)  (이전 main 1009 + 신규 144)

docker compose -f docker-compose.dev.yml exec dev npm run lint
→ 0 errors, 3 사전 warnings (변경 무관: ErrorBoundary, useApi, useGlobalErrorHandler 의 사용되지 않는 eslint-disable 주석)

docker compose -f docker-compose.dev.yml exec dev npm run build
→ ✓ built in 5.18s
→ dist/assets/index-Dex4nj5F.js 303.77 kB │ gzip: 94.66 kB (단일 entry — axe-core 흔적 0)
→ admin lazy chunks: DashboardPage 10.71kB, MenuAdminPage 5.77kB, HistoryPage 2.87kB, etc.
```

### 신규 테스트 카테고리

- coupon.test.js: +5 (student_id 단일 기준)
- customer.test.js: +4 (학번 재사용 차단 / 일반 주문 가능)
- admin-events-repo.test.js: +7 (logAdminEvent / listAdminEvents)
- admin.test.js: +15 (history type 필터 / menu toggle / business open / login)
- auto-snapshot.test.js: +1 (AUTO_BACKUP 이벤트)
- HistoryPage.test.jsx: +5 (4탭 필터 / actor 변환)
- menu-effects.test.js: +5 (효과 매핑)
- MenuAdminPage.test.jsx: +4 (효과 표시)
- admin-display.test.js: +8 (actor 변환)
- AdminLayout.test.jsx: +7 (nav 5종 / biz-badge dot)
- CheckoutPage.test.jsx: +3 (쿠폰 문구)
- App.test.jsx: 수정 (transfers nav 부재)
- AdminCardColumn.test.jsx: +6 (.col + .order-card + btn-danger-outline)
- BusinessStateBadge.test.jsx: +2 (.biz-dot)
- DashboardPage.test.jsx: +3 (CLOSED 6컬럼 + start-cta 카드 내부)

총 +75 신규, 기존 회귀 보존 100%.

## 운영 경로 사이드체크 (ADR-033 4단계)

- 정적 자산 prefix 변경 X — CLOSED 가드 화이트리스트 회귀 없음 (`business-state.test.js` 16 케이스 통과).
- nginx 설정 변경 X.
- 서버 미들웨어 변경 X — 라우트는 endpoint 추가만 (`/admin/api/history?type`은 기존 endpoint 확장).
- DB 스키마 변경 ★ — `used_coupons.UNIQUE` 제약 변경 + `admin_events` 신설. 마이그레이션 `004`/`005`가 신규/구 DB 모두 idempotent 처리 (검증된 in-memory 시뮬레이션).

## 다음에 할 것 (선택)

- 운영 컨테이너 (`chickenedak`) rebuild: `docker compose build app && docker compose up -d` 후 `curl -sI http://localhost/admin/api/history` 등으로 응답 코드·헤더 회귀 확인. **destructive 아니지만 운영 재가동 = 사용자 결정.**
- `bundle.test.js`의 needsBuild() 분기가 dev 컨테이너 `NODE_ENV=development` 상황에서 stale dist를 그대로 쓰면 통과해 버리는 corner case가 있음. 사후 build 스크립트가 `NODE_ENV=production` 강제로 해결했지만, ADR-033 문서나 CLAUDE.md에 dev 컨테이너 빌드 시 NODE_ENV 주의 한 줄을 추가하면 더 안전.

## Codex 리뷰 후속 수정 (2026-05-18 추가 — P1 2건 + P2 3건)

Codex가 작성한 `codereview/codex_find_error_v3_review.md` 기준 후속 수정.

### P1-1 — Windows-compatible build script
- `package.json:9`: `"build": "NODE_ENV=production vite build"` → `"build": "cross-env NODE_ENV=production vite build"`.
- `cross-env@^10.1.0`을 devDependency로 추가. `package-lock.json`에 반영.
- 검증: Windows 호스트 `npm install` + `npm run build` 성공 (단일 entry 303.79kB / gzip 94.65kB, axe-core 흔적 0). docker dev 컨테이너 `npm run build` 동일 결과.

### P1-2 — ADMIN_LOGIN을 system history에 노출
- `server/routes/admin.js`: POST /admin/login 성공 시 `logAdminEvent`에 `operating_date: getBusinessState(db).operating_date`를 채움 (이전: NULL → `listAdminEvents`의 `operating_date = ?` 조건에서 자동 제외되어 system 탭 미노출).
- `server/repositories/admin-events-repo.js`: `listAdminEvents` 주석을 P1-2 변경 정책에 맞게 갱신 — 모든 admin_events 기록 지점은 operating_date를 채워야 함.
- 통합 테스트 5건 추가 (`POST /admin/login admin_events 기록` describe):
  - `ADMIN_LOGIN.operating_date === business_state.operating_date`
  - `GET /admin/api/history?type=system&date=...` 에서 ADMIN_LOGIN 노출
  - `type=all`에도 포함
  - `type=orders`/`type=menus`에는 미노출
- 기존 history 통합 테스트 5건은 새 정책상 `type=orders` 명시로 ADMIN_LOGIN 영향 분리 (의도: 주문 로그 회귀 보호). `type=all (default)` 케이스는 expect 길이를 `2 → 3`으로 보정 (CREATED + SOLDOUT_ON + ADMIN_LOGIN).

### P2-a — history type 파라미터 검증
- `server/routes/admin.js`: `HISTORY_TYPE_ALLOWLIST = new Set(['all','orders','menus','system'])`. 잘못된 type은 400 `INVALID_HISTORY_TYPE`.
- 통합 테스트 2건 (`type=garbage` → 400 + each allowed type 200).

### P2-b — StatusChip + OrderTimeline 어드민 이모지
- `StatusChip.jsx`: `showIcon` prop 추가 (default `true` — 고객 화면 회귀 보존). false면 이모지 미렌더.
- 어드민 호출처 3곳에 `showIcon={false}` 전달:
  - `AdminCardColumn.jsx:148` (대시보드 카드 안 status chip)
  - `OrderDetailPage.jsx:68` (주문 상세 헤더 status chip)
  - `TransfersPage.jsx:83` (이체 확인 페이지 status chip)
- `OrderTimeline.jsx`: 미니뷰의 `✅/🔄/⏳` 이모지를 `.timeline-mini-dot` CSS dot으로 영구 교체. 미니뷰는 `OrderDetailPage` (어드민)에서만 활성화되고 고객 `StatusPage`는 `showMiniview={false}`라 영향 없음.
- `components.css`: `.timeline-mini-dot`, `.timeline-mini-dot--done/--current/--future` 클래스 신규 (state별 색·외곽선).
- 회귀 테스트 4건:
  - `StatusChip.test.jsx`: `showIcon={false}` 이모지 미렌더, default true 이모지 노출 (2건)
  - `OrderTimeline.test.jsx`: `.timeline-mini-dot` 5개 + `--done`/`--current`/`--future` 분포 + 이모지 미노출 (1건)

### P2-c — 메뉴 변경과 로그 기록 트랜잭션
- `server/routes/admin.js`: POST /admin/api/menus/:id/toggle을 `db.transaction(() => { toggleMenu + logMenuPatchEvents })` 단일 트랜잭션으로 묶음. 로그 INSERT 실패 시 메뉴 변경도 ROLLBACK.
- 회귀 테스트 1건: `admin_events` 테이블 DROP 시뮬레이션 → toggle 응답 500 + `menus.sold_out` 그대로 (ROLLBACK 검증).

### Codex P3 잔존 (병합 후 가능)
- `HistoryPage.jsx`의 탭 카운트가 현재 탭 응답만 기준 (전체 카운트 아님). 별도 summary API 필요 시 후속.
- 통합 정렬의 동일 created_at tie-break가 약함. 운영 시 결정적 정렬이 필요하면 `(created_at, source, id)`로 보강.
- `bootstrap.js` 004 마이그레이션의 임의 구버전 대응. 운영 DB 실제 발생 후 재검토.

### 최종 회귀
```
docker compose -f docker-compose.dev.yml exec dev npm test -- --run
→ Test Files 101 passed (101) / Tests 1167 passed (1167)   (1153 → +14)

docker compose -f docker-compose.dev.yml exec dev npm run lint
→ 0 errors / 3 사전 warnings

docker compose -f docker-compose.dev.yml exec dev npm run build
→ ✓ built in 5.55s, 단일 entry 303.79kB / gzip 94.65kB, axe-core 0

Windows host: npm install + npm run build
→ ✓ built in 7.56s, 동일 출력 (cross-env로 NODE_ENV=production 적용)
```

## 깨지면 안 되는 것 — 보존 확인

- ADR-019 학번 정규식 `^\d{2}\d{2}37\d{3}$` ✓
- ADR-020 Pattern B (서버 가격 자체 계산) ✓
- ADR-021 (학번+이름 필수 / external_token) ✓ (used_coupons에서 name은 감사용으로 보존)
- ADR-025 13 합법 전이 ✓
- ADR-012 정산 마감 가드 ✓
- G13 영업 상태 머신 ✓
- ADR-024 React 18 SPA ✓
- §3.5 React 가이드 8조 (페이지 ≤120줄) ✓ (HistoryPage 117, DashboardPage 116)
- ADR-033 docker 전용 ✓ (모든 dev/test/build를 `docker compose -f docker-compose.dev.yml exec dev` 경유)
