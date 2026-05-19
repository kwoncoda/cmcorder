# Codex table_lock 코드 리뷰

## 1. 최종 판단

**병합 보류**

확인한 사실: 현재 브랜치는 `table_lock`입니다. `git diff main...HEAD`는 비어 있고, 구현은 커밋된 브랜치 차이가 아니라 현재 working tree 변경 및 untracked 파일로 존재합니다. 리뷰 대상 문서 3개(`docs/table_occupancy_development_plan.md`, `docs/table_occupancy_work_instruction.md`, `docs/table_occupancy_qa_plan.md`)를 먼저 읽고 정책 기준으로 대조했습니다.

판단: 테이블 availability, 잠금/해제, READY -> DINING -> SETTLED 전이의 서버 도메인 골격은 대체로 구현되어 있습니다. 그러나 새 상태가 프론트 응답 스키마와 정산 도메인에 반영되지 않아 실제 운영 흐름에서 페이지 검증 실패와 정산 누락이 발생합니다. 또한 bootstrap migration이 기존 DB의 `orders.status` CHECK를 갱신하지 못해 stale DB 볼륨에서는 핵심 전이가 실패합니다.

## 2. P0/P1 이슈

| 심각도 | 파일/위치 | 문제 | 근거 | 영향 | Claude 수정 지시 |
| --- | --- | --- | --- | --- | --- |
| P1 | `src/api/schemas.js:24-33`, `src/pages/customer/StatusPage.jsx:41`, `src/hooks/useOrderPolling.js:80`, `src/pages/admin/OrderDetailPage.jsx:34` | 프론트 `OrderStatusSchema`가 `DINING`, `SETTLED`를 허용하지 않습니다. | 서버는 `DINING`/`SETTLED`를 반환하지만 `OrderSchema` 검증 경로가 StatusPage, CompletePage, TransferPage, useOrderPolling, Admin OrderDetail에 사용됩니다. 추가 확인 명령에서도 `DINING:false`, `SETTLED:false`가 재현되었습니다. | 주문이 식사 중/정리 완료 상태가 된 뒤 고객 상태 페이지 직접 접근, polling 갱신, 관리자 주문 상세가 `ValidationError`로 실패할 수 있습니다. | `src/api/schemas.js`의 `OrderStatusSchema`에 `DINING`, `SETTLED`를 추가하고 `dining_at`, `settled_at` optional 필드도 반영하세요. `schemas.test`, `StatusPage.test`, `OrderDetailPage.test`에 `DINING`/`SETTLED` 실제 schema 검증 케이스를 추가하세요. |
| P1 | `server/domain/settlement.js:21-27`, `server/domain/settlement.js:55-66`, `server/jobs/auto-snapshot.js:143-147`, `server/jobs/auto-snapshot.js:201-205` | 정산/스냅샷이 새 완료 상태 `SETTLED`를 집계하지 않고 여전히 `DONE`만 완료 매출로 봅니다. `DINING`도 마감 진행 중 상태에서 빠져 있습니다. | 인메모리 확인: `SETTLED` 주문 1건 18,000원을 넣어도 `getSettlementSummary`가 `total_orders:0`, `total_amount:0`을 반환했고 `canClose:true`였습니다. `DINING` 주문만 있어도 `canCloseSettlement`가 `true`였습니다. | 새 정상 흐름의 매출이 정산에서 0원으로 누락되고, 식사 중인 테이블이 있어도 정산 마감이 가능해집니다. 학교 축제 정산 앱의 핵심 회귀입니다. | 완료 집계는 최소 `status IN ('SETTLED','DONE')`로 legacy DONE을 보존하고, 마감 차단 상태에는 `DINING`을 포함하세요. `auto-snapshot` summary와 `orders.csv` 헤더에도 `dining_at`, `settled_at`을 포함하세요. 정산 테스트에 SETTLED 매출 집계, DINING 마감 차단, legacy DONE 집계 유지 케이스를 추가하세요. |
| P1 | `server/db/bootstrap.js:202-230`, `server/db/init.sql:45-69` | 006 migration이 기존 DB의 `orders.status` CHECK를 갱신하지 못합니다. | `init.sql` 신규 DB는 `DINING`/`SETTLED` CHECK가 포함되어 정상입니다. 그러나 `bootstrap.js`는 컬럼만 추가하고 CHECK table rebuild를 하지 않습니다. 기존 CHECK가 있는 DB를 흉내 낸 인메모리 DB에서 006 적용 후 `UPDATE orders SET status='DINING'`이 `CHECK constraint failed`로 실패했습니다. | stale 운영 볼륨에서 READY -> DINING, DINING -> SETTLED 전이가 500/SQLITE_CONSTRAINT로 실패합니다. Claude가 남긴 "stale prod 볼륨 500 방지" 안전망이 실제로는 불완전합니다. | 둘 중 하나로 정리하세요. 1. 기존 DB 지원이 필요하면 `orders` table rebuild migration으로 CHECK를 갱신하고 테스트를 추가하세요. 2. 문서 정책대로 DB 초기화를 강제할 계획이면 006의 stale safety 의미를 제거/문서화하고 운영 반영 전 DB 초기화를 필수 절차로 명시하세요. |

