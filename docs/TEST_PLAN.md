# 테스트 전략 — 오늘 저녁은 치킨이닭!

> ⚠️ **최신 결정 우선 (2026-05-15 갱신 — `docs/CODEX_REVIEW_v2_FIX_SUMMARY.md`):** §7 "SSE 통합 테스트" → `useOrderPolling` 폴링 hook 테스트로 대체 (ADR-015 변경). E2E-05 등 SSE 의존 시나리오는 폴링 기반. 본문 잔존 SSE 표기는 historical.

**작성일:** 2026-05-04 (`/plan-eng-review` 1차)
**관련 문서:** `ARCHITECTURE.md`, `API_DRAFT.md`, `DB_DRAFT.md`, `DECISIONS.md`
**상태:** DRAFT

---

## 0. 원칙

1. **TDD 권장** — 사용자 CLAUDE.md가 `/superpowers:test-driven-development`를 표준 워크플로로 명시. 도메인 함수는 RED → GREEN → REFACTOR.
2. **테스트 피라미드:** 단위 70% / 통합 25% / E2E 5%.
3. **결정적 테스트** — 시각·랜덤·외부 IO 의존 X. 시각은 `vi.useFakeTimers()` 또는 의존성 주입.
4. **DB 통합은 in-memory SQLite** — `:memory:` 또는 임시 파일. 운영 DB와 *완전히 별개*.
5. **E2E는 Playwright** — 모바일 viewport(390×844 iPhone, 360×740 Galaxy)와 PC viewport 분리.
6. **ADR-020 가격 무결성은 4 케이스 강제** — Pattern B 회귀 방지의 핵심.

---

## 1. 테스트 도구 스택

| 도구 | 버전 | 용도 |
|---|---|---|
| Vitest | 2.x | 단위·통합 테스트 러너 |
| @vitest/coverage-v8 | 2.x | 커버리지 측정 |
| supertest | 7.x | Express 핸들러 통합 테스트 |
| better-sqlite3 (`:memory:`) | 11.x | DB 통합 테스트 |
| Playwright | 1.x | E2E (Chromium·WebKit) |
| @playwright/test | 1.x | 테스트 러너 + assertion |
| zod | 3.x | 입력/출력 스키마 (테스트도 활용) |
| MSW (선택) | 2.x | (외부 API 모킹 — 없을 가능성 높음, 선택) |

**npm scripts:**
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

---

## 2. 테스트 피라미드 + 커버리지 목표

```
                 /\
                /  \    E2E (5%, ~10 시나리오)
               /────\
              /      \  통합 (25%, ~30 시나리오)
             /────────\
            /          \  단위 (70%, ~80+ 함수·케이스)
           /────────────\
```

**커버리지 목표:**
- `domain/` 100% (라인·브랜치 모두)
- `routes/` 핵심 핸들러 90%+
- `db/repositories/` 80%+ (CRUD + edge case)
- `middleware/` 90%+
- `views/` (EJS) — 커버리지 측정 X, E2E로 검증
- `jobs/` 80%+ (타이머는 fake timer로)

---

## 3. 테스트 커버리지 다이어그램 (계획)

