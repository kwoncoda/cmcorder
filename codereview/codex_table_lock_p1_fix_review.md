# Codex table_lock P1 수정 재리뷰

## 1. 최종 판단

**조건부 커밋 가능**

확인한 사실:
- 현재 브랜치는 `table_lock`이다.
- `main...HEAD` 커밋 diff는 비어 있고, 구현은 현재 working tree 변경사항과 untracked 파일로 존재한다.
- 이전 Codex 리뷰의 P1 3건은 현재 코드 기준으로 모두 해소되었다.
- 선별 회귀 테스트 7개 파일, 180개 테스트가 통과했고, `npm run lint`는 0 error / 기존 warning 3개다.

판단:
- P0/P1은 없다.
- 커밋은 가능하지만, 커밋 전에는 untracked 신규 파일을 빠짐없이 포함해야 한다.
- main 병합은 조건부 가능하다. 특히 배포 전 DB 백업과 `006-table-lock` 적용 상태 확인이 필요하다.

## 2. P0/P1 이슈

없음.

## 3. 이전 P1 3건 해결 여부

| P1 항목 | 해결 여부 | 근거 파일 | 추가 수정 필요 여부 |
| --- | --- | --- | --- |
| P1-1. `OrderStatusSchema`의 `DINING`/`SETTLED` 누락 | 해결 | `src/api/schemas.js:25-35`, `src/api/schemas.js:59-60`, `src/components/molecules/StatusChip.jsx:30-31`, `src/components/organisms/OrderTimeline.jsx:33-39`, `src/api/__tests__/schemas.test.js:77-205` | P1 추가 수정 없음. `dining_at`/`settled_at` ISO 변환 일관성은 P3로 별도 기록 |
| P1-2. 정산/자동 스냅샷이 `DONE`만 완료로 집계 | 해결 | `server/domain/settlement.js:23-36`, `server/domain/settlement.js:61-76`, `server/jobs/auto-snapshot.js:143-148`, `server/jobs/auto-snapshot.js:195-209`, `server/domain/__tests__/settlement.test.js:61-120`, `server/jobs/__tests__/auto-snapshot.test.js:104-130` | P1 추가 수정 없음 |
| P1-3. 기존 DB `orders.status` CHECK가 `DINING`/`SETTLED`를 허용하지 않음 | 해결, 단 운영 절차 조건 있음 | `server/db/bootstrap.js:202-321`, `server/db/init.sql:45-69`, `server/__tests__/bootstrap.test.js:201-340` | 코드 기준 해결. 다만 예전 불완전 `006-table-lock`이 이미 적용된 DB는 `_migrations` 때문에 새 rebuild가 스킵될 수 있어 배포 전 확인 필요 |

## 4. 남은 P2/P3 이슈