## 3. P2/P3 이슈

| 심각도 | 병합 전 필수 여부 | 위치 | 이슈 | 판단/수정 방향 |
| --- | --- | --- | --- | --- |
| P2 | 병합 전 권장 | `server/routes/customer.js:140-146`, `server/routes/customer.js:182-183` | dine-in 주문에서 `table_no`가 `null`/미지정이면 서버 availability 검증을 건너뛰고 `dineIn + table_no:null` 주문이 생성됩니다. | 프론트는 tableNo 필수라 정상 사용자 흐름은 보호됩니다. 다만 공개 API 직접 호출 시 테이블 점유 없이 매장 주문이 들어갈 수 있습니다. `delivery_type === 'dineIn'`이면 `table_no` 필수로 refine하는 것이 안전합니다. 포장 주문은 계속 `null` 허용해야 합니다. |
| P2 | 병합 전 권장 | `server/routes/customer.js:140-146`, `server/domain/table-availability.js:144-176` | 제출 직전 서버 가드는 있지만 동시성 가드는 없습니다. | 두 사용자가 같은 테이블로 거의 동시에 POST하면 둘 다 availability 통과 후 insert될 수 있습니다. 축제 현장 트래픽이 몰릴 수 있으면 주문 생성 트랜잭션 안 재확인 또는 DB 레벨 점유 제약/락이 필요합니다. |
| P2 | 병합 전 권장 | `server/domain/table-availability.js:108-130`, `src/pages/admin/TablesPage.jsx:36-48` | 점유 중인 테이블에 수동 잠금이 함께 걸린 경우 관리자 테이블 탭이 잠금 여부를 표시하거나 해제할 수 없습니다. | 도메인은 locked와 occupied를 별도 저장하지만 admin view가 `occupied`/`dining`을 우선하면서 lock flag를 노출하지 않습니다. "수동 잠금과 주문 점유는 별도 개념" 정책상 `locked` boolean 또는 별도 배지를 제공하는 편이 안전합니다. |
| P2 | 병합 전 권장 | `src/components/molecules/StatusChip.jsx:21-30`, `src/components/organisms/OrderTimeline.jsx:15-40`, `src/pages/admin/OrderDetailPage.jsx:88-95` | 관리자 상세 UI 구성요소가 `DINING`/`SETTLED`를 완전히 이해하지 못합니다. | 현재 schema P1을 고치면 `StatusChip`은 DINING/SETTLED를 ORDERED로 fallback할 수 있고, `OrderTimeline`은 새 상태에서 0단계로 보일 수 있습니다. `OrderDetailPage` history에도 dining/settled 시각이 없습니다. |
| P2 | 병합 전 필수 | Git 상태 | 구현이 대부분 working tree/untracked에 있고 `main...HEAD` 커밋 diff가 비어 있습니다. | 리뷰 대상에는 포함했지만, 병합 전 `git add`/커밋 누락 여부를 반드시 확인해야 합니다. 특히 신규 도메인/훅/페이지/테스트 파일이 untracked입니다. |
| P3 | 병합 후 가능 | `server/routes/admin.js:88-96`, `server/routes/customer.js:326-331` | timestamp serializer 목록에 `dining_at`, `settled_at`이 빠져 있습니다. | `elapsedMinutesUtil`이 SQLite timestamp를 처리하므로 대시보드 타이머는 큰 문제는 아니지만 API timestamp 형식 일관성은 깨집니다. |
| P3 | 병합 후 가능 | `server/routes/admin.js:174-182` | history fallback label map에 `DINING`, `SETTLED`가 없습니다. | 현재 `order-repo`가 `action_name`을 기록하므로 실제 신규 로그는 정상입니다. 과거/수동 row에서 action_name이 비면 event_type 원문으로 보일 수 있습니다. |
| P3 | 병합 후 가능 | nginx/Express | `HEAD /`는 404이고 `GET /`는 200입니다. | 실제 브라우저 접속은 GET이므로 병합 차단은 아닙니다. 다만 `curl -I` 진단이 404로 보이는 기존 트랩은 남아 있습니다. |

