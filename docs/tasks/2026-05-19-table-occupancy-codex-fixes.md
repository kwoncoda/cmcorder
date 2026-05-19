# 2026-05-19 · table_lock Codex P1/P2 보완 라운드

## 목표

`table_lock` 라운드 1차 구현 후 Codex가 발견한 P1 3건 + P2 3건을 최소 변경으로 보완하여 main 병합 조건을 충족한다.

## 입력 리뷰 문서

- `codereview/codex_table_lock_review.md` (1차 리뷰 — P0 0, P1 3, P2/P3 다수)
- `codereview/codex_table_lock_p1_fix_review.md` (2차 재리뷰 — 조건부 커밋 가능 + 잔여 P2 3건)

## 1차 — P1 3건 해소

### P1-1 — 프론트 OrderStatusSchema에 DINING/SETTLED 누락

**문제**: 백엔드는 `DINING`/`SETTLED` 응답을 보내지만 `src/api/schemas.js`의 `OrderStatusSchema` enum은 8개만 허용. StatusPage, useOrderPolling, OrderDetailPage가 `ValidationError`로 실패할 수 있음.

**수정**:
- `src/api/schemas.js`: `OrderStatusSchema` enum에 `DINING`, `SETTLED` 추가 (8 → 10). `OrderSchema`에 `dining_at`, `settled_at` nullable optional 필드 추가.
- `src/components/molecules/StatusChip.jsx`: `STATUS_CONFIG`에 `DINING: { label: '식사 중', icon: '🍽️', cls: 'bg-success text-ink' }`, `SETTLED: { label: '정리 완료', icon: '🎉', cls: 'bg-success text-ink' }` 항목 추가. DONE은 레거시로 보존.
- `src/components/organisms/OrderTimeline.jsx`: `DINING`/`SETTLED`/`DONE` 모두 5단계 done으로 처리 (이전엔 DONE만 5단계).

**테스트**:
- `src/api/__tests__/schemas.test.js`: +5 케이스 (DINING/SETTLED enum, dining_at/settled_at 필드 통과).
- `src/components/molecules/__tests__/StatusChip.test.jsx`: it.each에 DINING/SETTLED 추가 + 회귀 2건.
- `src/components/organisms/__tests__/OrderTimeline.test.jsx`: +4 케이스 (DINING/SETTLED 5단계 done 회귀).

### P1-2 — 정산/자동 스냅샷이 DONE만 완료로 집계

**문제**: 새 흐름이 `READY → DINING → SETTLED`인데 `settlement.js`/`auto-snapshot.js`는 여전히 `status = 'DONE'`만 매출 집계. `DINING`도 마감 차단 진행 상태에서 빠짐. 결과: SETTLED 주문의 매출이 0원으로 누락되고, DINING 주문이 남아도 정산 마감 가능.

**수정**:
- `server/domain/settlement.js`:
  - `IN_PROGRESS_STATES`에 `DINING` 추가 → DINING 주문 있으면 마감 차단.
  - 신규 상수 `COMPLETED_STATES = ['SETTLED', 'DONE']` → `getSettlementSummary`가 SETTLED 우선 + 레거시 DONE 합산.
- `server/jobs/auto-snapshot.js`:
  - `exportOrdersCsv` 헤더에 `dining_at`, `settled_at` 추가 (회계 추적용).
  - `exportSummary` SQL이 `status IN ('SETTLED','DONE')`로 집계.

**테스트**:
- `server/domain/__tests__/settlement.test.js`: +5 케이스 (DINING 마감 차단, SETTLED + 레거시 DONE 합산, DINING은 in_progress 분류). 기존 DONE 케이스를 SETTLED로 의미상 갱신.
- `server/jobs/__tests__/auto-snapshot.test.js`: +2 케이스 (summary 집계 + 컬럼 존재 회귀).

### P1-3 — bootstrap 006이 기존 DB의 status CHECK를 갱신 못 함

**문제**: SQLite는 `ALTER TABLE`로 CHECK 변경 불가. 기존 1차 006 migration은 `ADD COLUMN`만 수행 → 기존 운영 DB는 `orders.status` CHECK enum이 옛 8개만 허용 → `READY → DINING` UPDATE가 `CHECK constraint failed`로 실패.