| 심각도 | 병합 전 필수 여부 | 위치 | 이슈 | 판단 |
| --- | --- | --- | --- | --- |
| P2 | 병합 전 결정 필요 | `server/routes/customer.js:74-82`, `server/routes/customer.js:153-159`, `server/routes/customer.js:195-196` | `delivery_type` 미지정 + `table_no` null/미지정 API 호출은 여전히 `dineIn` 기본값으로 저장될 수 있다. | 프론트 `CheckoutPage`는 `delivery_type`과 `table_no`를 정상 전송하므로 일반 사용자 흐름은 안전하다. 다만 공개 고객 API 직접 호출에서는 테이블 없는 매장 주문이 생성될 수 있어 운영 데이터 정확도 리스크가 있다. 병합 전 수정하거나, 호환 유지가 의도라면 운영상 허용 사유를 문서화해야 한다. |
| P2 | 배포 전 필수 | `server/db/bootstrap.js:209-321` | 새 `006-table-lock`은 현재 코드로 처음 실행되는 기존 DB에는 안전하지만, 예전 불완전 006이 이미 `_migrations`에 기록된 DB는 새 rebuild를 실행하지 않는다. | main 병합 전 코드 차단은 아니지만 운영 DB 적용 전 백업과 `sqlite_master`의 `orders` DDL 확인이 필수다. 불완전 006이 이미 적용된 환경이 있으면 007 보정 migration 또는 수동 rebuild 절차가 필요하다. |
| P2 | 병합 후 가능, 운영 정책에 따라 병합 전 권장 | `server/routes/customer.js:153-159`, `server/domain/table-availability.js:137-176` | 동시 주문 race condition 가드는 없다. | 진입/제출 직전 availability 재조회와 서버 409 방어는 구현됐다. 거의 동시 POST 2건은 둘 다 통과할 수 있다. 축제 현장 단일/저동시성 운영이면 수용 가능하지만, DB lock/transaction 기반 보강은 후속 과제로 추적해야 한다. |
| P3 | 병합 후 가능 | `server/domain/table-availability.js:108-130`, `src/pages/admin/TablesPage.jsx:37-48` | 점유 중인 테이블에 수동 잠금이 같이 걸린 경우 관리자 UI는 `occupied`/`dining`만 보여주고 별도 잠금 배지나 해제 버튼을 보여주지 않는다. | 사용자 주문 차단은 유지된다. 다만 관리자가 "점유 중 + 수동 잠금" 복합 상태를 즉시 이해하거나 점유 중에 잠금을 해제하기 어렵다. 운영 혼동 방지를 위해 별도 `locked` boolean/badge 노출을 권장한다. |
| P3 | 병합 후 가능 | `server/routes/admin.js:88-96`, `server/routes/customer.js:324-345`, `src/pages/admin/OrderDetailPage.jsx:87-96` | `dining_at`/`settled_at`이 timestamp ISO 변환 목록에 없고, 고객 serializer는 두 필드를 내려주지 않는다. 관리자 상세 timeline history에도 두 필드가 없다. | 현재 `AdminCardColumn` 타이머는 SQLite timestamp도 처리하는 유틸을 사용하므로 즉시 장애 가능성은 낮다. 그래도 기존 timestamp 정책과 일관되게 serializer와 상세 timeline을 보강하는 것이 좋다. |
| P3 | 커밋 전 필수 | Git 상태 | `main...HEAD`는 비어 있고, 구현 파일 다수가 working tree/untracked 상태다. | 기능 코드 문제가 아니라 절차 문제다. 커밋 전 신규 파일을 빠뜨리면 main 병합 시 기능이 누락된다. |

## 5. 정산/스냅샷 리뷰

확인한 사실:
- `server/domain/settlement.js`의 `IN_PROGRESS_STATES`에 `DINING`이 포함됐다.
- 완료 집계는 `COMPLETED_STATES = ['SETTLED', 'DONE']`로 변경됐다.
- `getSettlementSummary`는 `SETTLED`와 레거시 `DONE`을 합산한다.
- `canCloseSettlement`는 `DINING` 주문이 있으면 `false`를 반환한다.
- `auto-snapshot`의 `summary.json` 완료 집계도 `SETTLED` + `DONE` 기준으로 바뀌었다.
- `orders.csv` 헤더에 `dining_at`, `settled_at`이 추가됐다.

판단:
- P1-2는 해결됐다.
- `DONE` 호환은 레거시 데이터 집계 범위로 제한되어 있고, 새 정상 흐름은 `SETTLED` 기준이다.
- `CANCELED`는 완료 매출 집계에 포함되지 않는다.

## 6. bootstrap 006 migration 리뷰

확인한 사실:
- `init.sql`의 `orders.status` CHECK에는 `DINING`, `SETTLED`가 포함되어 있다.
- `init.sql`에는 `dining_at`, `settled_at` 컬럼과 `table_locks` 테이블이 포함되어 있다.
- `bootstrap.js`의 `006-table-lock`은 `sqlite_master`에서 기존 `orders` DDL을 확인하고, `DINING`/`SETTLED`가 없으면 `orders_new`를 만들어 데이터를 복사한 뒤 교체한다.
- 테스트는 기존 CHECK DB에서 `READY -> DINING`, `SETTLED` 업데이트 가능 여부와 2회 실행 idempotent를 검증한다.

