# 아키텍처 설계서 — 오늘 저녁은 치킨이닭!

> ⚠️ **최신 결정 우선 (2026-05-15 갱신 — `docs/CODEX_REVIEW_v2_FIX_SUMMARY.md`):** §4.3 SSE Hub → 5초 폴링 (ADR-015 변경, 서버 SSE 라우트 미구현). §11 PII 폐기 → 운영자 수동 (ADR-027). 본문 SSE 다이어그램과 sse Hub 자료구조는 historical 보존. 코드는 `useOrderPolling` 기반.

**작성일:** 2026-05-04 (`/plan-eng-review` 1차)
**관련 문서:** `order-system-plan.md` (7차본), `DECISIONS.md` (ADR-001~031), `API_DRAFT.md`, `DB_DRAFT.md`, `TEST_PLAN.md`
**상태:** DRAFT — 구현 시작 전 최종 검토 단계

---

## 0. 문서 목적

`order-system-plan.md`의 *기획·정책·UX*를, 이 문서는 *코드 구조·데이터 흐름·운영 절차*로 옮긴다. 구현자(자기 자신·후임 학생회)가 코드를 보지 않고도 시스템 전체 구조를 한 번에 파악할 수 있게 하는 것이 목표.

---

## 1. 시스템 컨텍스트

```
                         ┌──────────────────────────┐
                         │    학생회 노트북 (호스트)   │
                         │  ┌────────────────────┐  │
                         │  │  Docker Container  │  │
                         │  │  ┌──────────────┐  │  │
   ┌─────────────┐       │  │  │  Node 20     │  │  │      ┌──────────────┐
   │ 사용자 폰   │◀──────┼──┼──│  Express     │  │  │      │ 운영진 노트북 │
   │ (모바일 웹) │       │  │  │  + EJS·Alpine│  │  │◀─────│ 또는 폰      │
   └─────────────┘  HTTP │  │  └──────┬───────┘  │  │ HTTP │  (관리자/본부)│
        ▲                │  │         │SSE, REST│  │      └──────────────┘
        │                │  │         ▼          │  │
        │                │  │  ┌──────────────┐  │  │
        │                │  │  │  better-     │  │  │
        │                │  │  │  sqlite3     │  │  │
        │                │  │  └──────┬───────┘  │  │
        │                │  │         │ FS R/W   │  │
        │                │  └─────────┼──────────┘  │
        │                │            ▼             │
        │                │  ┌─────────────────────┐ │
        │                │  │  Docker Volume       │ │
        │                │  │  /app/data/          │ │
        │                │  │   ├── db.sqlite      │ │
        │                │  │   ├── backups/       │ │ (자동 30분 ZIP, ADR-022)
        │                │  │   ├── images/        │ │ (메뉴 이미지)
        │                │  │   └── logs/          │ │
        │                │  └─────────────────────┘ │
        │                └──────────────────────────┘
        │
        │                         ┌─────────────────┐
        └───── 카카오뱅크앱 ──────│ 본부 담당자 폰   │ (시스템 외부)
               알림 수신           └─────────────────┘
```

**외부 의존성:** 학교 와이파이(또는 LTE 핫스팟), 학생회 통장 알림(시스템 외부, 본부 담당자 수동 확인).
**외부 시스템과의 자동 연동 0** (PG·은행 API·OCR·SMS 모두 미사용, ADR-009 + 의도적 결정).

---

## 2. 기술 스택 (ADR-024)

| Layer | 선택 | 버전 |
|---|---|---|
| Runtime | Node.js | 20 LTS |
| Language | JavaScript + JSDoc | ES2023 |
| HTTP framework | Express | 4.x |
| DB | SQLite (better-sqlite3) | 3.x / 11.x |
| 마이그레이션 | raw SQL 파일 + 부팅 시 적용 (`server/db/init.sql`) | — |
| **프론트엔드 (ADR-024 변경 2026-05-14)** | **React 18 SPA + Vite 5** | 18.3 / 5.4 |
| 상태 관리 | Zustand (셀렉터 강제, 모달 stack만 전역) | 5.x |
| 라우팅 | React Router (사용자 정적 / 관리자 lazy) | 6.30 |
| CSS | Tailwind CSS 3 + tokens.css 변수 | 3.4 |
| 검증 | zod (런타임 입력·응답·스키마) | 4.x |
| 로깅 | pino | 9.x → 10.x |
| ZIP | archiver | 7.x → 8.x |
| 세션 (관리자) | express-session (메모리 store) — 운영 단일 컨테이너 | 1.x |
| 보안 헤더 | helmet | 8.x |
| 환경변수 | dotenv | 16.x → 17.x |
| 테스트 | Vitest 2 + RTL 16 + vitest-axe + Playwright 1 | — |
| 배포 | Docker + docker compose + named volume | (ADR-023) |
| 단위/통합 테스트 | Vitest | 2.x |
| E2E | Playwright | 1.x |

**TypeScript 미채택 근거:** D-day 16일 솔로 일정에서 빌드·타입 에러 디버깅 비용이 절약되는 버그 비용보다 큼. JSDoc + zod 스키마로 *경량 타입 안정성* 확보.

---

## 3. 컴포넌트 분해

