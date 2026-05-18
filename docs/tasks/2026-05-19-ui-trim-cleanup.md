# 2026-05-19 — 사용자 흐름 UI 정리 (5건)

## 목표

D-1 리허설 중 발견된 사용자 측 UI 답답함 + 미사용 경로 5건을 정리한다.

1. CompletePage "조리 현황 보기" ghost 버튼 제거 + 상단 back-bar 추가
2. StatusPage `OrderTimeline` 제거 (모든 상태 공통)
3. StatusPage sticky-bar 안 "현재 상태 + StatusChip" 라벨 행 제거
4. TransferReportForm "다른 이름으로 이체했어요" 체크박스 + 조건부 필드 제거
5. 서버 측 `use_other_name` / `other_name` 매칭·응답·페이로드 로직 완전 정리 (DB 컬럼은 유지)

## 만든 것

### 사전 산출물 (기획·지시·검수 3문서)
- `docs/tasks/2026-05-19-ui-trim-cleanup/01-개발기획서.md`
- `docs/tasks/2026-05-19-ui-trim-cleanup/02-개발지시서.md`
- `docs/tasks/2026-05-19-ui-trim-cleanup/03-검수지시서.md`

## 한 일

### 1. CompletePage (`src/pages/customer/CompletePage.jsx`)
- 페이지 최상단에 `<div className="back-bar">` 추가 (← 버튼 → `/menu` 이동 + h1 "주문 완료"). 우측 meta `#{order.no}` 는 DogTagFrame의 `#17`과 다중 매칭되어 회귀 테스트 실패 → meta 제거.
- sticky-bar 내부 `🍗 조리 현황 보기` ghost 버튼 제거.
- spacer 높이 132 → 80 (한 버튼 sticky 기준).
- sticky-bar 인라인 스타일에서 `flexDirection: 'column'`, `gap: 6` 제거.

### 2. StatusPage (`src/pages/customer/StatusPage.jsx`)
- `OrderTimeline` import + 사용 제거 (`current={currentStatus} showMiniview={false}` 한 줄).
- `StatusChip` import + 사용 제거.
- sticky-bar 안 `<div>...<span>현재 상태</span><StatusChip ... /></div>` 라벨 행 제거.
- sticky-bar 자체를 ORDERED 상태에서만 렌더 (다른 상태는 sticky 영역 없음). spacer도 ORDERED 한정.
- 주석 한 줄 정리 (P2-1 HOLD warn-banner 안내 유지 설명).

### 3. TransferReportForm (`src/components/organisms/TransferReportForm.jsx`)
- `useOtherName`/`otherName` state + 파생 `showOtherName` 제거.
- `errors.otherName` validation + `markAllTouched`의 `otherName: true` + `handleSubmit` 페이로드에서 `useOtherName`/`otherName` 제거.
- "다른 이름으로 이체했어요" Checkbox JSX + 조건부 `<Input id="otherName">` 블록 제거.
- `Checkbox` import 제거.
- 파일 상단 history 주석을 v6 복원 → **v7 (2026-05-19) 최종 제거**로 갱신.

### 4. 서버 측 정리
- `server/domain/transfer-matching.js`: candidateName을 `c.depositor_name?.trim()` 단일로. use_other_name 분기 제거. 주석 갱신.
- `server/routes/customer.js`: `TransferReportSchema` zod 스키마에서 `useOtherName`/`otherName` 필드 제거. `updateTransferInfo` 호출 페이로드에서도 제거.
- `server/repositories/order-repo.js`: `updateTransferInfo`의 UPDATE SQL에서 `use_other_name`/`other_name` 컬럼·바인딩 제거. JSDoc 정리. (DB 컬럼은 init.sql 의 DEFAULT 0/NULL 그대로 유지 — D-1 마이그레이션 회피.)
- `server/routes/admin.js`: `serializeAdminOrder` 응답 객체에서 `use_other_name`/`other_name` 필드 destructure로 제거. 주석 갱신.

### 5. 회귀 테스트 정리
- `src/components/organisms/__tests__/TransferReportForm.test.jsx`:
  - 초기 렌더 케이스에서 "다른 이름으로 이체" 라벨 부재 검증으로 전환.
  - "다른 이름" 노출/미렌더/payload 포함/빈 값 차단 4 케이스 삭제 (`★ design_fix v6` 시리즈).
  - 정상 제출 케이스의 `useOtherName: false` 검증 제거.