**수정**:
- `server/db/bootstrap.js` 006-table-lock 블록 재작성:
  1. `sqlite_master.sql`에서 orders 테이블 DDL을 읽어 `DINING`/`SETTLED` 포함 여부 확인.
  2. **포함 안 됨**: `orders_new` 테이블을 init.sql 최종 형태로 생성 → 기존 컬럼만 동적 INSERT SELECT (PRAGMA `table_info`로 실재 컬럼 확인 + 누락 컬럼은 NULL) → 기존 `orders` DROP → `orders_new` RENAME → 인덱스 재생성.
  3. **포함됨 (신규 DB)**: 컬럼 idempotent 추가만.
  4. `table_locks` 테이블은 항상 `IF NOT EXISTS`로 추가.
  5. 전체가 `db.transaction()` + `PRAGMA defer_foreign_keys = ON`으로 보호.

**테스트**:
- `server/__tests__/bootstrap.test.js` `legacyDb()` 헬퍼 추가 + 회귀 4건:
  - 옛 CHECK enum DB에서 bootstrap 후 `READY → DINING` UPDATE 성공
  - SETTLED UPDATE 성공
  - 기존 데이터 (no/name/total_price) 보존
  - 마이그레이션 idempotent (재실행 안전)
  - 신규 DB도 정상 동작 회귀

## 2차 — P2 3건 보완

### P2-#1 — delivery_type 미지정 + table_no null 허용 보완

**문제**: 1차 refine은 *명시적* `delivery_type='dineIn'`만 거부. `delivery_type` 미지정 (undefined) 케이스는 서버 기본값이 `dineIn`인데도 통과 → 공개 API로 매장 주문이 테이블 없이 생성될 수 있음.

**수정**:
- `server/routes/customer.js` `CreateOrderSchema.superRefine`:
  ```js
  const isDineIn = val.delivery_type === 'dineIn' || val.delivery_type === undefined;
  if (isDineIn && (val.table_no === null || val.table_no === undefined)) {
    ctx.addIssue({ ..., message: '매장 식사 주문은 테이블 번호를 선택해주세요.' });
  }
  ```
  → undefined도 dineIn으로 간주. 포장(`takeout`)만 table_no null 허용.

**테스트 영향**: 33+개 기존 페이로드가 `delivery_type` 미지정. 의미상 *테이블 검증과 무관한 회귀 테스트*들이라 일괄로 `delivery_type: 'takeout'` 추가하여 테스트 의도 보존:
- `server/routes/__tests__/customer.test.js`: 30+ 페이로드 갱신
- `server/routes/__tests__/admin.test.js`: 20+ 페이로드 갱신

### P2-#2 — 불완전 006이 이미 _migrations에 기록된 DB

**문제**: 1차 006이 *이미 _migrations에 마크*되었지만 schema는 옛 enum 그대로인 DB가 운영에 있을 수 있음. `if (!applied('006-table-lock'))` 가드 때문에 새 rebuild 로직이 스킵됨.

**수정**:
- `server/db/bootstrap.js`: `_migrations` 마크 *유무와 별개로* 매번 schema 검사. enum이 불완전하면 rebuild 실행. 마크는 *최초 1회만* INSERT (중복 방지).
  ```js
  const has006Mark = applied('006-table-lock');
  const checkAcceptsNewStates = ordersDdl.includes("'DINING'") && ordersDdl.includes("'SETTLED'");
  if (has006Mark && checkAcceptsNewStates) {
    // fast skip
  } else {
    // schema 불완전이면 rebuild, _migrations 마크는 has006Mark가 false일 때만.
  }
  ```

**테스트**: `server/__tests__/bootstrap.test.js` +2 케이스 (좀비 DB 자동 보정, 정상 DB fast skip 멱등).

### P2-#3 — dining_at/settled_at ISO 변환 누락

**문제**: 두 컬럼이 `server/routes/admin.js`의 `TS_FIELDS`에 미포함 → SQLite `'YYYY-MM-DD HH:MM:SS'` 그대로 응답. 프론트 timezone 540분 오차 가능성. customer serializer는 두 필드를 응답에 *아예 포함도 안 함*.

**수정**:
- `server/routes/admin.js`: `TS_FIELDS`에 `dining_at`, `settled_at` 추가.
- `server/routes/customer.js`: `serializeOrder`에 `dining_at: toIsoUtc(o.dining_at)`, `settled_at: toIsoUtc(o.settled_at)` 추가.