```
src/
├── server.js                       # 부트스트랩 (DB init, migrations, app listen)
├── app.js                          # Express app 설정 (미들웨어, 라우터 마운트)
├── config.js                       # 환경변수 로딩, 상수
│
├── db/
│   ├── connection.js               # better-sqlite3 인스턴스, WAL 설정
│   ├── migrations/                 # NNN-name.sql (부팅 시 순서대로 적용)
│   │   ├── 001-init.sql
│   │   ├── 002-orders.sql
│   │   └── ...
│   └── repositories/               # 테이블 단위 raw SQL 함수
│       ├── menu-repo.js
│       ├── order-repo.js
│       ├── coupon-repo.js
│       ├── settlement-repo.js
│       └── admin-repo.js
│
├── domain/                         # 비즈니스 로직 (DB·HTTP 무관)
│   ├── pricing.js                  # ★ ADR-020 Pattern B 가격 자체 계산
│   ├── coupon-validation.js        # ★ ADR-019 학번 prefix·중복 검증
│   ├── order-state.js              # ★ ADR-006 상태 전이 머신
│   ├── transfer-matching.js        # 통장 신고 매칭 정책 (§6.4)
│   ├── settlement.js               # 마감 가드(ADR-012) + 스냅샷 생성
│   └── popularity.js               # ADR-017 인기 랭킹·동적 카피 규칙
│
├── routes/
│   ├── customer/                   # 사용자용 (모바일)
│   │   ├── home.js                 # 메뉴·약도
│   │   ├── orders.js               # 주문, 이체 확인, 조리 현황 SSE
│   │   └── kitchen-status.js       # 조리 현황판 (학번/토큰 인증)
│   ├── admin/                      # 관리자·본부 (PC/태블릿)
│   │   ├── auth.js                 # PIN 로그인
│   │   ├── dashboard.js            # 본부 5단계 카드
│   │   ├── orders.js               # 주문 상세·상태 토글
│   │   ├── transfers.js            # 이체 확인 화면
│   │   ├── menus.js                # 메뉴 CRUD·품절 토글
│   │   ├── coupons.js              # 쿠폰 사용 내역·거부 로그
│   │   ├── settlement.js           # 정산 마감·합산
│   │   └── backup.js               # ZIP 다운로드 (수동)
│   └── api/                        # JSON API (Alpine fetch용)
│       ├── menus.js
│       ├── orders.js
│       └── stats.js                # 인기 랭킹
│
├── middleware/
│   ├── error-handler.js            # 전역 에러 핸들러 + pino 로깅
│   ├── admin-auth.js               # express-session 검증
│   ├── customer-token.js           # 외부인 조리 현황판 토큰 쿠키
│   ├── rate-limit.js               # 쿠폰 시도 IP 잠금 (§13.5)
│   └── csrf.js                     # 관리자 폼 CSRF 토큰
│
├── sse/
│   ├── hub.js                      # 주문 ID → 연결 목록 매핑, 이벤트 push
│   └── routes.js                   # GET /orders/:id/stream
│
├── jobs/                           # 백그라운드 스케줄러
│   ├── auto-snapshot.js            # ★ ADR-022 30분 주기 ZIP
│   └── token-cleanup.js            # 외부인 토큰 만료 (24h, ADR-021)
│
└── views/
    ├── layouts/
    │   ├── customer.ejs            # 모바일 (360-430px)
    │   └── admin.ejs               # PC/태블릿 (1024+)
    ├── customer/
    │   ├── menu.ejs
    │   ├── cart.ejs
    │   ├── order-complete.ejs      # 도그태그·계좌·확인 요청 버튼
    │   ├── transfer-report.ejs     # 은행 입력 + 다른 이름 옵션
    │   └── kitchen-status.ejs      # ★ §10.4 SSE 진행 단계
    └── admin/
        ├── login.ejs
        ├── dashboard.ejs
        ├── transfer-confirm.ejs
        ├── menu-manager.ejs
        ├── settlement.ejs
        └── ...

public/                             # 정적 자산
├── css/
│   └── tailwind.css                # Tailwind CLI 출력
├── js/
│   ├── alpine.min.js               # 또는 CDN
│   └── customer-cart.js            # 카트 상태 관리 (Alpine)
└── images/
    └── 웹 로고.png                  # ADR-011 마스코트

tests/
├── unit/
│   ├── pricing.test.js             # ★ ADR-020 4 케이스
│   ├── coupon-validation.test.js
│   ├── order-state.test.js
│   └── settlement.test.js
├── integration/
│   ├── order-flow.test.js
│   ├── admin-auth.test.js
│   └── sse.test.js
└── e2e/
    ├── customer-order.spec.js      # 주문 → 이체 신고 → 조리 현황
    ├── admin-transfer.spec.js
    └── settlement-zip.spec.js

docker/
├── Dockerfile
├── docker-compose.yml              # ADR-023
└── .dockerignore

docs/                               # (이미 존재)
├── order-system-plan.md
├── DECISIONS.md
├── ARCHITECTURE.md                 # 본 문서
├── API_DRAFT.md
├── DB_DRAFT.md
└── TEST_PLAN.md
```

**디렉터리 원칙:**
- `domain/`은 *순수 함수* — DB·HTTP 의존성 0. 단위 테스트가 빠르고 결정적.
- `routes/`는 *얇은 어댑터* — 검증 → domain 호출 → 응답. 비즈니스 로직 X.
- `db/repositories/`는 *raw SQL 모음* — ORM 추상화 없음. 쿼리가 코드에 그대로 보여 디버깅 빠름.

---

## 4. 데이터 흐름 (4가지 핵심 시나리오)

### 4.1 주문 생성 (★ ADR-020 Pattern B)

```
[모바일 브라우저]                 [Express]                      [SQLite]
─────────────────                 ─────────                      ────────
사용자가 카트 확정
   │
   POST /api/orders ────────────▶ routes/api/orders.js
   {                              │
     items:[{menu_id:1,qty:1}],   │ ① zod로 입력 형태 검증
     coupon_code:'',              │   (학번 형식·이름 길이·menu_id 정수)
     student_id:'202637042',      │
     name:'홍길동',                │ ② domain/pricing.js
     is_external: false,          │   for each menu_id:
     pickup:'dine_in', table:9    │     SELECT price FROM menus WHERE id=? AND NOT sold_out
   }                              │   서버가 합계 계산 (클라가 보낸 가격 무시)
                                  │
                                  │ ③ domain/coupon-validation.js (쿠폰 있을 때)
                                  │   - 학번 9자리 정규식
                                  │   - prefix 202637 매칭
                                  │   - used_coupons UNIQUE 체크
                                  │
                                  │ ④ TX BEGIN
                                  │   INSERT orders (...) ──────────▶ orders 테이블
                                  │   INSERT order_items (...) ─────▶ order_items
                                  │   INSERT used_coupons (...) ────▶ used_coupons (쿠폰 시)
                                  │   TX COMMIT
                                  │
   ◀────── 200 {order_no, total} ─┤ ⑤ 외부인이면 토큰 생성·쿠키 설정
                                  │ ⑥ 응답
```

