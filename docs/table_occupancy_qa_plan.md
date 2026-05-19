# 테이블 점유/식사중/테이블 잠금 검수 지시서

> 작성일: 2026-05-19 / 갱신: 2026-05-19 (사용자 결정 8건 반영) / 브랜치: `table_lock`
> 짝 문서: `docs/table_occupancy_development_plan.md` (설계), `docs/table_occupancy_work_instruction.md` (작업).
>
> **확정된 흐름**: `READY → DINING → SETTLED` (어드민 버튼 2개, DONE은 dead status).
> **확정된 정책**: 사용자에게 order_no 미노출 · DINING 30/60분 임계 · 잠금 사유 입력 X · 폴링 X · admin_events 'system' 흡수 · 마이그레이션 X(DB 초기화).

---

## 0. 검수 원칙

- 본 검수는 *실서비스 D-1 직전*까지 통과해야 한다. 일회성 양일 운영 — 회귀가 발견되면 *해당 라운드 롤백*이 1순위.
- ADR-033 / CLAUDE.md "작업 절차" 4단계 준수. 모든 자동 테스트는 docker 컨테이너 안에서:
  ```bash
  docker compose -f docker-compose.dev.yml exec dev npm test
  docker compose -f docker-compose.dev.yml exec dev npm run test:e2e
  docker compose -f docker-compose.dev.yml exec dev npm run build
  ```
- 운영 경로 사이드체크는 운영 컨테이너에서:
  ```bash
  docker compose build app && docker compose up -d
  curl -sI http://localhost/api/tables/availability    # 200
  curl -sI http://localhost/                            # 200, SPA index
  ```
- `.env`, 비밀키, DB 실데이터, 세션 파일은 열람하지 않는다.
- 같은 테이블 동시 주문 race condition 검수는 *본 범위에서 필수 아님*. 단, 서버 최종 방어선 동작은 필수 검수 대상.

---

## 1. 사전 준비

- 브랜치가 `table_lock`인지 확인. (`git branch --show-current` → `table_lock`)
- **DB 초기화 후 부팅** (Q7 확정 — 마이그레이션 X):
  ```bash
  # dev — 데이터 디렉토리 비우고 부팅
  docker compose -f docker-compose.dev.yml down
  # dev DB 파일 삭제 (init.sql 자동 적용)
  docker compose -f docker-compose.dev.yml run --rm dev sh -c "rm -f /app/data/*.db"
  docker compose -f docker-compose.dev.yml up -d
  docker compose -f docker-compose.dev.yml exec dev npm run server:watch
  ```
  *(경로/볼륨명은 docker-compose.dev.yml 정의 기준 — 작업 시점에 정확한 명령으로 갱신)*
- 어드민 PIN을 stdout에서 확인.
- 사용자 화면: 모바일 폭 390px 전후, 어드민 화면: 데스크톱 1024px 이상.

---

## 2. 시나리오 — 수동 QA 체크리스트

### 시나리오 1. 테이블 점유 (P0)

- 절차:
  1. 사용자 A로 메뉴 진입 → 카트 담기 → 주문 정보 → **5번 테이블** 선택 → 주문 접수.
  2. 사용자 B(다른 브라우저/시크릿)로 동일하게 진입 → 주문 정보까지.
- 기대 결과:
  - B의 화면에서 **5번 테이블은 disabled**로 노출.
  - **B 응답에 order_no가 노출되지 않음** (Q2 — 개발자 도구로 `/api/tables/availability` 응답 확인).
  - B가 강제로 5번을 선택(개발자 도구 등)해서 제출해도 서버 응답 **409 `TABLE_NOT_AVAILABLE`**, 메시지 정확히:
    > "현재 선택하신 테이블은 이용 중이거나 준비 중입니다. 번거로우시겠지만 다른 테이블로 이동해 주세요."

### 시나리오 2. 취소 후 테이블 해제 (P0)

- 절차:
  1. 5번 테이블 주문 1건 생성.
  2. 어드민 본부 대시보드에서 해당 주문 *취소*.
  3. 사용자 B가 다시 5번 시도.
- 기대 결과:
  - 5번 카드 즉시 *사용 가능*으로 표시.
  - B 제출 200 정상.

### 시나리오 3. READY → DINING (P0)