- `server/domain/__tests__/transfer-matching.test.js`:
  - `baseCandidate`에서 `use_other_name: 0`, `other_name: null` 키 제거.
  - "★ use_other_name=1일 때 other_name으로 매칭" 케이스 1건 삭제.
- `server/repositories/__tests__/order-repo.test.js`: "use_other_name + other_name 보존" 케이스 1건 삭제.
- `src/pages/customer/__tests__/StatusPage.test.jsx`: OrderTimeline 5단계 progressbar / 미니뷰 미렌더 2 케이스 삭제 (OrderTimeline 자체 단위 테스트는 그대로 유지).

### 6. 의도적 비범위
- `server/db/init.sql` 의 `use_other_name`, `other_name` 컬럼 정의 → 유지 (D-day -1 마이그레이션 회피).
- `OrderTimeline.jsx` 컴포넌트 자체 + 단위 테스트 → 유지 (admin OrderDetailPage가 사용).
- `RecentOrdersSection.jsx` 의 "조리 현황 보기" 표현 → 별개 컴포넌트로 유지.

## 테스트 결과

ADR-033에 따라 docker dev 컨테이너에서만 검증.

### docker dev `npm test`
```bash
docker compose -f docker-compose.dev.yml exec dev npm test
```
**1165/1165 통과** (Test Files 101 passed). 이전 1173 → 1165 (-8 케이스): 본 작업에서 회귀 테스트 정리 8건 삭제 분.

#### 중간 실패 → 해결 (CompletePage 3 케이스)
초안에서 CompletePage back-bar 우측 meta로 `#{order.no}` 표시 → DogTagFrame 안 `#17` 과 다중 매칭으로 `getByText('#17')` 가 throw. meta span 제거 후 그린.

### docker dev `npm run build`
```bash
docker compose -f docker-compose.dev.yml exec dev npm run build
```
**production 번들 성공** (built in 12.61s, 190 modules). 메인 번들 304.17kB → 301.85kB (-2.3kB). axe-core 미오염 (bundle.test.js 통과).

### 운영 컨테이너 빌드 + 헬스
```bash
docker compose build app && docker compose up -d
```
**chickenedak (app) + chickenedak-nginx 모두 healthy.**

### 잔여 grep
```
server/db/init.sql:59,60       use_other_name / other_name (컬럼 정의 — 의도적 유지)
server/routes/admin.js:100,103 use_other_name / other_name (응답 destructure 제거 코드)
```
도메인·라우트 (admin 응답에서 제거) 로직에서는 잔여 사용 0건. 클라이언트 src/에서도 0건.

## 다음에 할 것

1. **수동 시각 검증** — `docker compose -f docker-compose.dev.yml exec dev npm run dev` → `http://localhost:5173` 접속:
   - CompletePage: 상단 ← 버튼 + "주문 완료" 헤더 표시. ← 클릭 시 `/menu`. sticky-bar는 단일 버튼.
   - StatusPage ORDERED: OrderTimeline 없음. "이체 완료 요청" 버튼만 sticky에 노출. "현재 상태 + 칩" 행 없음.
   - StatusPage TRANSFER_REPORTED/COOKING/READY 등: stage-copy 본문 텍스트 유지, OrderTimeline·"현재 상태" 행 모두 없음. sticky-bar 자체가 빈 상태.
   - TransferPage: "다른 이름으로 이체했어요" 체크박스·"이체한 사람 이름" 필드 모두 사라짐. 은행·입금자·금액만으로 제출 가능.
2. **DB 마이그레이션** (운영 이후 별도 단계) — `use_other_name`, `other_name` 컬럼 자체 DROP. 운영 데이터에 미사용 NULL/0이 누적되어 있더라도 무해.
3. **검수지시서 §5 DB 확인** — 운영 컨테이너에서 sqlite3로 신규 TRANSFER_REPORTED 행 직접 조회해 `use_other_name=0`, `other_name=NULL` 저장 확인 (운영 단말기 활용 시점).