**핵심 가드:** 클라이언트가 보낸 `total` 같은 가격 필드는 *받지도 않음*. zod 스키마에 없음. 서버는 menu_id·qty·coupon_code만 신뢰.

### 4.2 이체 확인 (사용자 → 본부 흐름)

```
[사용자]                          [본부 담당자 화면]
────────                          ─────────────────
주문 완료 → 카뱅앱에서 21,000원 이체 (시스템 외부)

POST /api/orders/:id/transfer ──▶ TX BEGIN
{ bank: '카카오뱅크',                UPDATE orders
  alt_name: null }                   SET status='TRANSFER_REPORTED',
                                       transfer_bank='카카오뱅크',
                                       transfer_at=NOW()
                                     WHERE id=? AND status='ORDERED'
                                   TX COMMIT
                                   SSE push: 'transfer_reported'

                                   본부 대시보드: 카드가 'ORDERED'에서
                                   'TRANSFER_REPORTED' 컬럼으로 이동

본부 담당자가 카뱅앱 통장 알림 확인 → '홍길동 21,000 카뱅' 매칭

POST /admin/orders/:id/confirm-paid ◀─ 본부 담당자가 카드 클릭 후 '이체 확인'
                                   TX BEGIN
                                   UPDATE orders SET status='PAID' WHERE id=? AND status='TRANSFER_REPORTED'
                                   TX COMMIT
                                   SSE push: 'paid'

[사용자 조리 현황판]
  '🍗 입금 확인 완료! 곧 치킨이 출동합니다.' 표시 (진행 단계 progress bar 갱신)
```

**불일치 시 'HOLD':**
- 본부가 'POST /admin/orders/:id/hold' (사유 메모 첨부)
- 사용자 화면: "입력하신 이체 정보와 통장이 안 맞아요. 정보 수정 후 다시 보내주세요."
- 사용자 재신고 → status `TRANSFER_REPORTED` 복귀

### 4.3 조리 현황판 (★ ADR-015 SSE)

```
[사용자]                   [Express + SSE Hub]                [상태 변경 트리거]
────────                   ───────────────────                ─────────────────
GET /api/orders/:id/stream ?student_id=202637042

   ① 인증 (학번+order_no 매칭 또는 토큰+order_no)
   ② Content-Type: text/event-stream
   ③ sse/hub.js: subscribe(order_id, response)
   ④ 현재 상태 즉시 push (서버 → 클라)
                                                              관리자가 '조리 시작' 클릭
                                                              UPDATE orders SET status='COOKING'
                                                              sse/hub.js: emit(order_id, 'cooking')
   ⑤ 클라가 EventSource로 수신 ─────────────────────────────  ◀────  push 'cooking'
   ⑥ Alpine.js: 화면 progress bar 단계 갱신
                                                              관리자가 '조리 완료' 클릭
                                                              UPDATE orders SET status='READY'
                                                              sse/hub.js: emit(order_id, 'ready')
   ⑦ '✅ #17번, 수령 가능해요!' 표시 ◀─────────────────────  ◀────  push 'ready'

   [연결 끊어짐 (와이파이 변경 등)]
   브라우저가 EventSource 자동 재연결 (3초 후 기본)
   ④ 다시 현재 상태 push
```

**SSE Hub 자료구조 (in-memory):**
```javascript
// sse/hub.js
const subscribers = new Map(); // order_id => Set<Response>

function subscribe(order_id, res) {
  if (!subscribers.has(order_id)) subscribers.set(order_id, new Set());
  subscribers.get(order_id).add(res);
  res.on('close', () => subscribers.get(order_id)?.delete(res));
}

function emit(order_id, event) {
  const subs = subscribers.get(order_id);
  if (!subs) return;
  for (const res of subs) res.write(`event: ${event}\ndata: ${JSON.stringify({...})}\n\n`);
}
```

**확장성:** 동시 30 연결 (G3) × 평균 페이로드 100바이트 = 무시 수준. Phase 2 WebSocket 전환은 *대시보드 실시간 동기화* 등 추가 요구 시.

### 4.4 정산 마감 + ZIP 백업 (수동/자동)

```
                  [정산 마감 트리거]
                  관리자가 'POST /admin/settlement/close' 클릭
                            │
                            ▼
                  ┌────────────────────────────┐
                  │ domain/settlement.js       │
                  │ guard: SELECT count FROM   │
                  │   orders WHERE date=?      │
                  │   AND status NOT IN        │
                  │   ('DONE','CANCELED')      │
                  │ count > 0이면 거부          │ ★ ADR-012 T3
                  └────────────┬───────────────┘
                               │
                  ┌────────────▼───────────────┐
                  │ INSERT settlement_snapshot │
                  │ (totals, breakdowns,        │
                  │  closed_at)                 │
                  └────────────┬───────────────┘
                               │
                  GET /admin/settlement/:date/zip 클릭
                               │
                  ┌────────────▼───────────────┐
                  │ archiver:                  │
                  │   manifest.json             │
                  │   orders.json + .csv        │
                  │   coupons.json + .csv       │
                  │   menu-snapshot.json        │
                  │   images/*                  │
                  │   README.txt                │
                  │ → /app/data/backups/manual- │
                  │    YYYYMMDD-HHMMSS.zip      │
                  │ → 클라 다운로드 stream       │
                  └─────────────────────────────┘

[병렬 — ★ ADR-022 자동 스냅샷]
  jobs/auto-snapshot.js setInterval(30 * 60 * 1000)
    if (서버 부팅 후 첫 회 + 매 30분):
      generate ZIP (settlement-summary.pdf 제외)
      → /app/data/backups/auto-YYYYMMDD-HHMMSS.zip
      회전: backups/auto-*.zip 6개 초과 시 가장 오래된 것 unlink
```

---

## 5. 도메인 모델

### 5.1 핵심 엔터티 (`domain/`)