```
CODE PATHS                                                USER FLOWS
[+] src/domain/pricing.js                                 [+] 사용자 주문 흐름
  ├── calculate()                                           ├── [GAP] [→E2E] 메뉴 선택 → 주문 → 도그태그
  │   ├── 정상 주문                                          ├── [GAP] [→E2E] 쿠폰 적용 → 1,000원 할인
  │   ├── ★ 클라가 보낸 total 무시 (ADR-020 #1)            ├── [GAP] [→E2E] 외부인 체크 → 이름만 입력
  │   ├── ★ 존재하지 않는 menu_id 거부 (ADR-020 #2)        └── [GAP] [→E2E] 학번 prefix 위조 거부
  │   ├── ★ 품절 메뉴 거부 (ADR-020 #3)
  │   ├── ★ 쿠폰 없을 때 discount=0 (ADR-020 #4)            [+] 이체 확인 흐름
  │   ├── 합계 정확성 (1×3 + 2×2 = 7)                       ├── [GAP] [→E2E] 사용자 신고 → 본부 확인 → 조리 시작
  │   ├── 무결성 (subtotal-discount=total)                   └── [GAP] [→E2E] 본부 HOLD → 사용자 재시도
  │   └── empty items 거부
  ├── COUPON_AMOUNT 상수 일관성                            [+] 조리 현황판 SSE
  └── 가격 0 메뉴 처리 (이론적 — 보호 차원)                  ├── [GAP] [→E2E] 학번+주문번호 인증 통과
                                                            ├── [GAP] [→E2E] 인증 실패 401
[+] src/domain/coupon-validation.js                         ├── [GAP] [→E2E] 상태 변경 시 SSE push 수신
  ├── validate()                                            └── [GAP] [→E2E] 연결 끊김 → 재연결
  │   ├── 학번 형식 OK (9자리)
  │   ├── 학번 형식 위반 (8자리, 10자리, 한글, 빈문자)        [+] 정산·ZIP 흐름
  │   ├── prefix 매칭 (202637)                              ├── [GAP] [→E2E] 진행 주문 있을 때 마감 거부
  │   ├── prefix 불일치 (202638)                            ├── [GAP] [→E2E] 모든 주문 종결 후 마감 성공
  │   ├── 이름 빈 문자 거부                                  ├── [GAP] [→E2E] 자동 30분 ZIP 생성
  │   ├── used_coupons 중복 거부                             └── [GAP] [→E2E] 수동 ZIP 다운로드
  │   └── 모두 통과
  └── 거부 사유별 enum 일관성                                [+] 관리자 인증·권한
                                                            ├── [GAP] [→E2E] PIN 로그인·로그아웃
[+] src/domain/order-state.js                               ├── [GAP] [→E2E] 미인증 시 /admin/* 차단
  ├── canTransition(from, to)                               └── [GAP] [→E2E] 잘못된 PIN 5회 잠금
  │   ├── 모든 합법 전이 (10+ 케이스)
  │   ├── 모든 불법 전이 거부 (DONE→COOKING 등)             [+] 에러 화면
  │   └── HOLD 분기 정합성                                   ├── [GAP]        404 페이지
  └── 종결 상태(DONE, CANCELED) terminal 강제                ├── [GAP]        500 페이지
                                                            └── [GAP]        404 SSE
[+] src/domain/settlement.js
  ├── canClose(date)
  │   ├── 진행 주문 0건 → true (ADR-012)
  │   ├── 진행 주문 1건+ → false + 분해
  │   └── DONE/CANCELED만 있으면 → true
  ├── computeSummary(date)
  │   ├── 매출 합계
  │   ├── 쿠폰 할인 합계
  │   ├── 메뉴별 매출 정확성
  │   └── 시간대별 카운트
  └── 빈 일자 처리 (주문 0건)

[+] src/domain/transfer-matching.js
  ├── matches(report, deposit)
  │   ├── 4요소(이름·은행·금액·시각) 모두 일치 → true
  │   ├── 이름 1글자 차이 → false (휴리스틱은 Phase 2)
  │   ├── 금액 1원 차이 → false
  │   └── 시각 ±5분 경계
  └── alt_name 적용 시 이름 비교 대상 변경

[+] src/domain/popularity.js
  ├── computeRanking(orders)
  │   ├── 정상 TOP 3
  │   ├── 동률 시 menu_id 오름차순 tie-break
  │   └── 데이터 부족 (3개 미만) → seed 모드
  └── generateCopy(ranking)
      ├── 1위 격차 큼 → "압도적 1위"
      ├── 1위·2위 격차 작음 → "추격 중"
      ├── 데이터 0건 → "🔥 학생회 추천 BEST"
      └── 빠른 상승 → "급상승" (sold_count 증가율)

[+] src/db/repositories/order-repo.js
  ├── createOrderTx(input, menuSnapshot)
  │   ├── ★ TX BEGIN/COMMIT 정상
  │   ├── ★ used_coupons UNIQUE 충돌 → ROLLBACK
  │   ├── ★ daily_no 시퀀스 (5/20 #1, #2, ... 5/21 #1)
  │   └── 외부인은 token 발급
  ├── findByStudent(date, order_no, student_id)
  ├── findByToken(date, order_no, token)
  ├── transition(id, from, to, actor, note)
  │   ├── ★ 행 0건 영향 시 IllegalStateTransition
  │   └── order_events 행 INSERT
  └── countActiveByStatus(date)

[+] src/sse/hub.js
  ├── subscribe(order_id, res)
  │   ├── 첫 구독 시 Set 생성
  │   └── res.close 시 Set에서 제거
  ├── emit(order_id, event)
  │   ├── 구독자 0명 → no-op
  │   └── 다중 구독자 → 모두에게 push
  └── ★ 메모리 누수 — close 후 Set 정리

[+] src/middleware/admin-auth.js
  ├── 세션 있음 → next()
  ├── 세션 없음 → 302 /admin/login
  └── XHR 요청 → 401 JSON

[+] src/middleware/customer-token.js
  ├── 학번 매칭 → next()
  ├── 토큰 매칭 → next()
  ├── 둘 다 실패 → 401
  └── 토큰 만료 → 401

[+] src/jobs/auto-snapshot.js
  ├── ★ setInterval 30분 fake timer
  ├── ZIP 생성 → backups/auto-*.zip
  ├── 회전: 7개 → 6개 (oldest 삭제)
  └── 디스크 부족 시 pino error + 다음 주기 재시도

[+] src/middleware/rate-limit.js (쿠폰 시도)
  ├── IP당 5회/분 OK
  ├── 6회째 거부 + 1분 잠금
  └── 1분 후 reset

COVERAGE: 0/85 paths planned (구현 전이라 모두 GAP) | 코드 GAP: 60 | 사용자 GAP: 25
                                                     | E2E 후보: 18 | 단위: 67
```

