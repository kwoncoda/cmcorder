# 2026-05-19 — design_fix_v4 라운드 종합 작업 로그

D-day(5/20 16:30 운영 시작) 직전 사용자 명시 두 건 반영. **새 ADR 신설 없이** ADR-024(React SPA) / ADR-025(주문 상태 머신) 보존 범위 안에서 UX·운영 흐름 보정. 서브에이전트 1·2·3 분담.

## 목표 (사용자 명시 2건)

1. **홈 메뉴 페이지 카테고리 바 위에 좌석 배치도 CTA를 신규 추가.** 클릭 시 기존 미니맵 모달(`/map`)을 재사용. 헤더의 작은 미니맵 버튼은 그대로 유지.
2. **포장(`takeout`) 주문은 `READY → SETTLED` 직접 전이.** 매장 식사(`dineIn`)는 기존 `READY → DINING → SETTLED` 유지. 운영자 라벨은 둘 다 **"전달 완료"**. 포장은 DINING 컬럼에 표시되지 않음 (테이블 점유 의미 없음).

## 만든 것

### Subagent 1 — TableMapCTA + MenuPage 통합 (커밋 `da50102`)

- 신규 organism `src/components/organisms/TableMapCTA.jsx` (47줄)
  - `<Link to="/map">` 단일 anchor wrapper
  - `data-testid="home-table-map-cta"` + `aria-label="테이블 배치도 보기"`
  - 카피 3종: "테이블 배치도" / "주문 전 테이블 위치를 확인해 주세요" / "배치도 보기"
  - 우측 썸네일 `public/map/table-location.webp` (lazy, alt="") — 기존 자산 재사용 (신규 자산 0)
- `src/components/organisms/__tests__/TableMapCTA.test.jsx` (8 케이스)
- `src/styles/components.css`: `.table-map-cta` 외 5개 클래스 추가 (다크/옐로우 토큰, min-height 88px, `:focus-visible` outline)
- `src/pages/customer/MenuPage.jsx`: import 1행 + JSX 한 줄 (`RecentOrdersSection → TableMapCTA → CategoryTabs` 순서, 페이지 74줄 — ≤120 제약 만족)
- `src/pages/customer/__tests__/MenuPage.test.jsx`: design_fix_v4 통합 3 케이스 추가 (CTA 렌더, DOM 순서, href="/map")

### Subagent 2 — 포장 주문 READY → SETTLED 직접 전이 (커밋 `68fda3f`)

- `server/domain/order-state.js`: `canTransition` / `transition` 에 옵셔널 `opts.deliveryType` 인자
  - `deliveryType==='takeout' && from==='READY'` 분기: `to==='SETTLED'` → true, `to==='DINING'` → false (방어선)
  - 그 외 모든 케이스 fall-through → `LEGAL_TRANSITIONS` 표
  - `LEGAL_TRANSITIONS` 객체 자체는 *변경하지 않음* — DONE dead-status 메타 회귀 보호 + table_lock 흐름 그대로
- `server/routes/admin.js`: `POST /admin/api/orders/:id/transition` 라우트에서 `transition(order.status, to, { deliveryType: order.delivery_type })` 호출
  - **위치 결정**: work_instruction §B는 `updateOrderStatus`(repo)에서 transition 호출하라고 권고했지만, 실제 구현은 admin.js 라우트에 유지. 사유 — 기존 책임 경계(repo는 단순 UPDATE / 라우트가 전이 검증) 존중 + 단일 호출자 경로라 우회 위험 0. code reviewer 권고 2번을 따라 DECISIONS.md에 1줄 명시.