## 4. 문서 정책 반영 여부

| 정책 | 반영 여부 | 근거 파일 | 추가 수정 필요 여부 |
| --- | --- | --- | --- |
| READY -> DINING -> SETTLED | 부분 반영 | `server/domain/order-state.js:36-42`, `server/repositories/order-repo.js:159-166`, `src/components/organisms/AdminCardColumn.jsx` | P1/P2 수정 필요. 서버 전이는 있으나 프론트 schema, 정산, 상세 UI가 미완입니다. |
| DONE dead status | 부분 반영 | `server/domain/order-state.js:42-44`, `server/domain/__tests__/order-state.test.js` | 정산/스냅샷이 DONE을 여전히 유일한 완료 상태로 사용하므로 수정 필요. |
| order_no 사용자 미노출 | 반영 | `server/domain/table-availability.js:79-96`, `server/routes/customer.js:126-131` | 없음. 사용자 availability는 `{table_no,status}`만 반환합니다. |
| DINING 30/60분 임계 | 반영 | `src/components/organisms/AdminCardColumn.jsx:48-52`, 관련 테스트 | 없음. 단, API timestamp 일관성은 P3입니다. |
| reason 컬럼 미생성 | 반영 | `server/db/init.sql:153-165`, `server/repositories/table-locks-repo.js` | 없음. |
| availability 진입 1회 + 제출 직전 1회 | 반영 | `src/hooks/useTablesAvailability.js`, `src/pages/customer/CheckoutPage.jsx:34-52`, `CheckoutPage.test.jsx` | 동시성 가드 보완은 별도 P2입니다. |
| admin_events category='system' | 반영 | `server/routes/admin.js:522-567`, `server/routes/__tests__/admin.test.js` | fallback label P3 외 없음. |
| init.sql 단일 갱신 + migration deviation | 이탈 있음 | `server/db/init.sql`, `server/db/bootstrap.js:202-230` | P1. migration을 완성하거나 DB 초기화를 필수 운영 절차로 고정해야 합니다. |

## 5. 테이블 availability 리뷰

확인한 사실:

- 사용자 availability는 1~15 테이블을 반환하고 `order_no`, `dining_at`, `locked_at`을 노출하지 않습니다.
- 점유 상태 집합은 `ORDERED`, `TRANSFER_REPORTED`, `PAID`, `COOKING`, `READY`, `DINING`, `HOLD`입니다.
- `SETTLED`, `CANCELED`, `DONE`은 점유로 계산하지 않습니다.
- `DINING`은 user/admin view 모두에서 `occupied`보다 우선되는 세부 상태로 표시됩니다.
- 수동 잠금과 주문 점유는 저장소 수준에서는 분리되어 있습니다.