**범례:** ★ = ADR 핵심 회귀 테스트, [→E2E] = 통합/E2E 권장, [GAP] = 구현 시 작성 예정.

---

## 4. ADR-020 (Pattern B 가격 무결성) — 4 케이스 강제

이 4개는 **회귀 테스트로 별도 파일 분리** (`tests/unit/pricing-adr020.test.js`):

```javascript
import { describe, it, expect } from 'vitest';
import { calculate } from '../../src/domain/pricing.js';

describe('ADR-020: Pattern B 가격 무결성', () => {
  const menuSnapshot = {
    prices: new Map([[1, 18000], [2, 15000], [5, 2000]]),
    soldOut: new Set(),
    names: new Map([[1, '후라이드'], [2, '양념'], [5, '콜라']])
  };

  it('case 1: 클라가 거짓 total을 보내도 서버가 진짜 가격으로 계산한다', () => {
    // 서버 함수는 클라 가격을 *받지 않음* — 그래서 위조 자체가 불가
    const items = [{ menu_id: 1, qty: 1 }, { menu_id: 5, qty: 2 }];
    const result = calculate(items, null, menuSnapshot);
    expect(result.subtotal).toBe(22000);   // 18000 + 2000*2
    expect(result.discount).toBe(0);
    expect(result.total).toBe(22000);
    expect(result.lineItems[0].unit_price).toBe(18000);  // 서버 lookup
  });

  it('case 2: 존재하지 않는 menu_id는 MenuNotFound 거부', () => {
    const items = [{ menu_id: 999, qty: 1 }];
    expect(() => calculate(items, null, menuSnapshot)).toThrow(/MenuNotFound|MENU_NOT_FOUND/);
  });

  it('case 3: 품절 menu_id는 MenuSoldOut 거부', () => {
    const snap = { ...menuSnapshot, soldOut: new Set([1]) };
    const items = [{ menu_id: 1, qty: 1 }];
    expect(() => calculate(items, null, snap)).toThrow(/MenuSoldOut|MENU_SOLD_OUT/);
  });

  it('case 4: 쿠폰 적용 시 합계 = subtotal - discount', () => {
    const items = [{ menu_id: 1, qty: 1 }];   // 18,000
    const result = calculate(items, 'COUPON_OK', menuSnapshot);  // 1,000 할인
    expect(result.subtotal).toBe(18000);
    expect(result.discount).toBe(1000);
    expect(result.total).toBe(17000);
  });
});
```

> **원칙:** ADR-020을 어기는 PR이 머지되면 이 테스트가 RED. CI가 없어도 `npm test`만 돌리면 즉시 발견.

추가 4 통합 케이스 (`tests/integration/order-create-adr020.test.js`):
- POST /api/orders가 zod 스키마에 `price`/`total` 필드를 *허용하지 않는다* (스키마 ZodError 회귀)
- 클라가 무리하게 `total` 추가 → zod가 400 반환
- 메뉴 가격이 운영 중 변경된 직후 주문이 새 가격으로 저장 (snapshot 정합성)
- 동시 동일 학번 쿠폰 2건 INSERT → 1건만 성공 (UNIQUE 제약)

---

## 5. 단위 테스트 대상 + 케이스 표