- `src/components/organisms/AdminCardColumn.jsx`: `ACTION_BY_STATUS` 상수 유지 + 신규 분기 함수 `getActionsForOrder(order)` — `READY + takeout` → `to: 'SETTLED'`, 그 외 표 그대로
- `server/domain/__tests__/order-state.test.js`: takeout/dineIn 분기 9 케이스 + DONE 메타 회귀 유지
- `server/repositories/__tests__/order-repo.test.js`: takeout READY → SETTLED → `settled_at` 기록 + `dining_at` 미기록 회귀 1 케이스
- `server/routes/__tests__/admin.test.js`: POST transition 4분기 (takeout↔dineIn × DINING↔SETTLED) + 기존 픽스처 `delivery_type` 정합
- `src/components/organisms/__tests__/AdminCardColumn.test.jsx`: READY takeout/dineIn 버튼 분기 2 케이스 + delivery_type 누락 시 dineIn 기본 회귀

### Subagent 3 — 회귀 매트릭스 통과 + 문서 동기화 (본 커밋)

- `server/domain/__tests__/order-state.test.js`: P3 권고 1번 — `takeout READY → CANCELED` 합법 (fall-through) 명시 회귀 expect 1줄 추가
- `docs/DECISIONS.md`: design_fix_v4 라운드 변경 노트 추가 (변경 요약 + 결정 근거 + 구현 위치 좌표 + 회귀 보호 + spec/구현 위치 차이 1줄)
- `CLAUDE.md`: "절대 깨지면 안 되는 것"에 design_fix_v4 라운드 한 줄 + 헤더 테스트 카운트 1358 → 1385 갱신
- `docs/IMPLEMENTATION_PROGRESS.md`: design_fix_v4 라운드 매트릭스 표 한 섹션
- `docs/tasks/2026-05-19-design-fix-v4-summary.md`: 본 종합 로그 신규

## 한 일 (Subagent별 변경 라인 수 + 커밋 SHA)

| Subagent | 커밋 SHA | 변경 파일 수 | 추가 라인 / 삭제 라인 |
|---|---|---|---|
| SA-1 (TableMapCTA + MenuPage) | `da50102` | 4 | 신규 organism + 통합 1행 + CSS + 테스트 8 |
| SA-2 (포장 READY→SETTLED) | `68fda3f` | 5 | 도메인 옵션 + 라우트 1행 + UI 분기 함수 + 테스트 16 |
| SA-3 (회귀 QA + 문서 동기화) | (본 커밋) | 5 | P3 expect 1행 + 문서 4개 동기화 |

## 테스트 결과

### Subagent 1 종료 시점
```
docker compose -f docker-compose.dev.yml exec dev npm test -- --run
→ 1369/1369 passed (108 files)  ← 이전 1358 + TableMapCTA 8 + MenuPage 통합 3
```

### Subagent 2 종료 시점
```
docker compose -f docker-compose.dev.yml exec dev npm test -- --run
→ 1385/1385 passed (108 files)  ← 1369 + order-state 9 + admin 4 + AdminCardColumn 2 + order-repo 1
docker compose -f docker-compose.dev.yml exec dev npm run lint
→ 0 errors, 3 pre-existing warnings
```

### Subagent 3 (본 라운드) 종료 시점
```
docker compose -f docker-compose.dev.yml exec dev npm test -- --run
→ 1385/1385 passed (108 files)
   (P3 권고는 기존 테스트 안에 expect 1줄 추가 — 테스트 카운트 유지)

docker compose -f docker-compose.dev.yml exec dev npm run lint
→ 0 errors, 3 pre-existing warnings

docker compose -f docker-compose.dev.yml exec dev npm run build
→ ✓ built in 6.40s
→ dist/assets/index-CzvZvEDg.js  305.82 kB │ gzip: 95.24 kB
→ axe-core 흔적 0 (bundle.test.js 회귀 통과)
```

### 운영 경로 사이드체크 (ADR-033)
```
docker compose build app && docker compose up -d
curl -sI -X GET http://localhost/                  → 200 OK
curl -sI -X GET http://localhost/menu              → 200 OK
curl -sI -X GET http://localhost/map               → 301 Moved Permanently (Location: /map/)
curl -sI -X GET http://localhost/map/              → 200 OK
curl -sI -X GET http://localhost/api/business-state → 200 OK
```