**테스트**:
- `server/routes/__tests__/customer.test.js` +1 케이스 (응답 키 존재 + 초기 null).
- `server/routes/__tests__/admin.test.js` +1 케이스 (`'2026-05-20 07:30:00'` → `'2026-05-20T07:30:00Z'` 변환 회귀).

## 테스트 결과 (최종)

### Vitest (docker exec)

```
docker compose -f docker-compose.dev.yml exec dev npm test -- --run
Test Files  106 passed (106)
Tests       1343 passed (1343)
Duration    166s
```

추이: 1311 (table_lock 1차) → 1339 (P1 보완) → 1343 (P2 보완).
신규 P1/P2 회귀 합 +21 케이스. 기존 페이로드 53+개에 `delivery_type: 'takeout'` 보강 (테스트 의도 보존, 기능 변화 0).

### Lint

```
docker compose -f docker-compose.dev.yml exec dev npm run lint
✖ 3 problems (0 errors, 3 warnings)
```

3건 모두 기존 unused eslint-disable 디렉티브 — 본 라운드 무관.

### Build

```
docker compose -f docker-compose.dev.yml exec dev npm run build
✓ built in 8.16s
TablesPage chunk 분리 + axe-core 흔적 0
```

## 수정한 파일 (P1+P2 종합)

### 소스

- `server/db/bootstrap.js` — 006 rebuild + schema 검사 분기 (P1-3 + P2-#2)
- `server/domain/settlement.js` — IN_PROGRESS_STATES + COMPLETED_STATES (P1-2)
- `server/jobs/auto-snapshot.js` — CSV 헤더 + summary 집계 (P1-2)
- `server/routes/customer.js` — superRefine 강화 + serializeOrder ISO 필드 (P2-#1, P2-#3)
- `server/routes/admin.js` — TS_FIELDS 확장 (P2-#3)
- `src/api/schemas.js` — OrderStatusSchema enum + OrderSchema 필드 (P1-1)
- `src/components/molecules/StatusChip.jsx` — DINING/SETTLED 매핑 (P1-1)
- `src/components/organisms/OrderTimeline.jsx` — DINING/SETTLED 5단계 done (P1-1)

### 테스트

- `server/__tests__/bootstrap.test.js` — +6 케이스 (P1-3 4건 + P2-#2 2건)
- `server/domain/__tests__/settlement.test.js` — +5 케이스, 기존 DONE → SETTLED 갱신 (P1-2)
- `server/jobs/__tests__/auto-snapshot.test.js` — +2 케이스 (P1-2)
- `server/routes/__tests__/customer.test.js` — +5 케이스 + 30+ 페이로드 갱신 (P1-1, P2-#1, P2-#3)
- `server/routes/__tests__/admin.test.js` — +1 케이스 + 20+ 페이로드 갱신 (P2-#3, P2-#1)
- `src/api/__tests__/schemas.test.js` — +5 케이스 (P1-1)
- `src/components/molecules/__tests__/StatusChip.test.jsx` — +2 회귀 (P1-1)
- `src/components/organisms/__tests__/OrderTimeline.test.jsx` — +4 회귀 (P1-1)

## 남은 리스크 (병합 후 후속)

| 항목 | 심각도 | 비고 |
|---|---|---|
| 운영 DB 적용 전 백업 + DDL 확인 | 필수 | 006 rebuild는 트랜잭션 보호되지만 SQLite table rebuild는 백업 후 진행 권장. `SELECT sql FROM sqlite_master WHERE name='orders'` 확인. |
| 동시 주문 race condition | P2 | 본 범위 외. 서버 409가 단일 방어선. 축제 현장 저동시성 운영이라 수용. |
| 점유+잠금 동시 상태 어드민 UI 배지 | P3 | 후속 |
| OrderDetailPage timeline history에 DINING/SETTLED 시각 | P3 | 후속 |
| 53개 페이로드 일괄 갱신 | 의미 변화 0 | `delivery_type: 'takeout'` 추가만. 모든 테스트가 동일 의도로 통과. |

## 다음에 할 것

- D-1 리허설 5/19 — 시뮬레이션 1회.
- 운영 DB 적용 전 백업 + `SELECT sql FROM sqlite_master` 확인.
- main 병합 후 PR 리뷰 절차.