판단:
- 현재 코드로 006이 처음 실행되는 기존 DB는 P1-3이 해결된다.
- 운영 DB 적용 전 백업은 필수다. SQLite table rebuild는 데이터 보존 테스트가 있어도 운영 볼륨에서는 사전 백업 없이 적용하면 안 된다.
- 예전 불완전 006이 이미 적용되어 `_migrations`에 `006-table-lock`이 있는 DB는 새 006이 스킵된다. 해당 환경이 하나라도 있으면 배포 전 `orders` DDL을 확인하고, 필요하면 007 보정 migration 또는 수동 rebuild 절차를 마련해야 한다.

## 7. 프론트 상태 schema/StatusChip/OrderTimeline 리뷰

확인한 사실:
- `OrderStatusSchema`가 10개 상태를 허용한다: `ORDERED`, `TRANSFER_REPORTED`, `PAID`, `COOKING`, `READY`, `DINING`, `SETTLED`, `DONE`, `HOLD`, `CANCELED`.
- `OrderSchema`는 `dining_at`, `settled_at`을 nullable optional로 허용한다.
- `StatusChip`은 `DINING`을 "식사 중", `SETTLED`를 "정리 완료"로 렌더링한다.
- `OrderTimeline`은 `DINING`, `SETTLED`, 레거시 `DONE`을 5단계 완료 상태로 처리해 crash나 0단계 표시를 피한다.
- 관련 schema/chip/timeline 테스트가 추가되어 통과했다.

판단:
- P1-1은 해결됐다.
- 다만 `OrderDetailPage`의 timeline history에는 아직 `DINING`/`SETTLED` 시각이 포함되지 않는다. 이는 상세 표시 품질 문제로 P3다.

## 8. 테스트/lint/build 리뷰

Codex 직접 실행:

```text
npm test -- --run src/api/__tests__/schemas.test.js src/components/molecules/__tests__/StatusChip.test.jsx src/components/organisms/__tests__/OrderTimeline.test.jsx server/domain/__tests__/settlement.test.js server/jobs/__tests__/auto-snapshot.test.js server/__tests__/bootstrap.test.js server/routes/__tests__/customer.test.js
```

결과:

```text
7 passed, 180 tests passed
```

Codex 직접 실행:

```text
npm run lint
```

결과:

```text
0 errors, 3 warnings
```

warning은 기존 `eslint-disable` 미사용 경고 3건이다:
- `src/components/ErrorBoundary.jsx`
- `src/hooks/useApi.js`
- `src/hooks/useGlobalErrorHandler.js`

Claude 보고:
- `docker compose -f docker-compose.dev.yml exec dev npm test -- --run`: 1339/1339 passed
- `npm run lint`: 0 errors / 3 existing warnings
- `npm run build`: success

Codex는 `npm run build`를 직접 실행하지 않았다. 이유는 build가 `dist` 산출물을 갱신할 수 있고, 이번 작업은 리뷰 문서 작성만 허용되어 있기 때문이다.

## 9. 커밋 전 확인

포함해야 할 파일:
- 기존 수정 파일 전체: `server/db/bootstrap.js`, `server/db/init.sql`, `server/domain/order-state.js`, `server/domain/settlement.js`, `server/jobs/auto-snapshot.js`, `server/routes/customer.js`, `server/routes/admin.js`, `src/api/schemas.js`, `src/components/molecules/StatusChip.jsx`, `src/components/organisms/OrderTimeline.jsx`, `src/pages/customer/CheckoutPage.jsx`, `src/pages/admin/OrderDetailPage.jsx` 등 table_lock 관련 수정 파일
- 신규 도메인/저장소 파일: `server/domain/table-availability.js`, `server/repositories/table-locks-repo.js`
- 신규 훅/페이지: `src/hooks/useTablesAvailability.js`, `src/pages/admin/TablesPage.jsx`
- 신규/수정 테스트 파일 전체
- 필수 정책 문서: `docs/table_occupancy_development_plan.md`, `docs/table_occupancy_work_instruction.md`, `docs/table_occupancy_qa_plan.md`