### 5.1 `domain/pricing.js`
| 케이스 | 입력 | 기대 |
|---|---|---|
| 정상 단일 메뉴 | `[{m:1,q:1}]` | total=18000 |
| 정상 다중 메뉴 | `[{m:1,q:1},{m:5,q:2}]` | total=22000 |
| 클라 total 위조 | (zod에서 거부) | 거부 |
| 쿠폰 적용 | items + coupon | total=subtotal-1000 |
| 빈 items | `[]` | 거부 |
| qty=0 | `[{m:1,q:0}]` | 거부 (zod) |
| qty>20 | `[{m:1,q:21}]` | 거부 (zod) |
| 음수 qty | `[{m:1,q:-1}]` | 거부 (zod) |
| 품절 menu_id | `[{m:1,q:1}]` (sold_out) | MenuSoldOut |
| 미존재 menu_id | `[{m:999,q:1}]` | MenuNotFound |

### 5.2 `domain/coupon-validation.js` — *2026-05-13 갱신 (ADR-019 학과 코드 37)*
| 케이스 | 입력 (student_id, name) | 기대 |
|---|---|---|
| 정상 컴모융 1학년 | (`202637042`, `홍길동`) | valid |
| 정상 컴모융 4학년 | (`202337042`, `김철수`) | valid (학과 코드 37 매칭) |
| 정상 컴모융 2학년 | (`202537042`, `이영희`) | valid |
| 8자리 학번 | (`20263704`, `홍`) | format |
| 10자리 학번 | (`2026370420`, `홍`) | format |
| 알파벳 포함 | (`A02637042`, `홍`) | format |
| 다른 학과 (위치 5-6이 38) | (`202638042`, `홍`) | department |
| 다른 학과 (위치 5-6이 19) | (`202619042`, `홍`) | department |
| 빈 이름 | (`202637042`, ``) | name |
| 공백 이름 | (`202637042`, `   `) | name |
| 이미 사용 (학번 unique) | (`202637042`, `홍`) | duplicate |
| 모두 OK 신규 | (`201137999`, `박민수`) | valid (2011학번 + 학과 37) |

### 5.3 `domain/order-state.js`
| from → to | actor | 기대 |
|---|---|---|
| ORDERED → TRANSFER_REPORTED | customer | OK |
| ORDERED → CANCELED | admin | OK |
| TRANSFER_REPORTED → PAID | admin | OK |
| TRANSFER_REPORTED → HOLD | admin | OK |
| HOLD → TRANSFER_REPORTED | customer or admin | OK |
| PAID → COOKING | admin | OK |
| COOKING → READY | admin | OK |
| READY → DONE | admin | OK |
| DONE → COOKING | any | reject |
| DONE → CANCELED | any | reject |
| CANCELED → ORDERED | any | reject |
| ORDERED → PAID | admin | reject (TRANSFER_REPORTED 거치지 않음) |
| ORDERED → COOKING | admin | reject |

### 5.4 `domain/settlement.js`
| 케이스 | 기대 |
|---|---|
| 진행 주문 0건 | canClose=true |
| ORDERED 1건 | canClose=false, breakdown.ORDERED=1 |
| HOLD 1건 | canClose=false, breakdown.HOLD=1 |
| 모두 DONE | canClose=true |
| 일부 CANCELED 일부 DONE | canClose=true |
| 매출 = DONE 합계만 | (CANCELED 제외) |
| 메뉴별 집계 정확 | 동일 menu_id 합산 |
| 시간대별 KST 변환 | UTC `created_at` → KST hour |

### 5.5 `domain/popularity.js` — *2026-05-13 갱신 (E 결정: 정적 BEST)*
| 케이스 | 입력 | 기대 |
|---|---|---|
| TOP 3 정상 | 5개 메뉴 판매 | top3 + copy="🔥 학생회 추천 BEST" |
| 동률 1·2위 | qty 똑같음 | menu_id 작은 순 |
| 데이터 부족 | 0건 | ranking=[], copy 동일 |
| 캐시 5분 이내 재호출 | 1초 후 재호출 | 동일 응답 (DB 쿼리 X) |
| 캐시 5분 만료 | 5분+ 후 재호출 | 새 쿼리 + 동일 형식 |
| ~~격차 큼 dominant_first~~ | — | **삭제 (정적 BEST 결정)** |
| ~~격차 작음 close_race~~ | — | **삭제** |
| ~~신메뉴 rising~~ | — | **삭제** |