판단:

- 사용자 주문 차단 관점의 기본 계산은 문서 정책과 맞습니다.
- 다만 admin view는 occupied/dining과 lock이 겹칠 때 lock 사실을 숨깁니다. 운영자가 "이 테이블은 식사 중이고 식사 후에도 잠금 유지" 상태를 확인하거나 미리 해제하기 어렵습니다.
- 동시성 가드가 없어 같은 테이블 중복 주문을 완전히 막지는 못합니다. 프론트 제출 직전 재조회는 UX 가드이고 서버 최종 방어는 단일 요청 기준입니다.

## 6. 주문 생성 table guard 리뷰

확인한 사실:

- `CreateOrderSchema.table_no`는 1~15 정수만 허용하고 문자열, 0, 16 등은 validation error입니다.
- `POST /api/orders`는 `delivery_type === 'dineIn' && table_no != null`일 때 `assertTableAvailable`을 호출합니다.
- 점유/식사중/잠금 테이블은 409 `TABLE_NOT_AVAILABLE`과 지정 안내 문구를 반환합니다.
- `/api/tables/availability`는 business-state GET whitelist에 들어가 CLOSED 상태에서도 조회 가능합니다.

판단:

- 정상 프론트 흐름에서는 1~15 UI와 서버 검증이 맞습니다.
- 포장 주문에서 `table_no:null` 허용은 맞습니다.
- 매장 식사 주문에서 `table_no` 미지정이 API로 가능하므로 P2입니다. 직접 호출 데이터가 생기면 테이블 점유 모델에서 빠진 주문이 됩니다.

## 7. 상태 전이/DINING/SETTLED 리뷰

확인한 사실:

- `READY -> DINING`, `DINING -> SETTLED`, `DINING -> CANCELED`가 legal transition에 추가되었습니다.
- `READY -> DONE`은 제거되었고 `DONE`은 시작/도착 전이가 없는 dead status입니다.
- `updateOrderStatus`는 `DINING`에서 `dining_at`, `SETTLED`에서 `settled_at`을 기록합니다.
- `order_events`에는 `전달 완료`, `테이블 준비 완료` action_name이 기록됩니다.

판단:

- 신규 DB 기준 서버 전이 자체는 안전합니다.
- 기존 DB 볼륨은 CHECK 갱신 누락 때문에 전이가 실패할 수 있습니다.
- 프론트 `OrderStatusSchema` 누락 때문에 서버가 정상 전이해도 클라이언트 조회가 깨집니다.
- 정산은 SETTLED를 완료 상태로 보지 않아 새 전이 흐름과 충돌합니다.

## 8. 관리자 대시보드/식사 중 컬럼 리뷰

확인한 사실:

- `ADMIN_COLUMNS`는 7개이며 `DINING`이 `READY` 바로 뒤, `HOLD` 앞에 있습니다.
- READY 카드에는 `DINING`으로 보내는 "전달 완료" 액션이 있고, DINING 카드에는 `SETTLED`로 보내는 "테이블 준비 완료" 액션이 있습니다.
- DINING 타이머는 `dining_at` 기준으로 계산하고 30분 warning, 60분 danger를 적용합니다.
- CSS는 desktop 7컬럼, tablet 4컬럼, mobile 2컬럼으로 바뀌었습니다.

판단:

- 대시보드 칸반의 기본 동작은 구현되어 있습니다.
- 관리자 주문 상세 페이지는 `StatusChip`/`OrderTimeline`의 새 상태 미반영으로 보조 화면 품질이 떨어집니다.
- `GET /admin/api/orders`는 schema 없이 호출되어 대시보드는 schema P1 영향을 덜 받지만, `GET /admin/api/orders/:id` 상세는 `OrderSchema` 검증 실패 대상입니다.

