# C-1 — SSE 폴링 fallback (조리 현황판 실시간 갱신 복구)

## 목표

서버에 `GET /api/orders/:id/stream` SSE 라우트가 *없어* 발생하던 문제 해소.

- `useOrderStream` EventSource → 404 → `isConnected=false` → 사용자 화면에 "⚠️ 실시간 연결 끊김" 영구 표시.
- PAID / COOKING / READY 전이 시 자동 알림(진동·깜박) 발화 X.

→ 5초 주기 폴링 fallback hook을 신설해 시그니처 호환 1줄 교체로 복구.
서버 SSE 라우트 구현 후 `useOrderStream`으로 복귀 가능.

## 만든 것

- `src/hooks/useOrderPolling.js` — 신규 폴링 hook (5초 기본 interval, 옵션 override).
- `src/hooks/__tests__/useOrderPolling.test.jsx` — 신규 단위 테스트 15 케이스.

## 한 일

### 1) `src/hooks/useOrderPolling.js` (신규)

- 시그니처 `useOrderStream`과 동일: `{ snapshot, status, error, isConnected }`.
- `apiFetch(API.ORDER(id), { schema: OrderSchema, signal })` 사용 — 기존 fetch wrapper와 zod 검증 재사용.
- `authToken` 시 URL 에 `?token=` 쿼리 (외부인 분기).
- ★ §3.5 5조 — 부수효과는 `onStatusChange(prev, next)` 콜백 위임. effect deps 에 status 두지 X.
- ★ 첫 fetch는 `prevStatusRef.current = null` 가드 — 새로고침 후 READY 직진입 시 진동 0회.
- ★ 동일 status 재전송 시 콜백 호출 X.
- ★ StrictMode 호환 — `AbortController` + `cancelled` flag + `clearInterval` cleanup.
- ★ `onStatusChange` latest ref 패턴 — 매 렌더 새 함수여도 effect 재실행 X.
- ★ G13 — `BusinessClosedError` 는 `throw` 다시 → 전역 핸들러(`useGlobalErrorHandler`) 위임. hook 자체 error state 에 잡지 X.

### 2) `src/pages/customer/StatusPage.jsx` (3줄 surgical 교체)

- `import { useOrderStream } from '../../hooks/useOrderStream.js';` → `useOrderPolling`.
- 함수 호출 1곳 — `useOrderStream({...})` → `useOrderPolling({...})`.
- 헤더 주석 보강 — "SSE" → "폴링 fallback (C-1)".
- 시그니처 동일이라 `stream.snapshot`·`stream.status`·`stream.isConnected` 사용처 0 변경.
- 페이지 줄수 **119 / 120** (§3.5 1조 통과).

### 3) `src/pages/customer/__tests__/StatusPage.test.jsx` (mock 대상만 갱신)

- `vi.mock('../../../hooks/useOrderStream.js')` → `useOrderPolling.js`.
- `import { useOrderStream }` → `useOrderPolling`.
- `useOrderStream.mockReturnValue` / `mockImplementation` 호출 — `replace_all` 로 일괄 치환.
- 21 + 4 = 25 케이스 (기존 21 + a11y 등 보강) 그대로 통과.

### 4) `src/hooks/useOrderStream.js` + `useOrderStream.test.jsx` 보존

- 서버 SSE 라우트 구현 시 복귀할 수 있도록 손대지 X.

## 테스트 결과

### 신규 회귀 (useOrderPolling 15 케이스)

전 케이스 통과:

1. orderId 시 즉시 1회 fetch + URL 에 orderId 포함
2. authToken 시 URL 에 `?token=` 쿼리 포함
3. enabled=false 시 fetch X
4. orderId 없으면 fetch X
5. snapshot 갱신 + status 노출 + isConnected=true
6. 5초 간격으로 폴링 — 5초 경과 시 2회 호출
7. intervalMs 옵션 override 가능
8. ★ onStatusChange — status 전이 시 1회만 호출 (PAID → COOKING)
9. ★ 동일 status 재전송 시 onStatusChange 호출 X
10. ★ 첫 fetch — prev=null 이라 새로고침 후 READY 직진입 시 onStatusChange 호출 X
11. ★ 언마운트 시 setInterval clear + AbortController abort
12. error 시 isConnected=false + error 상태
13. orderId 변경 시 이전 폴링 중단 + 새 polling 시작
14. onStatusChange 매 렌더 새 함수여도 effect 재실행 X (latest ref)
15. ★ BusinessClosedError throw → 전역 핸들러 위임 (error state 에 잡지 X)

### 기존 회귀

- StatusPage 25/25 통과 (mock 대상만 변경, 실 구현 무관).
- 전체 회귀 **839 → 854** 통과. 실패 0.

### 빌드 sanity

- `npm run build` 통과. 번들 사이즈 영향 X (hook 1개 추가).

## 다음에 할 것 (선택)

- 서버 SSE 라우트 (`GET /api/orders/:id/stream`) 구현 시 `useOrderPolling` → `useOrderStream` 1줄 복귀.
- 폴링 동안 server 부하 — D-day 동시 사용자 200명 가정 시 200 req / 5s = 40 RPS. 부담 X.
- 향후 `useGlobalErrorHandler` 에서 본 hook 의 BusinessClosedError throw 를 명시 catch 하는 통합 테스트 추가 검토.