### 5.6 `domain/transfer-matching.js`
| 케이스 | 기대 |
|---|---|
| 4요소 일치 | match=true |
| 이름 1글자 차이 | match=false |
| 금액 1원 차이 | match=false |
| 시각 ±5분 경계 | match=true (300초 내) |
| 시각 5분 1초 | match=false |
| alt_name 사용 | 비교 대상 = alt_name |

### 5.7 `domain/business-state.js` ★ G13 신규 — *2026-05-13*
| 케이스 | 입력 | 기대 |
|---|---|---|
| 초기 상태 = CLOSED | init.sql 직후 | status='CLOSED' |
| CLOSED → OPEN | open(admin_id) | status='OPEN', operating_date=today, opened_at=NOW, opened_by=admin_id |
| OPEN 중 다시 open() | open(admin_id) | 멱등 — 기존 상태 유지 또는 200 + 기존값 |
| OPEN → CLOSED (정산 마감) | closeForSettlement() | status='CLOSED', closed_at=NOW |
| 정산 마감 트랜잭션 ROLLBACK | settlements INSERT 실패 | business_state.status='OPEN' 유지 (트랜잭션 보장) |
| isBusinessOpen() — CLOSED | — | false |
| isBusinessOpen() — OPEN | — | true |
| shouldBeOpen() — 16:30 이전 | current=16:00, date=5/20 | false |
| shouldBeOpen() — 16:30 이후 + 운영일 | current=17:00, date=5/20 | true |
| shouldBeOpen() — 운영일 아닌 날 | current=17:00, date=5/22 | false |
| 두 번째 행 INSERT 시도 | INSERT INTO business_state VALUES (2, ...) | SQLite CHECK (id=1) 위반 거부 |

### 5.8 `db/bootstrap.js` ★ init.sql 신규 — *2026-05-13*
| 케이스 | 입력 | 기대 |
|---|---|---|
| 신규 DB | volume 비어있음 | init.sql 실행, _migrations에 '001-init.sql' INSERT, business_state 시드 |
| 기존 DB | _migrations 존재 | init.sql skip, migrations/ 미적용분만 적용 |
| 어드민 시드 (DEFAULT_ADMIN_PIN env) | env PIN='482917' | scrypt 해시 후 INSERT, stdout 출력 X |
| 어드민 시드 (env 없음) | env 없음 | 랜덤 6자리 PIN 생성 + scrypt + stdout 출력 1회 |
| 재부팅 시 어드민 재시드 안 함 | admins 테이블 1행 존재 | skip |
| init.sql 실행 실패 (SQL 구문 오류) | 잘못된 SQL | ROLLBACK + process.exit(1) → Docker restart 재시도 |
| init.sql 실행 부분 실패 → 전체 ROLLBACK | INSERT 중 FK 위반 | BEGIN/COMMIT 트랜잭션 보장, 부분 시드 없음 |

---

## 6. 통합 테스트 (Express + DB)

각 통합 테스트는 다음 패턴:

```javascript
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { setupTestDb, teardownTestDb } from './helpers/db.js';

describe('POST /api/orders (통합)', () => {
  let app, db;
  beforeEach(() => {
    db = setupTestDb();    // :memory: SQLite + migrations + 시드 메뉴
    app = createApp({ db });
  });
  afterEach(() => teardownTestDb(db));

  it('정상 주문 → 201 + order_no', async () => {
    const res = await request(app).post('/api/orders').send({
      items: [{ menu_id: 1, qty: 1 }],
      pickup: 'dine_in', table_no: 9,
      student_id: '202637042', name: '홍길동', is_external: false
    });
    expect(res.status).toBe(201);
    expect(res.body.data.order_no).toBe(1);
    expect(res.body.data.total).toBe(18000);
  });

  it('쿠폰 거부 → 400 + COUPON_PREFIX', async () => {...});
  it('동시 동일 학번 쿠폰 → 1건만 성공', async () => {...});
  it('품절 메뉴 → 409 + MENU_SOLD_OUT', async () => {...});
  // ... 등 ~30 케이스
});
```

### 통합 테스트 시나리오 30개 (요약)
| # | 시나리오 |
|---|---|
| 1-5 | POST /api/orders 정상·에러 (5개) |
| 6-9 | POST /api/orders/:id/transfer-report 정상·에러 |
| 10-12 | GET /api/orders/:id/status 인증 (학번/토큰/실패) |
| 13-15 | GET /api/orders/:id/stream SSE 첫 snapshot |
| 16-18 | POST /admin/login 정상·실패·rate-limit |
| 19-22 | POST /admin/api/orders/:id/transition (4 케이스) |
| 23-25 | POST /admin/api/settlement/close 가드 |
| 26-27 | GET /admin/api/settlement/:date/zip ZIP stream |
| 28-30 | GET /api/menus, /api/popular, /healthz |

