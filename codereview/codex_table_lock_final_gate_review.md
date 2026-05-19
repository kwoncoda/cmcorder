# Codex table_lock 최종 게이트 리뷰

## 1. 최종 판단

**커밋 가능**

확인한 사실:
- 현재 브랜치는 `table_lock`이다.
- `main...HEAD` 커밋 diff는 비어 있고, 기능 구현은 working tree 수정 파일과 untracked 신규 파일에 있다.
- 이전 P1 3건과 이후 P2 핵심 보완 항목은 현재 코드 기준 해결됐다.
- Codex가 선별 테스트 6개 파일 230개 케이스와 `npm run lint`를 직접 실행했고 통과했다.

판단:
- P0/P1 없음.
- 코드 기준 커밋 가능하다.
- main 병합은 가능하나, 병합/배포 전 DB 백업과 `006-table-lock` 적용 확인은 필수다.
- 커밋 전에는 untracked 신규 파일과 리뷰 문서를 빠짐없이 포함해야 한다.

## 2. P0/P1 이슈

없음.

## 3. 이전 P1/P2 해결 여부

| 항목 | 해결 여부 | 근거 파일 | 추가 수정 필요 여부 |
| --- | --- | --- | --- |
| `OrderStatusSchema` `DINING`/`SETTLED` | 해결 | `src/api/schemas.js:25-35`, `src/api/schemas.js:59-60`, `src/components/molecules/StatusChip.jsx:30-31`, `src/components/organisms/OrderTimeline.jsx:33-39` | 없음 |
| 정산/스냅샷 `SETTLED` 기준 | 해결 | `server/domain/settlement.js:23-36`, `server/domain/settlement.js:61-76`, `server/jobs/auto-snapshot.js:143-148`, `server/jobs/auto-snapshot.js:195-209` | 없음 |
| bootstrap 006 CHECK 제약 갱신 | 해결 | `server/db/bootstrap.js:202-337`, `server/db/init.sql:45-69`, `server/__tests__/bootstrap.test.js:273-408` | 코드 수정 없음. 운영 DB 백업/DDL 확인은 배포 절차로 필수 |
| `delivery_type` undefined `table_no` 필수 | 해결 | `server/routes/customer.js:74-84`, `server/routes/__tests__/customer.test.js:650-712` | 없음 |
| `dining_at`/`settled_at` ISO 변환 | 해결 | `server/routes/admin.js:88-114`, `server/routes/customer.js:325-349`, `server/routes/__tests__/admin.test.js:310-333`, `server/routes/__tests__/customer.test.js:715-733` | 없음 |

## 4. 남은 P2/P3 이슈

| 심각도 | 처리 구분 | 위치 | 이슈 | 판단 |
| --- | --- | --- | --- | --- |
| P2 | 병합/배포 전 필수 | 운영 DB 절차, `server/db/bootstrap.js` | 운영 DB 백업과 006 적용 확인이 필요하다. | 코드상 보정은 구현됐다. 다만 SQLite table rebuild가 포함되므로 운영 DB 적용 전 백업, `orders` DDL에 `DINING`/`SETTLED` 포함 여부 확인은 필수다. |
| P2 | 병합 후 개선 가능 | `server/routes/customer.js:154-160`, `server/domain/table-availability.js:137-176` | 동시 주문 race condition 가드는 범위 밖으로 남아 있다. | 사용자 진입/제출 직전 조회와 서버 409 guard는 있다. 거의 동시에 같은 테이블로 POST하는 경우는 여전히 가능하므로 축제 운영 중 고동시성 우려가 있으면 후속으로 DB transaction/lock 보강이 필요하다. |
| P3 | 병합 후 개선 가능 | `src/pages/admin/OrderDetailPage.jsx:87-96` | 주문 상세 timeline에 `DINING`/`SETTLED` 시각이 별도 단계로 표시되지는 않는다. | schema crash는 해결됐고 5단계 완료 처리도 된다. 상세 히스토리 표현 품질 개선으로 후속 처리 가능하다. |
| P3 | 병합 후 개선 가능 | `server/domain/table-availability.js:108-130`, `src/pages/admin/TablesPage.jsx:37-48` | 점유+잠금 동시 상태에서 별도 locked 배지가 부족하다. | 사용자는 계속 주문 불가라 기능 안전성은 유지된다. 관리자가 복합 상태를 더 쉽게 이해하도록 `locked` boolean/badge 노출을 후속 권장한다. |
| P3 | 커밋 전 확인 | Git 상태 | 수정 45개, untracked 16개가 아직 커밋되지 않았다. | 코드 이슈는 아니지만 커밋 누락 위험이다. 특히 신규 domain/repo/hook/page/test 파일을 반드시 staging해야 한다. |

