# 2026-05-17 — 관리자 칸반 inline 액션 추가 (Bug 9, 10)

## 목표

본부 대시보드 칸반의 각 카드에서 *카드를 떠나지 않고* 다음 합법 전이를
한 번의 탭으로 트리거할 수 있게 한다.

- **Bug 9** — TRANSFER_REPORTED 카드에 "보류" 버튼 부재 → HOLD 전이 UI 불가.
- **Bug 10** — TRANSFER_REPORTED 카드에 "확인" 버튼 부재 → PAID 전이 UI 불가.

추가로 design-bundle `screens-admin.jsx` 295~322 라인의 inline 액션 정합을
모든 합법 전이 상태에 일관적으로 적용한다.

## 만든 것 / 변경 파일

- `src/components/organisms/AdminCardColumn.jsx`
  - `ACTION_BY_STATUS` 매트릭스 (6개 상태 × 1~2개 액션) 추가.
  - `OrderCard`: `article` 컨테이너 + 본문 `<button>` + 액션 `<button>` row 분리.
    - 본문 button: 키보드 활성(`Enter`/`Space`) + `onSelect` 호출.
    - 액션 button: `stopPropagation()`으로 본문 핸들러 차단, `onAction(id, to)` 호출.
    - article 자체에도 `onClick={(e) => e.target === e.currentTarget && onSelect}`
      — `fireEvent.click(testid)` 회귀 보장(article 직접 클릭만 본문 핸들러로).
  - `AdminCardColumn` props에 `onAction` 추가, OrderCard로 전달.
- `src/pages/admin/DashboardPage.jsx`
  - `handleAction(orderId, to)` 추가 — `POST /admin/api/orders/:id/transition`
    호출 후 `refetch()`. 401 → `/admin/login`. 그 외 실패는 `console.warn`.
  - `AdminCardColumn` 호출에 `onAction={handleAction}` 전달.
  - §3.5 D.8 (페이지 ≤120줄) 준수 — 핸들러·effect 압축으로 119줄 유지.
- `src/components/organisms/__tests__/AdminCardColumn.test.jsx`
  - `within` import 추가.
  - `describe('OrderCard inline 액션 (Bug 9, 10)', ...)` 블록 신설 — 9 케이스.
- `src/pages/admin/__tests__/DashboardPage.test.jsx`
  - 키보드 활성화 회귀 테스트를 신규 article + 본문 button 구조에 맞춰 갱신.

## 한 일 — 핵심 결정

### 1. 카드 구조 — nested-interactive 회피

기존: `<button data-testid="admin-order-card-N">전체 본문</button>`.
inline 액션 button을 안에 넣으면 nested `<button>` (잘못된 HTML) + axe
`nested-interactive` 위반. 따라서:

```
<article data-testid=...>           // 시맨틱 컨테이너, role 없음 → axe 통과
  <button>본문 (no/price/name/chip/elapsed)</button>
  <div onClick={stopPropagation}>
    <button onClick={stopPropagation + onAction}>확인</button>
    <button onClick={stopPropagation + onAction}>보류</button>
  </div>
</article>
```

axe `aria-allowed-role`을 피하려 article에는 role/tabIndex 미부여.
키보드 진입은 본문 button이 담당. 액션 button도 자체적으로 tab 가능.

### 2. 기존 회귀 `fireEvent.click(getByTestId('admin-order-card-17'))` 보장

article 자체 클릭은 자식 button 핸들러로 버블링되지 않으므로, article에
`onClick={(e) => e.target === e.currentTarget && onSelect(id)}` 부여.
정상 마우스/탭 클릭에서는 본문 button이 잡고, fireEvent로 article을
직접 클릭한 경우만 article onClick이 fallback으로 동작 → 회귀 통과.

### 3. 상태별 액션 매트릭스 — ADR-025 합법 전이 + design-bundle

```
ORDERED           → 취소 (CANCELED)
TRANSFER_REPORTED → 확인 (PAID),    보류 (HOLD)
PAID              → 조리 시작 (COOKING)
COOKING           → 조리 완료 (READY)
READY             → 전달 완료 (DONE)
HOLD              → 재확인 (PAID),  취소 (CANCELED)
```

DONE/CANCELED 터미널은 액션 없음 (`ACTION_BY_STATUS`에 키 없음 → `[]`).

### 4. DashboardPage `handleAction` — 단순화 우선

- 401 → 로그인 redirect (다른 admin 페이지 패턴과 동일).
- 그 외 실패는 `console.warn` 만 — 운영 시 toast 확장 여지 보존하되 본 패치는
  최소 구현. (사용자 요구: 기능 동작 → 후속 폴리시 분리)
- refetch 직후 폴링 사이클로 칸반 갱신.

## 테스트 결과

### RED → GREEN — AdminCardColumn

```
npm test -- --run src/components/organisms/__tests__/AdminCardColumn.test.jsx
```

- RED: 새 describe 블록 9 케이스 모두 실패 (button 부재) — 확인.
- 1차 GREEN: 액션 button 추가 후 25/26 통과. axe 위반 1건
  (`aria-allowed-role`, `nested-interactive`) — article+role=button 구조 때문.
- 2차 GREEN: article에서 role/tabIndex 제거, 본문/액션 button 형제 분리 후
  26/26 통과.

### 통합 회귀

```
npm test -- --run src/pages/admin/__tests__/DashboardPage.test.jsx \
                 src/components/organisms/__tests__/AdminCardColumn.test.jsx \
                 src/__tests__/appendix-d.test.js
```

54/54 통과. appendix-d D.8 (페이지 ≤120줄) 통과.

### 전체

```
npm test
```

```
Test Files  90 passed (90)
     Tests  955 passed (955)
  Duration  85.70s
```

회귀 0건. 도메인 테스트(pricing/coupon/order-state/business-state) 영향 없음.

## 가정 / 디자인 결정

- **HOLD → 재확인**은 `PAID`로 직행 (사용자 지시). design-bundle 일부는
  `TRANSFER_REPORTED`로 되돌아가는 안도 있으나, ADR-025 합법 전이 `HOLD →
  PAID` 가 정의되어 있고 사용자 지시도 PAID 이므로 그대로 따름.
- **실패 처리 UI** — toast 시스템 미구현 상태. `console.warn`으로 시작하고
  운영 중 토스트 컴포넌트가 추가되면 한 줄 교체로 확장 가능.
- **카드 본문 키보드 활성** — 분리 button으로 유지. 액션 button도 별도
  포커스 가능하므로 운영자가 탭으로 본문 → 액션 순회 가능.
- **변경 범위 외 영역**(라우팅·도메인·기타 페이지) 미수정. .env/비밀 파일 미수정.

## 다음에 할 것 (선택)

- 운영 중 실패 시 toast 컴포넌트로 교체 (Bug 9/10과 별개 폴리시).
- TRANSFER_REPORTED 카드 액션과 transfers 화면 액션의 일관성 점검(현재
  대시보드 칸반에서만 inline). 사용자 시나리오 확인 후 transfers 보조 액션
  여부 결정.