## 9. 테이블 잠금 탭 리뷰

확인한 사실:

- `/admin/tables` 라우트와 AdminLayout nav 항목이 추가되었습니다.
- `GET /admin/api/tables`는 인증 필요, 1~15개 row를 반환합니다.
- lock/unlock API는 1~15 범위 검증, CSRF, admin_events `category='system'` 로그를 처리합니다.
- 잠긴 테이블은 사용자 availability에서 `locked`로 내려가며 주문 POST도 409로 거부됩니다.

판단:

- 기본 잠금/해제 기능은 구현되어 있습니다.
- 점유와 잠금이 겹친 상태를 UI가 별도 표현하지 못하는 점은 운영 혼동 가능성이 있습니다.
- 잠금 사유 입력 UI/컬럼은 없습니다. 이는 문서 정책과 일치합니다.

## 10. 사용자 테이블 선택 UX 리뷰

확인한 사실:

- `useTablesAvailability`는 mount 1회 조회하고, `refresh()`로 제출 직전 재조회합니다.
- 폴링은 없습니다.
- unavailable 상태(`occupied`, `dining`, `locked`)는 radio cell에 `aria-disabled`와 disabled 스타일을 적용합니다.
- disabled 테이블 클릭 시 지정 안내 문구를 보여줍니다.
- availability API 실패 시 모든 셀 enable fallback으로 두고 서버 POST 409를 최종 방어로 둡니다.
- `TABLES`는 1~15입니다.

판단:

- UX 정책은 대체로 반영되었습니다.
- fallback enable 정책은 서버 최종 방어가 있으므로 허용 가능합니다.
- 서버의 dine-in null 허용과 동시성 미보강은 별도 P2입니다.
- 미니맵은 `/map/table-location.webp`, `totalTables=15`, fallback grid cap 15로 유지되어 table_lock 변경과 직접 충돌은 보이지 않습니다.

## 11. DB/init.sql/bootstrap 리뷰

확인한 사실:

- `init.sql`은 `orders.status` CHECK에 `DINING`, `SETTLED`를 포함하고 `dining_at`, `settled_at` 컬럼을 생성합니다.
- `table_locks` 테이블은 `table_no` 1~15, `locked`, `locked_at`, `unlocked_at`, `created_at`, `updated_at`이며 reason 컬럼은 없습니다.
- `admin_events` 스키마 변경 없이 `category IN ('menu','system')`을 유지합니다.
- `bootstrap.js`는 006 migration으로 컬럼과 `table_locks`를 추가하지만, 기존 `orders.status` CHECK는 재작성하지 않습니다.

판단:

- 신규 DB 초기화만 전제로 하면 DB schema는 대체로 맞습니다.
- 기존 DB 유지 배포를 허용하면 P1입니다. SQLite CHECK는 `ALTER TABLE ADD COLUMN`으로 갱신되지 않으므로 기존 운영 볼륨은 새 상태 저장에 실패합니다.
- 문서 정책은 "migration X, init.sql 단일 갱신 + DB 초기화"였으므로, migration deviation 자체보다 "불완전한 안전망"이 더 큰 문제입니다.

## 12. 로그/history 리뷰

확인한 사실:

- READY -> DINING, DINING -> SETTLED는 `order_events`에 actor=admin으로 기록됩니다.
- `action_name`은 `order-repo`에서 `전달 완료`, `테이블 준비 완료`로 기록됩니다.
- table lock/unlock은 `admin_events`에 `category='system'`으로 기록됩니다.
- `GET /admin/api/history?type=system`과 `type=orders` 테스트가 추가되어 있습니다.

판단:

- 신규 로그 row 자체는 정책과 맞습니다.
- `ORDER_ACTION_LABEL` fallback에 DINING/SETTLED가 없는 것은 실제 신규 row에는 action_name이 있어 P3입니다.