- 절차:
  1. 5번 테이블 주문을 READY 상태까지 이동(이체 신고 → 이체 확인 → 조리 시작 → 조리 완료).
  2. 본부 대시보드 READY 컬럼에서 **"전달 완료"** 클릭.
- 기대 결과:
  - 주문이 **"식사 중"** 컬럼으로 이동(READY 오른쪽).
  - 사용자 진행 중 주문 목록(`RecentOrdersSection`)에서 해당 카드가 사라짐.
  - 5번 테이블은 *식사 중 = 여전히 점유*. 새 주문 받지 않음.

### 시나리오 4. 식사 중 타이머 + 임계 색상 (P1)

- 절차:
  1. 시나리오 3 직후 DINING 컬럼 카드의 경과 시간을 확인.
  2. 1분 뒤 새로고침 없이 카드 경과 분이 자동 증가하는지 확인.
  3. 시간 모킹 또는 인내심으로 30분/60분 경계 임계 색상 확인.
- 기대 결과:
  - 초기 진입 시 **0분** (또는 1분 미만), 카드 톤은 기본(`border-divider`).
  - 1분 후 **1분**, 2분 후 **2분** 단위로 갱신 (1분 tick).
  - **30분 경과** 시 카드 톤이 *주황*(`border-warning`)으로 변경.
  - **60분 경과** 시 카드 톤이 *빨강*(`border-danger`)으로 변경.
  - READY/COOKING 컬럼은 *기존 5/10분 임계*로 회귀 유지 (혼선 없음).
  - **사용자 화면에는 노출되지 않음** — 사용자 카드는 어디에도 없음(진행 중 제외).

### 시나리오 5. 테이블 준비 완료 → SETTLED (P0)

- 절차:
  1. DINING 카드의 **"테이블 준비 완료"** 클릭.
- 기대 결과:
  - 주문이 **DINING → SETTLED**로 전이 (DONE 아님). 카드는 보드에서 사라짐 (SETTLED 컬럼 없음 — 6+1=7컬럼 정책).
  - 5번 테이블이 *사용 가능*으로 복귀.
  - 사용자 B가 5번을 다시 선택해 주문 가능 (200).
  - 사용자가 해당 주문 status 페이지 직접 진입 시 카피 `'주문이 완료되었어요. 또 오세요!'` 노출.

### 시나리오 6. 테이블 잠금 (P1)

- 절차:
  1. 어드민 nav → **테이블 잠금** 탭 진입.
  2. **7번 카드의 "잠금" 버튼** 클릭. **사유 입력 모달이 *없어야* 함 (Q4)** — 클릭 즉시 잠금 반영.
  3. 사용자 화면(주문 정보)에서 7번 시도.
  4. 어드민에서 **7번 "잠금 해제"** 클릭. (역시 모달 없이 즉시)
  5. 사용자가 7번 다시 선택.
- 기대 결과:
  - 2 직후 7번 카드 배지 **"잠김"** (빨강) — *사유 텍스트 미노출*.
  - 3에서 7번 disabled + 강제 제출 시 409 + 안내 문구.
  - 4 직후 7번 *사용 가능*으로 복귀.
  - 5는 정상 주문 가능 (200).
- 로그: 어드민 nav → **내역** → **시스템** 탭에서 `TABLE_LOCK` / `TABLE_UNLOCK` 이벤트 노출 (Q6 — system 카테고리). 메뉴 변경/장사 시작/관리자 로그인과 같은 탭에 함께 보임.
- DB 회귀: `admin_events`에 `category='system'`, `target_id=7`, `target_name='테이블 7번'`, `operating_date≠NULL`.

### 시나리오 7. 점유와 잠금의 우선순위 (P1)

- 절차:
  1. 8번 테이블에 진행 중 주문(PAID 단계)을 만든다.
  2. 어드민 테이블 잠금 페이지에서 8번 "잠금" 클릭 → 잠금 상태로 만든다.
  3. 8번 "잠금 해제" 클릭.
  4. 사용자가 8번을 선택해 본다.
- 기대 결과:
  - 3 후 *수동 잠금만* 해제. 진행 중 주문은 그대로.
  - 4에서 8번은 여전히 *이용 중*으로 disabled. 강제 제출은 409 + 안내.
  - 어드민 토스트/안내 (3 직후): "수동 잠금만 해제됐어요. 진행 중 주문 때문에 아직 사용할 수 없습니다." (또는 동등 문구)
  - **8번 어드민 카드는 `occupied`로 표시 (잠금 해제 후에도)**. order_no가 어드민 응답에는 포함되어 카드에 "#N 이용 중"으로 노출.

