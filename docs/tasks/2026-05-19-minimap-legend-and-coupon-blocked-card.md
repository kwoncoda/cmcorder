# 2026-05-19 — 미니맵 legend 삭제 + ALREADY_USED 가운데 모달 (design_fix_v3 R1·R2)

## 목표

D-1 리허설 직전 사용자 요청 두 건:

1. 테이블 지도 모달의 legend(`내 테이블: -(포장 또는 일반)` / `총 N개 테이블`) 두 문구를 삭제.
2. `이미 쿠폰을 사용한 학번이에요.` 에러가 폼 맨 아래 작은 빨간 텍스트로만 뜨던 것을 사용자가 알아차리기 쉬운 형태로 개선.
   - **R1 (초안)**: 폼 아래 카드(`ErrorState variant="card"`). 검토 결과 모바일에서 sticky bar/긴 영수증 아래라 여전히 발견이 늦다는 피드백.
   - **R2 (최종)**: 화면 가운데 **모달 팝업** (role=alertdialog + 마스코트 + 안내 + `쿠폰 사용 해제`·`닫기` 두 버튼). 사용자 명시 요청 — "가운데에 팝업창으로 뜨도록 해줘 잘 안보인다".

두 건 모두 시각 UX 개선이고, 백엔드·운영 경로(static asset / nginx / middleware) 영향 없음. CLAUDE.md `절대 깨지면 안 되는 것` 매트릭스(ADR-019/020/021/023~025/033/034, G13 등) 전부 비파괴 변경.

## 만든 것 / 한 일

### A. 미니맵 legend 삭제

- **`src/components/organisms/BoothMinimapModal.jsx`** — `.minimap-legend` div 블록(7줄) 제거.
  - 모달 body 마지막 두 줄(`내 테이블: <strong>...</strong>` / `총 N개 테이블`) 제거.
  - `totalTables` prop 은 fallback 격자 셀 cap(`T1~T15` 만 렌더) 용도로 계속 유효 — fallback cap 회귀 테스트(`★ fallback 격자도 totalTables 로 cap`)는 변경 없이 통과.
- **`src/components/organisms/__tests__/BoothMinimapModal.test.jsx`** — 기존 `★ totalTables prop 이 cols*rows 보다 우선 (legend 표시 기준)` 케이스를 `★ design_fix_v3 — minimap-legend 미노출 (내 테이블 / 총 N개 테이블 문구 삭제)` 회귀로 교체. 세 정규식(`/총 \d+개 테이블/`, `/내 테이블:/`, `/포장 또는 일반/`) 모두 부재 검증.
- **`src/pages/customer/__tests__/MapPage.test.jsx`** — 기존 `★ "총 15개 테이블" legend 노출 (minimap_design 정책)` 케이스를 `★ design_fix_v3 — legend 문구 ... 미노출` 부재 검증으로 교체. 상단 회귀 보호 주석도 새 정책으로 동기화.

CSS(`.minimap-legend`) 정의는 그대로 둠 — dead style 1 개. 다른 분기 가능성이 있고 D-day 리허설 임박이라 surgical change 원칙(CLAUDE.md "3. Surgical Changes")에 따라 추가 제거 안 함.

### B. ALREADY_USED 가운데 모달 팝업

서버는 이미 `400 { error: 'ALREADY_USED', message: '이미 쿠폰을 사용한 학번이에요.' }` 로 응답 (CLAUDE.md ADR-034). 클라이언트 `ApiError.code === 'ALREADY_USED'` 분기로 모달 팝업.

- **`src/components/molecules/CheckoutSubmitError.jsx`** *(신규)* — 주문 제출 에러 노출 분기 molecule. 안에 사설 `CouponBlockedModal` 컴포넌트 보유.
  - `error.code === 'ALREADY_USED'` → 화면 가운데 alertdialog 모달:
    - 마크업: `<div role="alertdialog" aria-modal aria-labelledby aria-describedby class="fixed inset-0 z-50 flex items-center justify-center p-md">` → backdrop 버튼 + 카드 (마스코트 😢 + h2 메시지 + p 안내 + `쿠폰 사용 해제` 1차 버튼 + `닫기` 2차 버튼).
    - 열림 시 1차 버튼에 자동 포커스, body `overflow=hidden` 스크롤 잠금, Escape 키 = 닫기, backdrop 클릭 = 닫기.
    - 언마운트 시 이전 포커스 복귀 + body overflow 복귀.
    - `data-testid="checkout-coupon-blocked"` / `data-testid="coupon-blocked-backdrop"` 회귀 식별.
  - 그 외 (TABLE_NOT_AVAILABLE / MENU_SOLD_OUT / 네트워크 등) → 기존 `ErrorState variant="inline-field"` 유지 — 다른 회귀 깨지지 않음.
  - 회복 안내 카피: `쿠폰 사용을 해제하면 같은 학번으로 일반 주문은 가능해요.` — UX §6.3 "사실 + 회복 경로" 원칙.
  - "쿠폰 사용 해제" 와 "닫기" 동작 분리:
    - **쿠폰 사용 해제**: `onClearCoupon` — 쿠폰 체크박스 해제 + 에러 상태 null (모달 자동 닫힘). 다음 제출은 일반 주문으로 진행 가능.
    - **닫기**: `onClose` — 에러 상태만 null (쿠폰 체크는 유지). 사용자가 직접 해제 여부 판단.