- `/map` 301은 Express `express.static('public', ...)` 의 디렉토리 trailing-slash 자동 redirect (디자인 변경 영향 아님 — `public/map/table-location.webp` 디렉토리 존재 때문).
- React Router는 SPA fallback이 `/map` 경로를 받아 처리하므로 사용자 흐름에는 무영향. 헤더 `header-map-link` 와 신규 `home-table-map-cta` 둘 다 `<Link to="/map">` (클라이언트 라우팅, HTTP redirect 미발생).
- 정적 자산이 CLOSED 가드에 가로채이지 않음 — business-state OPEN 상태에서 `/`, `/menu`, `/api/business-state` 모두 200 회귀.

### P3 권고 적용 (Subagent 3 신규)

`server/domain/__tests__/order-state.test.js` "★ takeout 분기는 READY 외 상태에서는 LEGAL_TRANSITIONS 표를 따른다" 테스트 내부에 expect 1줄 추가:

```js
// P3 권고 (code reviewer): takeout READY → CANCELED 도 fall-through 합법
// — 포장이라도 READY 단계에서 *취소될 수 있어야* 한다. 명시 회귀 보호.
expect(canTransition('READY', 'CANCELED', { deliveryType: 'takeout' })).toBe(true);
```

통과 — 기존 fall-through 동작이 이미 정답. 회귀 보호용 명시.

## 절대 깨지면 안 되는 회귀 확인 (CLAUDE.md 매트릭스)

- **ADR-020 Pattern B**: 가격 재계산 회귀 13건 통과
- **ADR-019**: 쿠폰 학번 정규식 회귀 12건 통과
- **ADR-021**: 학번+이름 필수, 외부인 토큰 통과
- **ADR-034**: 쿠폰 `(student_id)` UNIQUE + `admin_events` history 통과
- **ADR-025**: 주문 상태 머신 — LEGAL_TRANSITIONS 객체 자체 변경 없음. DONE dead-status 메타("DONE은 어떤 합법 전이의 우변에도 등장하지 않는다") 통과
- **G13 영업 상태 머신**: business_state 통과
- **ADR-012**: 정산 마감 가드 통과
- **ADR-023**: Docker compose + named volume 통과
- **ADR-024**: React 18 SPA 통과
- **§3.5 React 가이드 8조**: MenuPage 74줄 (≤120) · CheckoutPage 등 페이지 라인 제약 · 부록 D 5건 통과
- **ADR-033**: Docker 전용 검증 — 본 라운드 모든 명령이 `docker compose -f docker-compose.dev.yml exec dev` 패턴. 정적 자산 화이트리스트 16건 회귀 통과.
- **table_lock 라운드 (2026-05-19)**: `READY → DINING → SETTLED` (dineIn 흐름) 그대로. 어드민 잠금 페이지 무변경. 회귀 영향 0.
- **design_fix_v3 라운드 (2026-05-19)**: 미니맵 legend 부재 + ALREADY_USED 모달 회귀 그대로 통과. 회귀 영향 0.

## 다음에 할 것

- **D-day 5/20 16:30 운영 시작 전 수동 QA** (운영자 직접 확인):
  - 모바일 `/menu`에서 카테고리 바 위 CTA 카드 노출 + 탭 시 미니맵 모달 진입
  - 포장 주문 한 건 흐름: ORDERED → TRANSFER_REPORTED → PAID → COOKING → READY → SETTLED (DINING 컬럼에 표시되지 않는지 확인)
  - 매장 식사 주문 한 건 흐름: 위 + READY → DINING → SETTLED 정상
  - 어드민 대시보드 READY 카드 — takeout 카드 버튼 라벨 "전달 완료" 클릭 시 SETTLED 진입, dineIn 카드 버튼 라벨 "전달 완료" 클릭 시 DINING 진입
  - 정산 마감 — takeout SETTLED 매출이 일간 집계에 포함되는지 확인
- 운영 컨테이너는 본 라운드 머지 후 `docker compose build app && docker compose up -d` 1회 필요.