## 13. nginx / 404 리스크 리뷰

확인한 사실:

- `nginx/default.conf`, `server/app.js`, `docker-compose.yml`, `Dockerfile`은 이번 working tree diff에 없습니다.
- 현재 실행 환경에서 `GET http://localhost/`는 `200 text/html; charset=UTF-8`였습니다.
- 현재 실행 환경에서 `HEAD http://localhost/`는 `404 application/json`이었습니다.
- `/healthz`는 200, `/api/tables/availability`는 200이었습니다.
- `docker ps`는 Windows Docker pipe 권한 문제로 확인하지 못했습니다.

판단:

- Claude가 본 404는 `curl -I` 또는 HEAD 기반 확인의 기존 진단 트랩일 가능성이 큽니다.
- 브라우저 운영 접속은 GET이므로 현재 확인 기준에서는 병합 차단 P1로 보지 않습니다.
- 다만 운영 검증 스크립트가 HEAD를 사용하면 계속 false alarm이 나므로 P3로 기록합니다.

## 14. 테스트/lint/build 리뷰

Claude 보고:

- `docker compose -f docker-compose.dev.yml exec dev npm test -- --run`: 1311/1311 passed
- `npm run lint`: 0 errors / 3 existing warnings
- `npm run build`: success
- `curl /api/tables/availability`: 200
- `curl /admin/api/tables`: 401

Codex가 직접 실행/확인한 것:

- `git branch --show-current`: `table_lock`
- `git status --short`, `git diff main`, `git diff main...HEAD`
- 필수 문서 3개 정독
- `curl.exe` GET `/`, HEAD `/`, `/healthz`, `/api/tables/availability`
- `OrderStatusSchema.safeParse('DINING'/'SETTLED')` 확인: 둘 다 false
- 인메모리 DB에서 `SETTLED` 정산 집계 0원, `DINING` 마감 가능 재현
- 기존 CHECK DB를 흉내 낸 후 006 bootstrap 적용 시 `DINING` update CHECK 실패 재현

직접 full test/lint/build는 재실행하지 않았습니다. 리뷰 목적상 full suite 재실행보다 코드와 정책 대조에 집중했고, build는 `dist` 산출물을 갱신할 수 있어 제외했습니다.

테스트 커버리지 평가:

- availability 도메인, table lock API, customer disabled/submit guard, admin DINING column 테스트는 상당히 추가되어 있습니다.
- 그러나 P1을 잡는 테스트가 없습니다. `OrderStatusSchema`의 새 상태 허용, StatusPage/OrderDetailPage의 실제 schema 검증, SETTLED 정산 집계, DINING 마감 차단, 기존 DB CHECK migration 시나리오가 빠져 있습니다.

## 15. main 병합 전 수동 QA 체크리스트

- [ ] DB 초기화 또는 완성된 migration 적용 절차 확인
- [ ] 기존 DB 볼륨에서 READY -> DINING 전이 시 CHECK constraint 실패가 없는지 확인
- [ ] 5번 테이블 주문 후 다른 사용자 5번 선택/POST 불가
- [ ] 취소 후 5번 사용 가능
- [ ] READY -> DINING
- [ ] DINING 사용자 진행 중 주문 미표시
- [ ] DINING 상태 고객 StatusPage 직접 URL 접근 정상
- [ ] DINING 상태 관리자 주문 상세 접근 정상
- [ ] DINING 타이머 0/30/60분 표시
- [ ] DINING -> SETTLED
- [ ] SETTLED 후 테이블 사용 가능
- [ ] SETTLED 주문이 정산 total_orders/total_amount에 포함
- [ ] DINING 주문이 있으면 정산 마감 차단
- [ ] legacy DONE 주문 정산 호환성 유지
- [ ] 테이블 잠금/해제
- [ ] 점유+잠금 우선순위 및 잠금 유지/해제 표시 확인
- [ ] 오래된 화면에서 제출 직전 availability 재확인
- [ ] dine-in 주문에 table_no 없는 직접 API 호출 정책 확인
- [ ] 쿠폰 회귀
- [ ] 다른 이름 이체 회귀 없음
- [ ] TransferReportForm/TransferPage/CompletePage 주요 흐름 정상
- [ ] 미니맵 이미지 `/map/table-location.webp` 표시
- [ ] nginx `GET /` 접속 200 확인
- [ ] 운영 검증 스크립트가 HEAD 404를 접속 장애로 오판하지 않는지 확인