- **`src/components/molecules/__tests__/CheckoutSubmitError.test.jsx`** *(신규, 12 케이스)* — null·모달 마크업(role/aria/className)·자동 포커스·body 스크롤 잠금·각 닫기 경로(Escape/backdrop/`닫기` 버튼)·언마운트 cleanup(포커스 복귀 + overflow 복귀)·다른 code inline·code 없는 경우·axe.
- **`src/pages/customer/CheckoutPage.jsx`** *(120줄 유지)* — `submitError` state 를 string → `{ message, code? }` 객체로 격상.
  - 4 곳 (`handleTableClick`, `handleSubmit` 사전 refresh 분기, catch 블록) 호출 사양만 객체로 변환. 라인 수 증가 0.
  - 마지막 ErrorState inline 한 줄을 `<CheckoutSubmitError error={submitError} onClearCoupon={() => { setCoupon(false); setSubmitError(null); }} onClose={() => setSubmitError(null)} />` 한 줄로 교체.
  - `ErrorState` 직접 import 제거 → `CheckoutSubmitError` import.
- **`src/pages/customer/__tests__/CheckoutPage.test.jsx`** *(3 케이스 신규)*:
  - `★ design_fix_v3 round2 — ALREADY_USED 응답 시 화면 가운데 모달 팝업(role=alertdialog) 노출` — testid + role/aria + `fixed inset-0` className + 메시지·안내·두 버튼 노출 + inline-field 부재.
  - `★ design_fix_v3 round2 — ALREADY_USED 모달 "쿠폰 사용 해제" 클릭 → 쿠폰 체크 해제 + 모달 사라짐`.
  - `★ design_fix_v3 round2 — ALREADY_USED 모달 "닫기" 클릭 → 모달 닫힘 (쿠폰 체크는 유지)`.

§3.5 1조 회귀(`CheckoutPage.jsx ≤ 120줄`) 그대로 통과 — 본문 120줄 유지.

## 테스트 결과 (★ docker 전용 — ADR-033)

### 단위·통합 (Vitest)

```
docker compose -f docker-compose.dev.yml exec dev npm test
→ Test Files  107 passed (107)
→      Tests  1358 passed (1358)
   Duration  173.21s
```

이전(table_lock 라운드 직후) 1343 → R1 +8(카드형 6 + 통합 2) → R2 +7(모달 12 으로 +6, 통합 3 으로 +1) = **1358**. 신규 회귀 전부 그린. R2 에서 카드 → 모달 전환에 맞춰 molecule 테스트 전면 재작성, 통합 테스트 3 케이스 (alertdialog 마크업 / "쿠폰 사용 해제" / "닫기") 로 분리.

### 프로덕션 번들 빌드 (cross-env NODE_ENV=production)

```
docker compose -f docker-compose.dev.yml exec dev npm run build
→ ✓ 193 modules transformed.
→ dist/assets/index-C3-0WQen.js  305.10 kB │ gzip: 95.01 kB
→ ✓ built in 6.14s
```

R2 모달 로직 추가로 R1 대비 +1.56 kB (gzip +0.31 kB).

### 운영 경로 사이드체크

스킵. 서버 미들웨어 / 정적 자산 화이트리스트 / nginx 미변경 — CLAUDE.md 작업 절차 4 단계 트리거 안 함. 변경은 React SPA 컴포넌트 트리 내부.

### 수동 시각

수동 페이지 검증은 운영 컨테이너 재배포 대신 다음 D-1 리허설(5/19 저녁) 흐름에서 확인. 단위/통합 테스트가 카드 마크업·CTA 동작·legend 부재를 모두 회귀 보호.

## 절대 깨지면 안 되는 것 — 영향 없음 재확인

- ADR-020 Pattern B (서버가 가격 재계산) — 변경 없음.
- ADR-019 / ADR-021 / ADR-034 쿠폰 정책 — *카피와 행동 동일*, 단지 노출 형태만 카드로 격상.
- ADR-025 주문 상태 13 전이 — 변경 없음.
- G13 영업 상태 머신 / ADR-023 PIN / ADR-024 React 18 SPA / §3.5 8조 React 가이드(120줄, 셀렉터, axe dev-only 등) — 전부 통과 (appendix-d 회귀 그린).
- ADR-033 docker 전용 dev/test — 본 라운드 전부 docker compose exec 로 실행.
- table_lock 라운드 회귀 (`READY → DINING → SETTLED` / `table_locks` / `admin_events` history) — 변경 없음, 1351/1351 그린.

## 다음에 할 것

- D-1 리허설(5/19 저녁) 모바일 실기기 sanity:
  - `/map` 페이지에서 legend 두 줄이 안 보이는지 확인.
  - 쿠폰 사용 + 중복 학번 시뮬레이션 → 화면 가운데 모달 팝업이 뜨고 `쿠폰 사용 해제` / `닫기` / Escape / backdrop 닫힘이 모두 작동하는지 확인.
- (선택) `.minimap-legend` CSS dead style 정리는 D-day 이후 운영 안정화 단계로 미룸.