```
┌────────────────────────────────────────────┐
│ Order                                       │
├────────────────────────────────────────────┤
│ id            : INTEGER PK                  │
│ daily_no      : INTEGER (일자별 1부터, ADR-018)│
│ business_date : TEXT  (YYYY-MM-DD)          │
│ status        : ORDER_STATUS                 │
│ student_id    : TEXT? (외부인 NULL)          │
│ customer_name : TEXT  (한글)                 │
│ is_external   : BOOLEAN                      │
│ external_token: TEXT? (외부인 조리 현황판)    │
│ pickup_method : 'dine_in' | 'takeout'       │
│ table_no      : INTEGER?                    │
│ subtotal      : INTEGER  (원)                │
│ discount      : INTEGER                     │
│ total         : INTEGER  ★ 서버 계산값       │
│ transfer_bank : TEXT?                        │
│ transfer_alt_name : TEXT? (다른 이름 이체 시)│
│ transfer_at   : DATETIME?                    │
│ paid_at       : DATETIME?                    │
│ cooking_at    : DATETIME?                    │
│ ready_at      : DATETIME?                    │
│ done_at       : DATETIME?                    │
│ canceled_at   : DATETIME?                    │
│ cancel_reason : TEXT?                        │
│ created_at    : DATETIME                     │
└────────────────────────────────────────────┘

ORDER_STATUS = 'ORDERED' → 'TRANSFER_REPORTED' → 'PAID' → 'COOKING' → 'READY' → 'DONE'
                  └→ 'HOLD' (TRANSFER_REPORTED 매칭 실패) → 'TRANSFER_REPORTED' (재시도)
                  └→ 'CANCELED' (어느 상태에서든)
```

### 5.2 상태 전이 머신 (`domain/order-state.js`)

```
                    [start]
                       │
                       ▼
                  ┌─ORDERED◀──────────────────────┐
                  │     │ user.confirm_transfer    │
                  │     ▼                          │
                  │  TRANSFER_REPORTED             │
                  │     │  ▲                       │
                  │     │  │ user.resubmit         │
        admin     │     │  │                       │
        cancel    │     │  └─HOLD                  │
        any state │     │      ▲                   │
                  │     ▼      │                   │
                  │   PAID    admin.hold (matching │
                  │     │     fail)                │
                  │     ▼                          │
                  │  COOKING                       │
                  │     │                          │
                  │     ▼                          │
                  │   READY                        │
                  │     │                          │
                  │     ▼                          │
                  │   DONE [terminal]              │
                  │                                │
                  └▶ CANCELED [terminal]──────────┘
```

상태 전이 함수: `canTransition(from, to, actor)` 반환값에 명시적 가드. 잘못된 전이는 `IllegalStateTransition` 에러.

### 5.3 Pricing (`domain/pricing.js`) — ADR-020

```javascript
/**
 * @param {Array<{menu_id, qty}>} items
 * @param {string|null} couponCode
 * @param {{prices: Map<menu_id, price>, soldOut: Set<menu_id>}} menuSnapshot
 * @returns {{subtotal, discount, total, lineItems}}
 */
function calculate(items, couponCode, menuSnapshot) {
  // 클라가 보낸 어떤 가격도 받지 않음
  const lineItems = items.map(({menu_id, qty}) => {
    if (menuSnapshot.soldOut.has(menu_id)) throw new MenuSoldOut(menu_id);
    const price = menuSnapshot.prices.get(menu_id);
    if (!price) throw new MenuNotFound(menu_id);
    return { menu_id, qty, unit_price: price, line_total: price * qty };
  });
  const subtotal = lineItems.reduce((s, li) => s + li.line_total, 0);
  const discount = couponCode ? COUPON_AMOUNT : 0;
  const total = Math.max(0, subtotal - discount);
  return { subtotal, discount, total, lineItems };
}
```

테스트 4 케이스는 `TEST_PLAN.md` 참조.

### 5.4 Coupon Validation (`domain/coupon-validation.js`) — ADR-019 + ADR-021

```javascript
/**
 * @returns {{valid: true} | {valid: false, reason: 'format'|'prefix'|'duplicate'|'name'}}
 */
function validate(student_id, name, used_coupons_repo) {
  if (!/^\d{9}$/.test(student_id)) return { valid: false, reason: 'format' };
  // 2026-05-13 변경 (ADR-019): 학번 prefix '202637' → 학과 코드 '37' (위치 5-6) 매칭
  // 컴모융 전 학년 대상 (1학년만이 아닌)
  if (!/^\d{2}\d{2}37\d{3}$/.test(student_id)) return { valid: false, reason: 'department' };
  if (!name || name.trim().length < 1) return { valid: false, reason: 'name' };
  if (used_coupons_repo.exists(student_id)) return { valid: false, reason: 'duplicate' };
  return { valid: true };
}
```

거부 시 IP rate-limit 적용 (§13.5: 같은 IP 5회 초과 → 일시 잠금).

### 5.4 영업 상태 (BusinessState) — *2026-05-13 G13 신규*

> 주문 상태 머신(§5.1)과 *직교*. 시스템 전체 영업 시각 토글.

```
┌────────────────────────────────────────────┐
│ BusinessState (단일 행 — id=1 강제)         │
├────────────────────────────────────────────┤
│ id              : INTEGER PK CHECK (id = 1) │
│ status          : 'CLOSED' | 'OPEN'         │
│ operating_date  : TEXT? (YYYY-MM-DD, OPEN시) │
│ opened_at       : DATETIME? (현재 OPEN 시각) │
│ closed_at       : DATETIME? (마지막 CLOSED) │
│ opened_by       : INTEGER? FK admins(id)    │
└────────────────────────────────────────────┘
```

**상태 머신 (2-state):**

```
[CLOSED]  (default — 시스템 가동 직후, init.sql로 1행 시드)
   │
   │ POST /admin/api/business/open
   │ → status='OPEN', operating_date=TODAY, opened_at=NOW
   ▼
[OPEN]   (사용자 주문 가능)
   │
   │ POST /admin/api/settlement/close (ADR-012 가드 통과)
   │ → settlements INSERT + status='CLOSED' (트랜잭션 1개)
   │ → closed_at=NOW
   ▼
[CLOSED]
```