### 시나리오 8. 오래된 화면 상태 처리 (P1)

- 절차:
  1. 사용자 A가 주문 정보 화면을 연 채로 둔다.
  2. 어드민이 그 사이 6번 테이블을 잠금.
  3. A가 6번 선택 후 주문 접수.
- 기대 결과:
  - 서버 응답 **409 `TABLE_NOT_AVAILABLE`** + 정확한 안내 문구가 A의 화면에 노출.
  - A의 카트는 *유지*되어 다른 테이블로 재선택 가능.

### 시나리오 9. 테이블 번호 검증 (P0)

- 절차: API 직접 호출 (curl 또는 어드민 콘솔)
  ```bash
  POST /api/orders { ..., delivery_type:'dineIn', table_no: 1 }   # 200
  POST /api/orders { ..., delivery_type:'dineIn', table_no: 15 }  # 200
  POST /api/orders { ..., delivery_type:'dineIn', table_no: 0 }   # 400 VALIDATION_ERROR
  POST /api/orders { ..., delivery_type:'dineIn', table_no: 16 }  # 400
  POST /api/orders { ..., delivery_type:'dineIn', table_no: 'a' } # 400
  POST /api/orders { ..., delivery_type:'takeout', table_no: null } # 200
  ```
- 기대 결과:
  - 1, 15: 정상 — `body.table_no` 그대로.
  - 0, 16, 'a': 400 + 메시지 `"테이블 번호는 1번부터 15번까지만 선택할 수 있어요."`
  - 포장(takeout, null): 200 + `body.table_no=null`
  - 포장 주문이 있어도 모든 dineIn 테이블 사용 가능 회귀 (시나리오 1 보조 검증).

### 시나리오 10. 회귀 테스트 (P0)

- **쿠폰**:
  - 학번 `202637042` + 이름 "홍길동" 정상 사용. 1,000원 할인 적용.
  - 같은 학번 다른 이름 재사용 시도 → `ALREADY_USED` (find_error_v3 ADR-034 회귀).
- **다른 이름 이체**:
  - 이체 신고 시 예금주명이 본인 이름과 달라도 정상 접수.
  - TRANSFER_REPORTED 중복 제출 → 409 `TRANSFER_ALREADY_REPORTED`.
- **이체 완료 요청**:
  - ORDERED → TRANSFER_REPORTED 전이 + 어드민 카드의 은행 라벨 표시.
- **관리자 상태 변경**:
  - 합법 전이는 200, 불법 전이는 409 + 메시지.
  - 새 회귀: `READY → DONE` 불법(409), `DINING → DONE` 불법(409), `READY → SETTLED` 불법(409 — DINING 우회 차단).
- **미니맵 이미지**:
  - 헤더 미니맵 버튼 → 모달에서 `public/map/table-location.webp` 정상 로드.
  - 테이블 번호 라벨 1~15 모두 노출.
- **정산 마감**:
  - 진행 중 주문 0건일 때 마감 가능. **DINING 1건 있으면 마감 거부**(ADR-012 회귀).
  - 마감 후 business_state=CLOSED 자동 전환(G13).
- **영업 가드**:
  - CLOSED 상태에서 POST /api/orders → 423.
- **번들 위생**:
  - production 번들에 axe-core 흔적 0 (`src/__tests__/bundle.test.js`).
- **DB 초기화 후 부팅 회귀**:
  - 신규 DB 부팅 시 init.sql 한 번 실행으로 `orders.status` CHECK enum에 'DINING','SETTLED' 포함, dining_at/settled_at 컬럼 존재, table_locks 테이블 존재.
  - 메뉴 8개 시드, business_state 1행, system_settings 4건 정상 시드 (회귀).

---

## 3. 자동 테스트 제안

> 모든 명령은 docker exec dev 안에서 실행.

### 백엔드 단위/통합
- `server/domain/__tests__/table-availability.test.js` *(신규)*
  - getAvailability 빈 DB → 15개 모두 available (응답에 order_no 없음)
  - 점유/식사중/잠김/취소/SETTLED 케이스별 단일/혼합 시나리오
  - operating_date 다른 주문 무시
  - 포장 주문(table_no=null) 무시
  - getAdminTablesView: order_no, dining_at, locked_at 포함 회귀
