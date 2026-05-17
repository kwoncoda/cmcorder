# Bug 7 — 경과 시간 540분 오차 수정 (2026-05-17)

## 목표

본부 대시보드 칸반 카드의 "N분 경과" 표시가 540분으로 잘못 표기되는 회귀를 차단한다.

## 근본 원인

- SQLite `datetime('now')` 출력 형식 = `'YYYY-MM-DD HH:MM:SS'` — UTC 시각이지만 timezone marker 없음.
- 브라우저(KST = UTC+9)에서 `new Date('2026-05-17 12:21:29')` 호출 시 이 문자열을 KST 12:21로 잘못 파싱.
- 실제 시각: UTC 12:21 = KST 21:21 → 9시간 = **540분 오차** 발생.
- 결과: `AdminCardColumn`의 `calcElapsedMinutes` → "540분 경과" 표시.

## 만든 것 (신규 파일)

- `src/utils/time.js` — `parseTimestamp(input)`, `elapsedMinutes(start, now)` 두 함수.
  - SQLite space 형식(`YYYY-MM-DD HH:MM:SS`) 감지 후 강제 UTC 파싱.
  - ISO 8601 (`T...Z` / 오프셋) 형식은 Date 생성자 그대로 통과.
- `src/utils/__tests__/time.test.js` — 9 테스트 케이스 (RED → GREEN).
- `docs/tasks/2026-05-17-bug7-540min-time-fix.md` — 본 로그.

## 한 일 (구체 변경)

### 1) 클라이언트 방어 파서 (`src/utils/time.js`)

- `parseTimestamp(input)`: null/Date/string 처리, SQL_RE 매칭 시 `' '→'T'+'Z'` 정규화 후 Date 생성, NaN이면 null.
- `elapsedMinutes(start, now)`: `parseTimestamp` 통해 시작 시각 파싱 후 분 단위 차이 계산. start null이면 0.

### 2) 서버 응답 ISO 8601 Z 직렬화

- `server/routes/admin.js`
  - 신규 헬퍼 `toIsoUtc(str)` + `TS_FIELDS` 배열.
  - `serializeAdminOrder`에서 `created_at / updated_at / transferred_at / paid_at / cooking_at / ready_at / done_at` 7개 필드를 변환.
  - `GET /admin/api/transfers`의 `transferred_at`도 `toIsoUtc()` 적용.
- `server/routes/customer.js`
  - 동일한 `toIsoUtc` 헬퍼 추가.
  - `serializeOrder`에서 6개 timestamp 필드(`created_at`/`transferred_at`/`paid_at`/`cooking_at`/`ready_at`/`done_at`)를 `toIsoUtc()`로 감싸 정규화.

### 3) AdminCardColumn 통합

- `src/components/organisms/AdminCardColumn.jsx`
  - `import { elapsedMinutes as elapsedMinutesUtil } from '../../utils/time.js';` 추가.
  - `calcElapsedMinutes`는 util로 위임 (단순 wrapper). 기존 시그니처/동작 호환.

### 4) 회귀 테스트 추가 (서버)

- `server/routes/__tests__/customer.test.js` +1: `★ Bug 7 회귀 — 주문 응답 timestamps는 ISO 8601 UTC (T...Z) 형식`.
- `server/routes/__tests__/admin.test.js` +1: `★ Bug 7 회귀 — admin 주문 응답 timestamps ISO 8601 UTC (T...Z)`.

## 테스트 결과

| 영역 | 결과 |
|------|------|
| `src/utils/__tests__/time.test.js` (신규) | **9 / 9 PASS** (RED→GREEN) |
| `server/routes/__tests__/customer.test.js` | **31 / 31 PASS** (Bug 7 회귀 1건 추가) |
| `server/routes/__tests__/admin.test.js` | **34 / 34 PASS** (Bug 7 회귀 1건 추가) |
| `src/components/organisms/__tests__/AdminCardColumn.test.jsx` | **26 / 26 PASS** (데이터 수정 불필요) |
| `src/pages/customer/__tests__/StatusPage.test.jsx` | **28 / 28 PASS** |
| **전체 (`npm test`)** | **983 / 983 PASS** (94 파일) |

### AdminCardColumn 기존 테스트 호환

기존 테스트 데이터 `'2026-05-20T17:28:00'` (timezone 미명시 ISO 8601). `parseTimestamp`의 `SQL_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/`가 `T` 구분자를 매칭하지 못해 `new Date(input)` 그대로 호출 → 기존 동작과 동일 (timezone 무관 상대 차이 계산). **데이터 수정 없이 그대로 통과.**

## 제약 준수

- `.env`, 비밀파일 수정 X.
- 도메인 테스트 (`pricing`, `coupon`, `order-state`, `business-state`, `settlement`) 무수정.
- `init.sql` 스키마/DEFAULT 무수정 — 읽기 시점에서만 변환.
- 한국어 주석 유지.

## 두 단계 방어 정리

1. **서버 직렬화** (정확한 contract): API 응답 timestamp가 항상 ISO 8601 Z 형식.
2. **클라이언트 파서** (네트워크 외 경로 대비): 만약 어떤 경로로든 SQLite space 형식이 클라까지 도달해도 `parseTimestamp`가 UTC로 강제 처리.

## 다음에 할 것 (선택)

- StatusPage `OrderTimeline` 미니뷰에 표시되는 timestamp는 현재 raw 문자열. 사용자 친화적 시각(`HH:MM`) 포맷이 필요하면 후속 작업으로 별도 분리.
- D-1 리허설 시 본부 대시보드에서 실주문 1건 후 카드 경과 분이 0분에서 시작하는지 시각 확인 권장.