제외해야 할 파일:
- `.env`
- DB 실데이터
- `dist`
- `node_modules`
- 세션/비밀 파일
- `.agents`, `.claude`, `test-results` 등 로컬 실행 산출물

working tree/untracked 상태:
- `main...HEAD`는 비어 있다.
- `git diff --name-only`에는 45개 수정 파일이 있다.
- `git ls-files --others --exclude-standard`에는 신규 table_lock 파일과 리뷰 문서가 있다.
- 커밋 전 untracked 파일 누락 여부를 반드시 확인해야 한다.

커밋 전 재실행 권장 명령:

```text
npm test -- --run
npm run lint
npm run build
```

배포 전 DB 확인 권장:

```sql
SELECT sql FROM sqlite_master WHERE type='table' AND name='orders';
SELECT name FROM _migrations WHERE name='006-table-lock';
```

`orders` CHECK에 `DINING`, `SETTLED`가 없는데 `_migrations`에는 `006-table-lock`이 있으면 새 코드가 자동 보정하지 못한다. 이 경우 007 보정 migration 또는 수동 rebuild가 필요하다.

## 10. main 병합 전 수동 QA 체크리스트

- [ ] READY 주문에서 "전달 완료" 클릭 시 `READY -> DINING`
- [ ] DINING 주문에서 "테이블 준비 완료" 클릭 시 `DINING -> SETTLED`
- [ ] SETTLED 주문이 정산 매출/주문 수에 집계됨
- [ ] DINING 주문이 남아 있을 때 정산 마감이 차단됨
- [ ] 기존 DB에 migration 006 적용 후 `orders.status` CHECK가 `DINING`/`SETTLED`를 허용함
- [ ] 운영 DB 적용 전 백업 완료
- [ ] 특정 테이블 주문 후 같은 테이블이 사용자 선택 UI와 POST에서 차단됨
- [ ] CANCELED 또는 SETTLED 후 해당 테이블이 다시 사용 가능함
- [ ] 테이블 잠금/해제 후 사용자 UI와 POST guard가 일치함
- [ ] 점유+잠금 동시 상태에서 사용자는 계속 주문 불가이고, 관리자는 운영상 상태를 이해할 수 있음
- [ ] 오래된 주문 화면에서 제출 직전 availability 재조회로 이미 사용 중인 테이블이 차단됨
- [ ] 포장 주문은 `table_no` 없이 정상 생성됨
- [ ] 매장 주문은 프론트에서 `delivery_type='dineIn'`과 1~15 `table_no`를 함께 전송함
- [ ] 쿠폰 사용/중복 방지 회귀 없음
- [ ] 다른 이름 이체 기능 회귀 없음
- [ ] 이체 완료 요청 흐름 회귀 없음
- [ ] 미니맵 이미지와 1~15 테이블 표시 회귀 없음

## 11. 결론

커밋 가능 여부:
- **조건부 커밋 가능**. P0/P1은 해소됐고 선별 테스트와 lint가 통과했다.
- 단, 현재 변경사항이 커밋이 아니라 working tree/untracked 상태이므로 신규 파일을 빠짐없이 포함해야 한다.

main 병합 가능 여부:
- **조건부 가능**. P1 수정은 완료됐으나, 병합 전 최소한 다음을 확인해야 한다.

병합 전 반드시 해야 할 것:
- 운영/스테이징 DB 백업
- `_migrations`와 `orders` DDL 확인
- 예전 불완전 006이 적용된 DB가 있으면 보정 절차 마련
- `delivery_type` 미지정 + `table_no` null 허용을 수정할지, 호환 유지로 문서화할지 결정
- full test/lint/build 재실행

병합 후 추적할 것:
- 점유+잠금 동시 상태의 관리자 UI 배지/해제 UX
- `dining_at`/`settled_at` ISO 변환 및 상세 timeline 표시
- 동시 주문 race condition 방어
- 고객 serializer의 `dining_at`/`settled_at` 포함 여부 정리