- `server/repositories/__tests__/table-locks-repo.test.js` *(신규)*
  - lock/unlock UPSERT + timestamp 갱신
  - 동일 table_no UNIQUE
  - reason 컬럼 *없음* 회귀 (PRAGMA table_info에 'reason' 없음 확인)
- `server/domain/__tests__/order-state.test.js` *(갱신)*
  - READY → DINING 합법
  - READY → DONE 불법
  - READY → SETTLED 불법 (DINING 우회 차단)
  - DINING → SETTLED 합법
  - DINING → DONE 불법 (DONE은 dead status)
  - DINING → CANCELED 합법
  - DINING → READY 불법
  - 메타 회귀: LEGAL_TRANSITIONS 우변 합집합에 'DONE' 없음
- `server/repositories/__tests__/order-repo.test.js` *(갱신)*
  - updateOrderStatus(...,'DINING') → dining_at 기록
  - updateOrderStatus(...,'SETTLED') → settled_at 기록
  - 갱신된 합법/불법 매트릭스
- `server/routes/__tests__/customer.test.js` *(갱신)*
  - POST /api/orders availability 가드
  - GET /api/tables/availability 응답 형태 (order_no, dining_at *미포함*)
- `server/routes/__tests__/admin.test.js` *(갱신)*
  - GET /admin/api/tables (order_no, dining_at 포함)
  - POST /admin/api/tables/:n/lock (빈 body 허용 — 사유 X)
  - POST /admin/api/tables/:n/unlock
  - 0/16 잠금 시도 → 400
  - admin_events에 TABLE_LOCK/UNLOCK 1행 + category='system' + target_id=table_no
  - history?type=system → TABLE_LOCK/UNLOCK 노출
- `server/__tests__/bootstrap.test.js` *(갱신)*
  - 신규 DB 부팅 후 status enum에 'DINING','SETTLED' 포함
  - dining_at, settled_at 컬럼 존재
  - table_locks 테이블 존재 + reason 컬럼 없음 회귀

### 프론트엔드 단위
- `src/components/organisms/__tests__/AdminCardColumn.test.jsx` *(갱신)*
  - READY 카드 버튼 = "전달 완료" → 'DINING'
  - DINING 카드 버튼 = "테이블 준비 완료" → **'SETTLED'**
  - DINING 카드 elapsed가 dining_at 기준
  - DINING 카드 elapsed=29 → border-divider, 30 → border-warning, 60 → border-danger (Q3)
  - READY/COOKING 카드 5/10분 임계 회귀 (혼선 차단)
- `src/constants/__tests__/admin-columns.test.js` *(신규 또는 갱신)*
  - ADMIN_COLUMNS 길이 7
  - 'DINING'이 'READY'와 'HOLD' 사이
- `src/pages/admin/__tests__/TablesPage.test.jsx` *(신규)*
  - 카드 15장 렌더
  - 잠금/해제 클릭 시 *모달 없이* POST 호출 + refetch
  - 잠금 카드 배지 라벨에 *사유 텍스트 없음* (Q4 회귀)
  - 점유 중 잠금 해제 후 토스트 문구
- `src/components/organisms/__tests__/RecentOrdersSection.test.jsx` *(갱신)*
  - DINING/SETTLED 카드 즉시 hide + store removeOrder
  - READY/COOKING/HOLD 카드 표시 유지 회귀
- `src/pages/customer/__tests__/CheckoutPage.test.jsx` *(갱신)*
  - availability fetch 마운트 시 1회만, 30초 대기 후에도 1회 유지 (폴링 없음)
  - 제출 클릭 시 두 번째 fetch 발생
  - availability 응답으로 disabled 표시
  - 사용 불가 테이블 클릭/제출 시 안내 문구
  - availability 5xx fallback
- `src/components/layouts/__tests__/AdminLayout.test.jsx` *(갱신)*
  - nav 6종 (테이블 잠금 추가)
  - testid `admin-nav-tables` 존재

### E2E (Playwright)
- 본 범위 필수 아님. 단, 다음 흐름은 *수동* 검수로 대체:
  - "주문 → 결제 → 조리 → 전달 → 식사 중 → 테이블 준비 완료 → 다음 주문" 종단 흐름
  - "사용자 A 5번 점유 → 사용자 B 5번 선택 시도 → 거부"