---

## 7. ~~SSE 통합 테스트~~ → **폴링 hook 테스트 (ADR-015 변경, 2026-05-15)**

**상태:** SSE 미구현. SSE 통합 테스트 → `src/hooks/__tests__/useOrderPolling.test.jsx`로 대체.

```javascript
// 실제 회귀: src/hooks/__tests__/useOrderPolling.test.jsx
// - 5초 폴링 + AbortController + cleanup
// - status 전이 시 onStatusChange 콜백
// - BusinessClosedError(423) → 전역 위임
// - 인증 실패(401/403) → error state
```

**테스트 대상 케이스 (현행):**
- 첫 fetch 후 snapshot 표시 (`useOrderPolling`)
- status 전이 시 콜백 발화 (READY 진동 등)
- `enabled=false` 시 폴링 X
- StrictMode mount-unmount-mount 시 활성 폴링 1개
- BusinessClosedError 전역 위임

SSE 도입 시 (Phase 2) 동일 시그니처 hook으로 무중단 전환 가능.

---

## 8. E2E 시나리오 (Playwright)

### 8.1 플레이그라운드 설정

```javascript
// playwright.config.js
export default {
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } }
  ],
  webServer: {
    command: 'docker compose up',
    url: 'http://localhost:3000/healthz',
    reuseExistingServer: !process.env.CI
  }
};
```

### 8.2 시나리오 10개 (요약)

| # | 시나리오 | viewport | 우선순위 |
|---|---|---|---|
> **상태 (P1-6 Codex v3 2026-05-15):** 본 14 시나리오는 **BLOCKED — 일회성 운영 + D-1 리허설로 대체**. 사유: ① 자동 E2E 14건 작성 ≫ 가치(부스 2일 운영) ② Playwright webServer가 현재 Vite-only라 API/SSE 시나리오는 백엔드 통합 인프라 추가 필요 ③ `docs/operations/d1-rehearsal.md` 10 섹션 체크리스트가 동일 시나리오를 수동으로 검증. 자동화는 Phase 2 가정상 X. **현재 자동 E2E는 `tests/smoke.spec.js` 1건(홈 → /menu redirect)만 운영**.

| ~~ID~~ (BLOCKED) | 시나리오 | 수동 검증 위치 |
|---|---|---|
| ~~E2E-01~~ | 학생 주문 → 도그태그 → 조리 현황 | d1-rehearsal.md §주문 흐름 |
| ~~E2E-02~~ | 외부인 주문 → 토큰 → 조리 현황 | d1-rehearsal.md §외부인 흐름 |
| ~~E2E-03~~ | 쿠폰 prefix 위조 거부 | server/domain/__tests__/coupon.test.js 단위 |
| ~~E2E-04~~ | 동시 동일 쿠폰 1건만 통과 | server/routes/__tests__/customer.test.js (P0-3) |
| ~~E2E-05~~ | 사용자 신고 → 본부 확인 → 조리 시작 → ~~SSE~~ 폴링 갱신 | d1-rehearsal.md §본부 처리 |
| ~~E2E-06~~ | 본부 HOLD → 사용자 재시도 | d1-rehearsal.md §보류 흐름 |
| ~~E2E-07~~ | 정산 마감 가드 | server/domain/__tests__/settlement.test.js |
| ~~E2E-08~~ | ZIP 다운로드 → 헤더·콘텐트 | server/jobs/__tests__/auto-snapshot.test.js (P1-1) |
| ~~E2E-09~~ | 관리자 PIN 로그인·세션 | server/routes/__tests__/admin.test.js |
| ~~E2E-10~~ | 자동 스냅샷 backups/ 디렉터리 생성 | server/__tests__/backup-volume-config.test.js (P1-2) |
| ~~E2E-11~~ | 장사 시작 (G13) | server/middleware/__tests__/business-state.test.js + d1-rehearsal §가동 |
| ~~E2E-12~~ | 정산 마감 자동 CLOSED (G13) | server/domain/__tests__/settlement.test.js + d1-rehearsal §정산 |
| ~~E2E-13~~ | 부스 미니맵 모달 (G12) | src/components/organisms/__tests__/BoothMinimapModal.test.jsx |
| ~~E2E-14~~ | init.sql 첫 부팅 | server/__tests__/bootstrap.test.js + d1-rehearsal §첫 부팅 |