**불변식:**
- `business_state` 테이블은 *항상 1행만* (id=1 CHECK)
- `status='OPEN'`이면 `operating_date IS NOT NULL` AND `opened_at IS NOT NULL`
- `status='CLOSED'`이면 `closed_at IS NOT NULL` (단 init 직후는 NULL 허용)
- 정산 마감 트리거 시 **OPEN → CLOSED 전이는 정산 스냅샷과 같은 트랜잭션** (원자성 보장)

**사용처:**
- middleware/business-state.js — 모든 사용자 GET 경로에서 CLOSED 시 `/closed` redirect, POST API는 HTTP 423
- routes/admin-business.js — `POST /admin/api/business/open` 라우트
- services/settlement.js — 정산 마감 시 같은 트랜잭션에서 `status='CLOSED'` UPDATE

---

## 6. 인증·권한 흐름

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ROLE 분리                                       │
├─────────────────────────────────────────────────────────────────────┤
│ CUSTOMER (학생/외부인) — 무인증                                          │
│   └─ 자기 주문만 조회: 학번+order_no (학생) / 토큰+order_no (외부인)      │
│                                                                       │
│ ADMIN (관리자) — PIN + 세션                                             │
│   ├─ super_admin: 메뉴 CRUD, 정산 마감, ZIP 다운로드                   │
│   ├─ hub: 이체 확인, 주문 상세                                          │
│   ├─ kitchen: 조리 시작·완료 토글                                       │
│   ├─ pickup: 수령 완료 토글                                             │
│   └─ accountant: 정산 화면 조회                                         │
└─────────────────────────────────────────────────────────────────────┘

★ MVP 단순화: 위 5개 role을 모두 'admin' 단일 role로 운영 (운영진이 화면을
  공용으로 쓰는 학교 축제 환경. RBAC 분리는 Phase 2.)
```

### 6.1 관리자 인증 흐름

```
GET /admin/login           ───▶ 로그인 폼
POST /admin/login          ───▶ middleware/admin-auth.js
{username, pin}                  ① constant-time compare against stored PIN_HASH
                                 ② express-session: req.session.adminId = id
                                 ③ Redirect /admin/dashboard