## 5. delivery_type/table_no 리뷰

확인한 사실:
- `CreateOrderSchema.superRefine`에서 `delivery_type === 'dineIn' || delivery_type === undefined`를 dine-in으로 처리한다.
- dine-in 또는 `delivery_type` 미지정 상태에서 `table_no`가 `null`/`undefined`이면 `VALIDATION_ERROR`가 발생한다.
- `delivery_type='takeout'`이면 `table_no` null/미지정을 허용한다.
- 프론트 `CheckoutPage`는 기본값 `dineIn`을 보유하고, 주문 payload에 `delivery_type: delivery`와 `table_no: delivery === 'dineIn' ? Number(tableNo) : null`을 전송한다.
- table_no 범위는 계속 1~15다.

판단:
- 매장 식사 주문은 table_no 필수, 포장 주문은 table_no 선택이라는 정책과 일치한다.
- 기존 쿠폰/이체 계열 고객 API 테스트 중 테이블 기능과 무관한 주문 생성 케이스에 `delivery_type: 'takeout'`을 추가한 것은 테스트 목적을 크게 왜곡하지 않는다. 해당 테스트들은 쿠폰/학번/이체 검증이 목적이고, table guard를 회피하는 의도가 명확하다.
- dine-in 회귀는 별도 table_no 범위/guard 테스트에서 커버된다.

## 6. bootstrap 006 migration 리뷰

확인한 사실:
- 006 로직은 `_migrations`의 `006-table-lock` 마크 여부와 별개로 `sqlite_master`의 `orders` DDL을 읽어 `DINING`/`SETTLED` 포함 여부를 확인한다.
- 006 마크가 있어도 DDL이 불완전하면 `orders_new` 생성, 데이터 복사, 기존 테이블 교체, 인덱스 재생성을 수행한다.
- `dining_at`, `settled_at` 컬럼과 `table_locks` 테이블/인덱스를 보장한다.
- 006 마크는 없을 때만 insert해 중복 마크를 만들지 않는다.
- 테스트는 기존 CHECK DB, 불완전 006 마크가 이미 있는 DB, 정상 DB 재실행 no-op을 검증한다.

판단:
- 이전 P1/P2 migration 리스크는 코드 기준 해결됐다.
- `PRAGMA defer_foreign_keys = ON`을 transaction 내부에서 설정하고, `orders.id`를 보존해 `order_items` FK 관계를 유지하는 접근은 현재 SQLite 구조에서 타당하다.
- 운영 적용 전 백업은 여전히 필수다. table rebuild는 테스트가 있어도 실데이터 적용 전 복구 지점이 필요하다.

## 7. timestamp serializer 리뷰

확인한 사실:
- `server/routes/admin.js`의 `TS_FIELDS`에 `dining_at`, `settled_at`이 추가됐다.
- `server/routes/customer.js`의 `serializeOrder`가 `dining_at`, `settled_at`을 응답에 포함하고 `toIsoUtc`로 변환한다.
- null 값은 `toIsoUtc(null)`이 null을 그대로 반환한다.
- admin/customer 테스트가 ISO Z 변환과 초기 null 포함을 검증한다.

판단:
- admin/customer 응답의 신규 timestamp 처리 일관성이 회복됐다.
- 프론트 timer/elapsed 계산과 충돌할 근거는 보이지 않는다. ISO Z 형식은 기존 timestamp 정책과도 맞다.

## 8. 테스트/lint/build 리뷰

Codex 직접 실행:

```text
npm test -- --run server/__tests__/bootstrap.test.js server/routes/__tests__/customer.test.js server/routes/__tests__/admin.test.js src/api/__tests__/schemas.test.js server/domain/__tests__/settlement.test.js server/jobs/__tests__/auto-snapshot.test.js
```

결과:

```text
6 passed, 230 tests passed
```

Codex 직접 실행:

```text
npm run lint
```

결과:

```text
0 errors, 3 warnings
```

warning은 기존 미사용 eslint-disable 경고다:
- `src/components/ErrorBoundary.jsx`
- `src/hooks/useApi.js`
- `src/hooks/useGlobalErrorHandler.js`

Claude 보고:
- `bootstrap.test.js`: 20/20 passed
- `customer.test.js`: 78/78 passed
- `admin.test.js`: 89/89 passed
- 전체 docker test: 1343/1343 passed
- `npm run lint`: 0 errors / 3 existing warnings
- `npm run build`: success