### 8.3 E2E-01 스크립트 예시

```javascript
import { test, expect } from '@playwright/test';

test('학생 주문 → 도그태그 → 조리 현황', async ({ page }) => {
  await page.goto('/menu');
  await page.locator('[data-testid="menu-1"]').click();
  await page.locator('[data-testid="qty-plus"]').click();
  await page.locator('[data-testid="cart-checkout"]').click();
  await page.locator('[data-testid="pickup-dine-in"]').click();
  await page.locator('[data-testid="table-no"]').fill('9');
  await page.locator('[data-testid="student-id"]').fill('202637042');
  await page.locator('[data-testid="customer-name"]').fill('홍길동');
  await page.locator('[data-testid="confirm-order"]').click();

  await expect(page.locator('[data-testid="order-number"]')).toContainText('#1');
  await expect(page.locator('[data-testid="winner-message"]')).toBeVisible();

  await page.locator('[data-testid="kitchen-status-link"]').click();
  await expect(page.locator('[data-testid="status-stage"]')).toContainText('주문 받았어요');
});
```

`data-testid` 속성을 EJS에 일관되게 부여 (디자인 시안 단계에서 추가).

---

## 9. 테스트 픽스처·헬퍼

```
tests/helpers/
├── db.js                # setupTestDb / teardownTestDb / seedMenus
├── auth.js              # mock admin session 발급
├── order.js             # createTestOrder(db, overrides)
├── time.js              # fake timer wrapper
└── playwright.js        # E2E 헬퍼 (login, addToCart 등)
```

`setupTestDb` 패턴:
```javascript
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/db/connection.js';

export function setupTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  // 시드: 기본 카테고리·메뉴
  db.exec(`INSERT INTO menus (id, category_id, name, price) VALUES
    (1, 1, '후라이드', 18000), (2, 1, '양념', 19000), (5, 3, '콜라', 2000);`);
  return db;
}
export function teardownTestDb(db) { db.close(); }
```

---

## 10. CI · 자동 실행 (선택)

**MVP에선 CI 없이 로컬 `npm test` 권장** (boring 원칙).

**Phase 2 후보:** GitHub Actions:
```yaml
# .github/workflows/test.yml (참고용)
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm test
      - run: npx playwright install chromium
      - run: npm run test:e2e -- --project=mobile
```

---

## 11. 회귀 테스트 — 1차 운영 후

5/20-21 운영 중 발견된 버그·예외 시나리오를 *다음에 같은 일이 일어나지 않도록* 테스트로 고정:

| 가능 회귀 | 테스트 추가 위치 |
|---|---|
| `daily_no` 중복 발생 (race) | `tests/integration/order-daily-no.test.js` |
| SSE 연결 메모리 누수 | `tests/unit/sse-hub.test.js` (시뮬 1000 연결·해제) |
| 자동 ZIP 디스크 차서 멈춤 | `tests/unit/auto-snapshot.test.js` (모킹 fs 거부) |
| 쿠폰 동시 INSERT race | `tests/integration/coupon-race.test.js` (Promise.all) |
| 정산 마감 후 주문 들어옴 (이론적 X) | `tests/integration/settlement-after-close.test.js` |

---

## 12. 실패 모드 매트릭스 (Failure Modes Registry)

`ARCHITECTURE.md` §7의 13개 실패 시나리오를 테스트 가능 영역으로 매핑:

| # | 시나리오 | 단위 | 통합 | E2E | 에러 핸들링 | 사용자 가시성 |
|---|---|:---:|:---:|:---:|:---:|:---:|
| 1 | 가격 변조 | ✓ ADR-020 4 cases | ✓ zod reject | ✓ E2E-03 | 명시 | 안내 |
| 2 | 쿠폰 prefix 위조 | ✓ | ✓ | ✓ E2E-03 | 명시 | 안내 |
| 3 | 동시 학번 race | — | ✓ | ✓ E2E-04 | DB UNIQUE | 안내 |
| 4 | 메뉴 재고 race | — | ✓ (소프트) | — | 운영진 수동 | 부스 안내 |
| 5 | SSE 연결 끊김 | ✓ hub | ✓ reconnect | ✓ E2E-05 | EventSource auto | 자동 |
| 6 | 본부 부재 알림 | ✓ elapsed_minutes | — | — | 알림음 | 본부 화면 |
| 7 | 서버 크래시 | — | — | ✓ Docker restart | restart:always | (잠시) 응답없음 |
| 8 | 디스크 차서 ZIP fail | ✓ auto-snapshot | — | — | pino + retry | 운영진 알림 |
| 9 | DB 손상 | — | ✓ integrity_check | — | 부팅 가드 | 본부 알림 |
| 10 | 정산 가드 위반 | ✓ canClose | ✓ | ✓ E2E-07 | 422 + breakdown | 안내 |
| 11 | 호스트 종료 | — | — | — | Docker daemon | 노트북 점검 |
| 12 | SNS 화면 노출 | — | — | — | 학번 매칭 | 안전 |
| 13 | PIN 노출 | — | ✓ rate-limit | — | 30초 잠금 | 운영진 알림 |
| **14** | 🟡 **장사 시작 누락 (G13)** | ✓ §5.7 shouldBeOpen | ✓ middleware 423 | ✓ **E2E-11** | should_be_open + status mismatch → 빨간 깜박 | 본부 대시보드 알림 |
| **15** | 🟡 **init.sql 실패** | ✓ §5.8 ROLLBACK 케이스 | ✓ bootstrap 실패 시 process.exit | — (Docker restart로 흡수) | pino fatal + restart:always | (잠시) 응답 없음 |
| **16** | 🟡 **영업 종료 + 정산 트랜잭션 부분 실패** | ✓ §5.7 ROLLBACK 케이스 | ✓ settlements rollback 시 business_state 유지 | — | BEGIN/COMMIT 트랜잭션 | 안내 |

**Critical gap 0건** — 각 실패 모드는 *최소 한 가지 방어 + 가시성*이 있음.

---

## 13. 워크트리·병렬 실행 (참고)

이 프로젝트는 솔로 개발이라 worktree 병렬 가치 낮음. 단일 워크스페이스에서 순차 진행 권장.

만약 `/superpowers:writing-plans` 단계에서 모듈 분리 가능하면:
- Lane A: `domain/` 전체 (단위 테스트와 함께)
- Lane B: `db/migrations/` + `repositories/`
- Lane C: `routes/` + `views/` (A·B 완료 후)

A와 B는 모듈이 분리돼 동시 진행 가능. C는 의존성 있어 sequential.

---

## 14. 미정·후속

- **메뉴 이미지 업로드 테스트:** multipart 처리 시 별도 통합 테스트 필요. MVP 포함 여부 확정 필요.
- **CSRF 미들웨어 테스트:** 발급/검증 케이스 포함.
- **i18n / 다크모드 X** — 테스트 면제.
- **Lighthouse / Web Vitals:** D-1 리허설 시 1회 수동 점검 권장 (별도 자동화 X).
- **부하 테스트:** 30 동시 사용자 시뮬은 D-1 리허설로 대체 (k6 등 자동화 X).

---

## 15. 변경 영향 추적

| ADR | 테스트 책임 |
|---|---|
| ADR-015 SSE | §7 SSE 통합, E2E-05 |
| ADR-019 쿠폰 prefix (~~202637~~) | ~~§5.2~~ → **2026-05-13 갱신: 학과 코드 37 정규식 (§5.2 갱신, E2E-03 갱신)** |
| ADR-020 가격 무결성 | §4 4 케이스 (★ 핵심), §5.1 |
| ADR-021 학번+이름 필수 | §5.2, §6 통합, E2E-01·02 |
| ADR-022 자동 스냅샷 (~~30분~~ → 2시간) | §5 jobs, E2E-10 (timer 가속) |
| ADR-023 Docker | E2E `webServer` config |
| ADR-018 다일 운영 | §11 daily_no 회귀 |
| **2026-05-13 ADR-017 변경** (정적 BEST) | **§5.5 갱신 — 동적 카피 케이스 삭제** |
| **2026-05-13 G12** (부스 미니맵 모달) | **E2E-13 신규** |
| **2026-05-13 G13** (영업 토글) | **§5.7 business-state 신규 단위, §5.8 bootstrap 신규 단위, E2E-11 장사 시작, E2E-12 자동 CLOSED, E2E-14 init.sql 부팅, §12 실패 모드 #14·#15·#16 신규** |
| **2026-05-13 G14** (일회성) | **자동 스케줄링 X — 양일 각각 "장사 시작" 클릭 E2E-11 가정** |