- 추가 자동화 여유 있으면 위 시나리오를 e2e로 옮길 수 있음.

### 동시성 테스트
- 본 범위 *필수 아님*. 같은 테이블 동시 주문 race condition은 전제상 발생하지 않는다.

---

## 4. 최종 통과 기준

다음 항목이 *모두 충족*되어야 본 라운드 통과로 본다:

- [ ] 사용 불가능한 테이블로 주문이 접수되지 않는다 (시나리오 1, 8, 9).
- [ ] 사용자 `/api/tables/availability` 응답에 order_no/dining_at 노출되지 않음 (Q2).
- [ ] 식사 중 테이블은 선택 불가 (시나리오 3, 7).
- [ ] 테이블 준비 완료 후 다시 선택 가능, 전이는 `DINING → SETTLED` (시나리오 5).
- [ ] 수동 잠금 테이블은 선택 불가, 잠금 시 사유 입력 모달 없음 (시나리오 6).
- [ ] 잠금 해제해도 점유 중이면 선택 불가 (시나리오 7).
- [ ] 사용자에게 공손한 안내 문구가 정확히 노출:
  > "현재 선택하신 테이블은 이용 중이거나 준비 중입니다. 번거로우시겠지만 다른 테이블로 이동해 주세요."
- [ ] 관리자 대시보드에 "식사 중" 컬럼과 1분 단위 타이머가 표시되고, 30/60분에 톤이 변경된다 (Q3).
- [ ] 사용자는 DINING/SETTLED 주문을 진행 중 주문에서 보지 않는다.
- [ ] 어드민 nav에 "테이블 잠금" 탭이 보이고 *모달 없이* 잠금/해제가 동작한다 (Q4).
- [ ] 사용자 CheckoutPage는 폴링 없이 진입 1회 + 제출 직전 1회만 fetch (Q5).
- [ ] 잠금/해제 이벤트가 `admin_events.category='system'`으로 기록되고 history 시스템 탭에 노출 (Q6).
- [ ] 마이그레이션 스크립트 추가 없이 신규 DB 부팅 시 `init.sql` 한 번으로 전체 스키마 적용 (Q7).
- [ ] DONE 상태가 어떤 합법 전이의 우변에도 등장하지 않는다 (메타 회귀).
- [ ] `npm test` *전건 green* (신규 + 기존 1185+α 케이스 모두).
- [ ] `npm run lint` 통과.
- [ ] `npm run build` cross-env로 production 번들 정상 (axe-core 흔적 0).
- [ ] `docker compose up -d --build` 후 `curl -sI http://localhost/`와 `curl -sI http://localhost/api/tables/availability` 모두 200.
- [ ] CLAUDE.md "절대 깨지면 안 되는 것" 회귀 매트릭스 그린 (쿠폰/이체/상태/영업/정산/번들 위생).
- [ ] 운영 사고 가능성이 있는 P0/P1 시나리오(1~8)는 *수동 검수*로 반드시 1회 통과.

---

## 5. 통과 후 후속 작업

- `docs/tasks/2026-05-XX-table-occupancy-summary.md` 작업 로그 종합본 작성.
- `docs/DECISIONS.md` 변경 로그에 본 라운드 한 줄 + ADR-025 갱신 노트(또는 ADR-035 신설).
- `docs/IMPLEMENTATION_PROGRESS.md`에 라운드 한 줄.
- `docs/operations/admin-card.md` / `docs/operations/d1-rehearsal.md`에 *테이블 잠금 운영 절차*와 *식사 중 컬럼 운영 절차* 한 단락씩 추가 (운영자가 D-1 리허설에서 학습 가능하도록).

---

## 6. 참고

- 시나리오의 안내 문구와 액션 라벨은 **개발 기획서 §2.2 / §2.4**에 1차 출처가 있다. 검수 시 문구가 다르면 *기획서 우선* — 구현에 맞게 검수 문서를 조정하지 말고 *구현을 기획서에 맞춘다*.
- 같은 테이블 동시 주문은 *발생하지 않는다고 상정*. 만약 운영 중 실제로 발생하면 *서버 거부가 단일 방어선*. 데이터 정합성은 깨지지 않음.