Codex는 `npm run build`를 직접 실행하지 않았다. 이유는 build가 `dist` 산출물을 갱신할 수 있고, 이번 작업은 리뷰 문서 작성만 허용되어 있기 때문이다.

## 9. 커밋 전 확인

포함해야 할 파일:
- 수정 파일 45개 전체
- 신규 table_lock 파일:
  - `server/domain/table-availability.js`
  - `server/domain/__tests__/table-availability.test.js`
  - `server/repositories/table-locks-repo.js`
  - `server/repositories/__tests__/table-locks-repo.test.js`
  - `src/hooks/useTablesAvailability.js`
  - `src/hooks/__tests__/useTablesAvailability.test.jsx`
  - `src/pages/admin/TablesPage.jsx`
  - `src/pages/admin/__tests__/TablesPage.test.jsx`
  - `src/constants/__tests__/admin-columns.test.js`
- 정책 문서:
  - `docs/table_occupancy_development_plan.md`
  - `docs/table_occupancy_work_instruction.md`
  - `docs/table_occupancy_qa_plan.md`
- 리뷰 문서:
  - `codereview/codex_table_lock_review.md`
  - `codereview/codex_table_lock_p1_fix_review.md`
  - `codereview/codex_table_lock_final_gate_review.md`

제외해야 할 파일:
- `.env`
- DB 실데이터
- `dist`
- `node_modules`
- 세션/비밀 파일
- 로컬 에이전트/테스트 산출물

untracked 파일 처리:
- 현재 `git ls-files --others --exclude-standard` 기준 untracked 16개가 있다.
- 기능에 필요한 신규 코드/테스트 파일은 모두 커밋 대상이다.
- `docs/tasks/2026-05-19-table-occupancy*.md`는 작업 로그 성격이므로 팀 정책에 따라 커밋 여부를 결정하되, 실서비스 동작에는 필요하지 않다.

커밋 전 재실행 권장 명령:

```text
npm test -- --run
npm run lint
npm run build
```

DB 적용 전 확인 권장 SQL:

```sql
SELECT sql FROM sqlite_master WHERE type='table' AND name='orders';
SELECT name FROM _migrations WHERE name='006-table-lock';
```

## 10. main 병합 전 수동 QA 체크리스트

- [ ] 운영/스테이징 DB 백업
- [ ] DB 초기화 또는 006 migration 적용
- [ ] 기존 DB에서 `DINING`/`SETTLED` 업데이트 가능 확인
- [ ] `dineIn + table_no 없음`이 400 `VALIDATION_ERROR`로 거부됨
- [ ] `delivery_type` 미지정 + `table_no 없음`이 400 `VALIDATION_ERROR`로 거부됨
- [ ] `takeout + table_no 없음`이 정상 생성됨
- [ ] 5번 테이블 점유 후 다른 사용자의 5번 선택/POST 차단
- [ ] READY → DINING
- [ ] DINING → SETTLED
- [ ] SETTLED 주문이 정산 집계에 포함됨
- [ ] DINING 주문이 남아 있을 때 마감 차단
- [ ] 테이블 잠금/해제
- [ ] 점유+잠금 우선순위: 사용자는 주문 불가, 관리자는 운영상 상태를 이해할 수 있음
- [ ] 쿠폰 사용/중복 방지 회귀 없음
- [ ] 다른 이름 이체 회귀 없음
- [ ] 이체 완료 요청 회귀 없음
- [ ] 미니맵 이미지와 1~15 테이블 표시 회귀 없음

## 11. 결론

커밋 가능 여부:
- **커밋 가능**. P0/P1은 없고, 이전 P1/P2 핵심 이슈는 해결됐다.
- 단, 커밋 전 untracked 신규 파일을 빠짐없이 포함해야 한다.

main 병합 가능 여부:
- **병합 가능**. 단, DB 백업과 006 적용 확인은 병합/배포 전 필수 게이트다.

병합 전 반드시 해야 할 것:
- 전체 test/lint/build 재실행
- staging 파일 목록 검토
- 운영/스테이징 DB 백업
- 기존 DB에서 `orders.status` CHECK가 `DINING`/`SETTLED`를 허용하는지 확인

병합 후 추적할 것:
- 동시 주문 race condition 방어
- 점유+잠금 동시 상태의 관리자 UI 배지/해제 UX
- `OrderDetailPage` timeline의 `DINING`/`SETTLED` 시각 표시 개선