GET /admin/* (보호 라우터)  ───▶ middleware/admin-auth.js
                                 if (!req.session.adminId) redirect /admin/login
                                 next()

POST /admin/logout         ───▶ req.session.destroy()
```

**PIN 저장:** scrypt 또는 argon2id로 해시. 평문·SHA만 X.
**세션 저장:** connect-sqlite3로 `db.sqlite`에 쿠키 세션 저장 (재시작 후에도 로그인 유지).
**쿠키:** `httpOnly`, `secure: false` (학교 와이파이 환경 — HTTPS 불가능 시), `sameSite: 'lax'`.

### 6.2 사용자 조리 현황판 인증 (ADR-015 + ADR-021)

```
[학생] GET /orders/status?student_id=202637042&order_no=17
  └─ middleware: SELECT * FROM orders WHERE business_date=TODAY
                  AND daily_no=17 AND student_id='202637042'
     → 매칭 시 200, 미매칭 시 401

[외부인] GET /orders/status?token=xyz&order_no=17
  └─ middleware: SELECT * FROM orders WHERE business_date=TODAY
                  AND daily_no=17 AND external_token='xyz'
                  AND token_expires_at > NOW()
     → 매칭 시 200, 미매칭 시 401
```

**토큰 발급:** 주문 시 외부인이면 `crypto.randomBytes(16).toString('hex')` 생성, `external_token` 컬럼 저장 + 쿠키 + URL 쿼리스트링 동시 저장.
**토큰 만료:** 24시간 (`token_expires_at`). `jobs/token-cleanup.js`가 매일 03:00에 만료 토큰 무효화 (실제 삭제는 정산 후 N일 정책에 따름).

### 6.3 CSRF 방어

관리자 폼은 `csurf` 또는 자체 토큰 미들웨어:
- 세션에 토큰 저장
- 폼 hidden input + 검증
- 쿠폰·주문은 *세션 없는 사용자*라 CSRF 적용 안 함 (대신 IP rate-limit)

### 6.4 보안 헤더

`helmet()` 기본 적용 + 다음 커스텀:
- `Content-Security-Policy`: 인라인 script는 Alpine.js만 허용 (`'unsafe-eval'` 미허용)
- `Referrer-Policy`: same-origin

### 6.5 어드민 계정 자동 생성 (init.sql) — *2026-05-13 신규*

> 사용자 요구: "서버 시작 시 init.sql이 작동하여 DB 구성. DB 구성 시 어드민 계정 자동 생성."

**흐름:**

```
서버 부팅 (Node 프로세스 시작, server.js)
   │
   ▼
db/bootstrap.js
   │
   │ ① business_state 행 존재 확인 (id=1)
   │ ② _migrations 테이블 존재 확인
   │
   ├─[양쪽 모두 존재]─▶ 기존 DB. 마이그레이션만 적용 후 정상 부팅
   │
   └─[하나라도 없음]──▶ 신규 DB. init.sql 실행 (db/init.sql)
                          │
                          │ ① 모든 CREATE TABLE
                          │ ② 모든 CREATE INDEX
                          │ ③ business_state 시드 (status='CLOSED')
                          │ ④ admins 시드 — DEFAULT_ADMIN_PIN 환경변수 또는 랜덤 생성
                          │ ⑤ _migrations 테이블에 init 기록
                          │
                          ▼
                       INSERT INTO admins VALUES (
                         'admin',
                         scrypt(env.DEFAULT_ADMIN_PIN || random_pin()),
                         'super_admin'
                       )
                          │
                          ▼
                       랜덤 생성 시 stdout으로 1회 출력
                       (운영 가이드: docker compose logs로 확인)
```

**어드민 시드 정책:**

| 환경변수 | 동작 |
|---|---|
| `DEFAULT_ADMIN_PIN` 명시 (.env) | 해당 PIN을 scrypt 해시로 저장. 6-12자리 숫자 권장 |
| `DEFAULT_ADMIN_PIN` 미명시 | 6자리 랜덤 PIN 생성 + scrypt 해시 저장 + **stdout으로 1회 출력** (`[INIT] Generated admin PIN: 482917 — 운영 시작 전 변경 권장`) |

**보안 고려:**
- 평문 PIN 환경변수 → scrypt 해시 후 즉시 GC. 메모리에 평문 잔존 X
- 랜덤 PIN stdout 출력은 *최초 부팅 1회*만 (마이그레이션에 기록 후 두 번째 부팅 X)
- 운영진은 D-1 리허설 시 PIN 변경 (관리자 페이지 `/admin/pin/change` Phase 2 또는 SQL 수동 UPDATE)
- 컨테이너 로그(`docker compose logs chickenedak`)가 운영진 외 접근 가능하면 PIN 노출 위험 → `.env`에 명시 설정 권장

**복수 admin 시드 (선택, ADR-024 §11 admin role):**

`.env`의 `ADMIN_SEEDS` JSON 배열로 여러 admin 동시 생성:

```env
ADMIN_SEEDS=[
  {"username":"admin","pin":"482917","role":"super_admin"},
  {"username":"hub","pin":"112233","role":"hub"},
  {"username":"kitchen","pin":"445566","role":"kitchen"}
]
```

MVP는 단일 `admin` super_admin만 시드. 복수 admin은 Phase 2.

---

## 7. 실패 시나리오

| # | 시나리오 | 영향 | 시스템 대응 | 운영 대응 |
|---|---|---|---|---|
| 1 | 클라이언트 가격 변조 시도 | 위변조 주문 시도 | 서버 자체 계산 (ADR-020), 클라 가격 무시 | 거부 로그 확인 |
| 2 | 쿠폰 학번 prefix 위조 | 1학년 아닌 학생이 시도 | 거부 + 사유 로그 (`prefix`) + IP rate-limit | 사후 대조 |
| 3 | 동시 동일 학번 쿠폰 | DB race | UNIQUE 제약 → 둘째 INSERT 실패 → 거부 | 첫 사용자만 통과 |
| 4 | 메뉴 마지막 1개 동시 카트 | 둘 다 주문 | 품절 토글 늦게 → 둘 다 INSERT 성공, 운영진 수동 조정 | 부스에서 환불·대체 |
| 5 | 사용자 와이파이 끊김 (조리 현황판) | SSE 연결 끊김 | EventSource 자동 재연결 + 현재 상태 재push | 안내 X (자동 처리) |
| 6 | 본부 담당자 부재 (이체 확인 지연) | 사용자 대기↑ | 5/10분 경과 시 노란/빨간 알림 (대시보드) | 다른 운영진 합류 |
| 7 | 서버 프로세스 크래시 | 일시 다운 | Docker `restart: always` 5초 내 부활 | 본부 화면 응답 안 되면 재로그인 |
| 8 | 디스크 차서 ZIP 생성 실패 | 자동 백업 실패 | pino error 로그 + (Phase 2) 알림 | 본부 노트북 디스크 정리 |
| 9 | DB 파일 손상 | 데이터 일부 손실 | 부팅 시 PRAGMA integrity_check, 실패 시 마지막 자동 ZIP으로 폴백 | USB 백업본 복원 |
| 10 | 정산 마감 시점 진행 주문 1건+ | 마감 거부 | ADR-012 T3 가드 팝업 | 진행 주문 종결 후 재시도 |
| 11 | 호스트 노트북 강제 종료 (배터리·전원) | 전체 다운 | Docker daemon 재가동 시 컨테이너 자동 부팅 | 노트북 충전기 점검·UPS 권장 |
| 12 | 사용자가 주문번호·학번 적힌 화면 캡처 SNS 공유 | 타인 조회 위험 | 학번 매칭이라 학번을 모르면 조회 불가. 외부인은 토큰이라 토큰 길이로 보호 | 안내 |
| 13 | 운영진 PIN 노출 | 무단 관리자 접근 | 즉시 PIN 교체 (super_admin이) + 세션 모두 무효화 | 운영진 회의 |
| **14** | 🟡 **장사 시작 누락 (G13)** | 16:30 오픈 후 사용자가 "영업 시간 아님" 안내만 봄 | 본부 대시보드 CLOSED 상태 + 16:30 이후 5분+ 시 빨간 깜박 + 알림 음 | 운영진 폰 알람 16:25 + 16:30 + D-1 리허설 체크리스트 #1 |
| **15** | 🟡 **init.sql 실패 (DB 초기화 실패)** | 첫 부팅 시 컨테이너 크래시 루프 | server.js 전역 try/catch + pino fatal 로그 + `process.exit(1)` → Docker `restart: always`로 재시도 (3회 후 운영진 개입) | `docker compose logs`로 SQL 에러 확인. SQL 구문 오류면 코드 수정 후 재배포 |
| **16** | 🟡 **정산 마감 + 영업 종료 트랜잭션 부분 실패** | settlements INSERT 성공 + business_state UPDATE 실패 | **단일 트랜잭션 강제** (BEGIN/COMMIT). 한쪽이 실패하면 ROLLBACK | 코드 검증 — 트랜잭션 누락 X 회귀 케이스 |

**Critical gap 0건** — 모두 시스템 또는 운영 절차로 대응됨.

---

## 8. 배포 구조 (ADR-023)

### 8.1 Dockerfile

```dockerfile
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY views ./views
COPY public ./public
COPY db/migrations ./db/migrations
COPY package.json ./
RUN mkdir -p /app/data/backups /app/data/images /app/data/logs
EXPOSE 3000
CMD ["node", "src/server.js"]
```

### 8.2 docker-compose.yml

```yaml
services:
  chickenedak:
    build: .
    container_name: chickenedak
    restart: always
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      SESSION_SECRET: ${SESSION_SECRET}      # .env 파일
      DEFAULT_ADMIN_PIN: ${DEFAULT_ADMIN_PIN}  # 미지정 시 6자리 랜덤 (stdout 출력)
      AUTO_SNAPSHOT_INTERVAL_MIN: 120        # 2026-05-13 A 결정: 30 → 120 (2시간)
      AUTO_SNAPSHOT_ROTATE: 6                # 12시간 보존창
      OPERATING_DATES: "2026-05-20,2026-05-21"  # G7 양일 운영 일정 (G14 일회성)
      BUSINESS_OPEN_TIME: "16:30"            # 영업 시작 권장 시각 (실제는 G13 관리자 클릭)
    volumes:
      - chickenedak-data:/app/data           # init.sql은 이미지에 포함되어 첫 부팅 시 실행
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  chickenedak-data:
```

### 8.3 운영 명령

| 작업 | 명령 |
|---|---|
| 가동 | `docker compose up -d` |
| 로그 보기 | `docker compose logs -f` |
| 재시작 | `docker compose restart` |
| 컨테이너 상태 | `docker compose ps` |
| Volume 백업 | `docker run --rm -v chickenedak-data:/data alpine tar czf - /data > backup-YYYYMMDD.tar.gz` |
| 종료 | `docker compose down` (volume은 유지) |

### 8.4 환경변수 (`.env`) — *2026-05-13 갱신*

```
# 필수
SESSION_SECRET=<32+ random hex>

# 선택 (어드민 자동 생성용)
DEFAULT_ADMIN_PIN=482917             # 미지정 시 첫 부팅 stdout에 6자리 랜덤 출력
# ADMIN_SEEDS=[{...},{...}]          # 복수 admin 시드 (Phase 2)

# ZIP 스냅샷 (A 결정: 30 → 120)
AUTO_SNAPSHOT_INTERVAL_MIN=120
AUTO_SNAPSHOT_ROTATE=6

# 운영 일정 (G7 + G14 일회성)
OPERATING_DATES=2026-05-20,2026-05-21
BUSINESS_OPEN_TIME=16:30

# 로깅
LOG_LEVEL=info
```

`.env`는 `.gitignore`에 포함. 운영 시 호스트 노트북에 직접 작성·보관.

### 8.5 init.sql 부팅 흐름 — *2026-05-13 신규 G13*

> 사용자 요구: "서버 시작 시 init.sql이 작동해서 DB 구성. 어드민 계정 자동 생성."

**파일 위치:**

```
src/
  server.js                  # Express 부팅 진입점
  db/
    bootstrap.js             # ① init.sql 또는 마이그레이션 적용 결정
    init.sql                 # ★ 신규 DB 첫 부팅 시 전체 스키마 + 시드
    migrations/
      001_initial.sql        # init.sql과 동일 내용 (마이그 추적용 첫 행)
      002_*.sql              # 이후 변경분 (Phase 2 이상)
```

**부팅 순서 (server.js):**

```javascript
// server.js 의사 코드
const db = require('./db/bootstrap');

async function main() {
  await db.bootstrap();           // ① init.sql or migrations
  // → 이때 business_state·admins 시드도 자동
  app.listen(PORT);
}

main().catch(err => {
  logger.fatal({err}, 'Bootstrap failed');
  process.exit(1);                // Docker restart:always가 재시도
});
```

**db/bootstrap.js 의사 코드:**

```javascript
async function bootstrap() {
  const dbExists = await checkTableExists('_migrations');
  if (!dbExists) {
    // 신규 DB: init.sql 실행 (CREATE TABLE * + INSERT 시드)
    const sql = fs.readFileSync('db/init.sql', 'utf8');
    db.exec(sql);

    // 어드민 시드 (별도 트랜잭션, scrypt 해시는 JS에서)
    const pin = process.env.DEFAULT_ADMIN_PIN || generateRandomPin(6);
    const pinHash = await scrypt(pin, salt);
    db.prepare(`INSERT INTO admins (username, pin_hash, role)
                VALUES ('admin', ?, 'super_admin')`).run(pinHash);

    if (!process.env.DEFAULT_ADMIN_PIN) {
      logger.info(`[INIT] Generated admin PIN: ${pin} — 운영 시작 전 변경 권장`);
    }
  } else {
    // 기존 DB: 마이그레이션 적용
    await applyPendingMigrations();
  }
}
```

**Docker volume 보존 (ADR-023):**

- `chickenedak-data` named volume에 `db.sqlite` 저장
- 첫 부팅: volume 비어있음 → `db.sqlite` 신규 생성 → init.sql 실행
- 재부팅: volume에 `db.sqlite` 존재 → bootstrap.js가 `_migrations` 확인 → init.sql 건너뜀
- `docker compose down -v` 또는 volume 삭제 시 다음 부팅에서 init.sql 재실행 (개발용 reset)

**SQL 본문:** `docs/DB_DRAFT.md` §5 마이그레이션 전략의 init.sql 정의 참조.

---

---

## 9. MVP에서 제외할 과한 기술

기획서·ADR 1-23 + 본 문서를 종합한 *제외 목록*. "선택 안 함이 결정"이라는 원칙(ADR 형태로 일부는 이미 명시).

| 기술/패턴 | 제외 근거 |
|---|---|
| **TypeScript + 빌드 파이프라인** | 16일 솔로 일정에서 빌드 디버깅 비용 > 타입 버그 절감 |
| **React/Next.js/Svelte SPA** | 화면 12개·복잡한 클라 상태 없음. SSR + Alpine으로 충분 |
| **Postgres / MySQL** | 30 동시 사용자엔 SQLite WAL이 더 빠르고 운영 단순 |
| **ORM (Prisma, TypeORM, Sequelize)** | Raw SQL이 디버깅 빠름. 마이그레이션도 SQL 파일 1개 |
| **Redis / Memcached** | 메모리 캐시는 Node 프로세스 in-memory Map으로 충분 |
| **Bull / BullMQ / Queue** | 단일 프로세스. 백그라운드는 setInterval 1개로 충분 |
| **WebSocket (socket.io)** | SSE면 단방향 push 충분. 양방향 RPC 불필요 |
| **OAuth (Google/Naver 등)** | 관리자 PIN 5-10명 운영. 외부 IdP 학습 비용 과함 |
| **JWT (관리자 인증)** | 단일 서버. 세션 쿠키가 더 단순·안전 |
| **PG / 카카오페이 / 네이버페이** | ADR-009 명시 (결제는 사용자 자가 이체) |
| **마이크로서비스 / 서비스 메시** | 단일 모놀리스가 정답. Conway's law: 1인 팀 = 1 서비스 |
| **Kubernetes / k3s** | docker compose가 충분. K8s는 멀티 호스트용 |
| **CI/CD (GitHub Actions 등)** | 호스트 노트북에서 `docker compose build && up`로 충분 |
| **PDF 생성 (puppeteer-core)** | MVP 미도입. ZIP에 JSON·CSV·이미지면 정산 회의 충분 |
| **OpenTelemetry / 분산 트레이싱** | Single-process이라 pino 구조화 로그면 충분 |
| **Sentry / Bugsnag (외부 에러 추적)** | pino + 호스트 로그 파일이면 충분. 외부 SaaS 회원가입·키 관리 부담 |
| **Stripe / 결제 SDK** | ADR-009 (결제 시스템 미도입) |
| **Helm / Terraform / IaC** | 호스트 1대 + docker compose 1개. IaC 학습 시간 X |
| **GraphQL** | REST 14개 엔드포인트 (API_DRAFT.md 참조)가 더 단순 |
| **HTTP/2 / gRPC** | 학교 와이파이 환경. HTTP/1.1 + SSE면 충분 |
| **Service Worker / PWA** | 모바일 웹 1회용. 오프라인 가치 없음 (이체는 어차피 외부 앱) |
| **다국어 (i18n)** | 한국어만 |
| **다크 모드** | 명시적 제외 (§14.3) |
| **로드 밸런서 / Reverse Proxy (nginx)** | 학교 와이파이 환경. Express가 직접 :3000 노출 |
| **HTTPS (Let's Encrypt)** | 학교 내부망에 도메인 없음. 배포 환경 결정 시 재검토 |
| **TypeORM 타입 경계** | Raw SQL + zod로 충분 |

> **공통 원칙:** "innovation token" 1-2개만 쓴다(McKinley). 이번 프로젝트의 토큰은 ① **SSE 실시간** ② **자체 ZIP 백업 자동화**. 나머지는 boring tech.

---

## 10. 미해결 / Phase 2 후보

| # | 항목 | 근거 |
|---|---|---|
| 1 | TypeScript 마이그레이션 | 1차 운영 후 코드 안정화 시 |
| 2 | PDF 정산 캡처 자동화 | 운영진 수동 인쇄로 1차 충분 |
| 3 | 본부 이체 매칭 휴리스틱 | CEO 리뷰 #6 skip |
| 4 | 운영 모니터링 대시보드 (SSE 연결수·메모리 등) | 운영진 self-handle |
| 5 | 다국어·다크모드·PWA | 명시 제외 |
| 6 | RBAC 분리 (super_admin / hub / kitchen 등) | MVP는 단일 admin role |
| 7 | WebSocket 전환 | 양방향 필요 시 |
| 8 | 외부 호스팅 + HTTPS | 학교 와이파이 → 외부망 노출 결정 시 |

---

## 11. 디렉터리 보안·권한

```
호스트 머신 (학생회 노트북)
└── /home/admin/chickenedak/
    ├── docker-compose.yml      # git 관리
    ├── Dockerfile              # git 관리
    ├── .env                    # ★ git 미관리, chmod 600
    ├── src/, views/, public/, db/migrations/    # git 관리
    └── (Docker volume 마운트 — Docker가 관리)

Docker volume `chickenedak-data` (호스트 경로 = `/var/lib/docker/volumes/...`)
└── /app/data/
    ├── db.sqlite               # 운영 DB
    ├── db.sqlite-wal, -shm     # WAL 모드 부속
    ├── backups/
    │   ├── auto-*.zip          # ★ ADR-022 자동 (PII 포함)
    │   └── manual-*.zip        # ★ §12.5 수동 (PII 포함)
    ├── images/                 # 메뉴 사진
    └── logs/                   # pino 출력 (선택, 표준출력 권장)
```

**중요:** `backups/`와 `db.sqlite`에 PII(학번·이름·이체정보) 포함. 호스트 노트북 자체 disk encryption 권장 (BitLocker / FileVault). **D+7일 운영자 수동 폐기** (ADR-027 변경, 2026-05-15 · `docs/operations/pii-deletion.md`). ZIP은 학생회 클라우드 1년 보존 (감사 대비).

---

## 12. 후속 작업

다음 단계 (`order-system-plan.md` 부록 B에 따라):

1. **자료 수령**: 부스 약도(G12 미니맵용), 메뉴 이미지 8종, ~~계좌번호·예금주~~ (G9 확보됨: 국민은행 233001-04-403536 박동빈)
2. **디자인 톤 시안** (`/design-consultation` 또는 `/plan-design-review`)
3. **본 ARCHITECTURE.md 검토 + 수정** ← 사용자 검토 단계
4. **사용자가 "구현 시작" 신호**
5. `/superpowers:writing-plans` → 구현 단계 분할
6. `/superpowers:test-driven-development` → 구현

### 변경 영향 추적 (2026-05-13 반영)

- **§5.4 영업 상태 (BusinessState) 신규** — G13 영업 토글 도메인 모델
- **§6.5 어드민 자동 생성 신규** — 사용자 요구 신규 명세 (init.sql 기반)
- **§7 실패 시나리오 #14·#15·#16 추가** — 장사 시작 누락·init.sql 실패·트랜잭션 부분 실패
- **§8.2 docker-compose.yml 환경변수 갱신** — AUTO_SNAPSHOT 30 → 120, DEFAULT_ADMIN_PIN, OPERATING_DATES, BUSINESS_OPEN_TIME 신규
- **§8.4 .env 갱신** — 위 동일
- **§8.5 init.sql 부팅 흐름 신규** — db/bootstrap.js + db/init.sql 정책 명세
- **§5.3 쿠폰 검증 함수 정규식 갱신** — ADR-019 변경: `prefix 202637` → `\d{2}\d{2}37\d{3}`

PRD G9-G14 + ADR-017/019/022/026 변경 + ADR-012 보강은 이 갱신에 모두 반영됨.