## 16. Claude에게 줄 후속 수정 지시

아래 프롬프트를 바로 전달할 수 있습니다.

```text
table_lock 브랜치 Codex 리뷰에서 P1이 발견되었습니다. 코드 수정 후 테스트까지 보완해 주세요.

1. 프론트 응답 스키마 수정
- src/api/schemas.js OrderStatusSchema에 DINING, SETTLED를 추가하세요.
- OrderSchema에 dining_at, settled_at nullable optional 필드를 추가하세요.
- schemas.test에 DINING/SETTLED 허용 케이스를 추가하세요.
- StatusPage/OrderDetailPage/useOrderPolling이 DINING/SETTLED 응답을 schema validation error 없이 처리하는 테스트를 추가하세요.
- StatusChip과 OrderTimeline, OrderDetailPage history도 DINING/SETTLED를 잘못된 ORDERED fallback이나 0단계로 보이지 않게 정리하세요.

2. 정산 도메인 수정
- server/domain/settlement.js에서 완료 매출 집계는 SETTLED를 포함하고 legacy DONE도 보존하세요.
- canCloseSettlement의 진행 중 상태에 DINING을 포함해 식사 중 주문이 있으면 마감되지 않게 하세요.
- server/jobs/auto-snapshot.js의 summary도 동일한 완료 상태 정책을 사용하게 고치고, orders.csv 헤더에 dining_at/settled_at을 포함하세요.
- settlement.test와 auto-snapshot.test에 SETTLED 매출 집계, DINING 마감 차단, legacy DONE 호환 케이스를 추가하세요.

3. DB migration 정책 정리
- 기존 DB 볼륨을 지원하려면 bootstrap 006에서 orders 테이블을 rebuild하여 status CHECK가 DINING/SETTLED를 포함하게 만드세요.
- 기존 DB 지원을 포기하고 문서 정책대로 DB 초기화를 강제하려면 006의 stale volume 안전망 의미를 제거하거나 운영 절차 문서에 DB 초기화 필수를 명시하세요.
- old CHECK DB에서 READY -> DINING update가 실패하지 않는 회귀 테스트를 추가하세요.

4. P2 보완 권장
- dineIn 주문은 서버에서도 table_no를 필수로 검증하고, takeout은 null/미지정을 허용하세요.
- 같은 table_no 동시 주문을 막기 위해 주문 생성 트랜잭션 안에서 availability를 재확인하거나 DB-level guard를 검토하세요.
- admin tables view에 점유와 잠금이 겹친 상태의 locked flag/배지를 노출해 운영자가 수동 잠금을 확인/해제할 수 있게 하세요.
```

## 17. 결론

main 병합 가능 여부: **현재 상태로는 병합 보류**입니다.

병합 전 반드시 해야 할 것:

- `src/api/schemas.js` 새 상태 반영
- SETTLED/DINING 기준 정산 도메인 및 스냅샷 수정
- 기존 DB 볼륨 정책 결정 및 bootstrap 006 보완 또는 DB 초기화 절차 명시
- 신규/untracked 파일이 커밋 대상에 포함되는지 확인

병합 후 추적할 것:

- dine-in `table_no` null 직접 API 차단
- 동시 주문 중복 방지
- 점유+잠금 동시 상태의 관리자 UI 표현
- HEAD `/` 404 진단 트랩 개선
- StatusChip/OrderTimeline의 새 상태 표현 품질
