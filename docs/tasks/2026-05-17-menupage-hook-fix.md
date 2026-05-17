# 2026-05-17 — MenuPage React #310 Hook Order 수정 + MenuCard 동일 패턴 + ESLint 최소 셋업

## 목표

D-day(2026-05-20) 3일 전, 어드민 "장사 시작" 직후 사용자가 `http://localhost/` 접속 시 "시스템 오류가 발생했어요" + 콘솔 *Minified React error #310* 발생. 사용자 화면 진입 자체가 막혀 운영 불가능 → **즉시 수정 + 같은 버그 클래스 재발 방지**.

## 만든 것 / 변경한 것

| 파일 | 종류 | 요지 |
|------|------|------|
| `src/pages/customer/MenuPage.jsx` | 수정 | `useMemo`(filteredMenus) 를 `isLoading`/`error` early return *위* 로 이동. |
| `src/components/organisms/MenuCard.jsx` | 수정 | `useCartStore`(inCartQty) 를 `if (!menu) return null` *위* 로 이동, selector 에 null-guard 추가. |
| `package.json` | 수정 | devDependencies `eslint@^9` + `eslint-plugin-react-hooks@^5` 추가, scripts 에 `"lint": "eslint src/"` 추가. |
| `package-lock.json` | 수정 | npm install 결과. |
| `eslint.config.js` | 신규 | ESLint 9 flat config — `react-hooks/rules-of-hooks: 'error'` *룰 1개만* 활성. 의도적으로 `exhaustive-deps` 등 미포함 (D-day 직전 노이즈 차단). |

## 한 일 (구체)

### 1. 원인 진단
- 사용자 시나리오: 어드민에서 "장사 시작" → `business_state` CLOSED→OPEN → 사용자 `/` 접속 → 화이트 스크린 + 콘솔 `Minified React error #310`.
- React 18.3.1 `node_modules/react-dom/cjs/react-dom.production.min.js` `updateWorkInProgressHook` 함수의 `Error(p(310))` = *이번 렌더가 이전 렌더보다 hook 을 더 많이 호출*.
- `src/pages/customer/MenuPage.jsx:36–40` 의 `useMemo(filteredMenus)` 가 두 개 early return (`if (isLoading) return ...`, `if (error) return ...`) 보다 *아래* 에 위치 — `c3c14a5 디자인 리빌드` 커밋에서 plain 표현식 → `useMemo` 메모이즈로 바꾸며 위치를 옮기지 않은 회귀.
- CLOSED 상태에선 `src/components/layouts/CustomerLayout.jsx` 의 businessQuery effect 가 `/closed` 로 즉시 navigate → MenuPage 첫 렌더(isLoading=true) 한 번에서 끝 → bug 잠복. OPEN 으로 바뀌면 두 번째 렌더(isLoading=false, useMemo 추가 호출)가 발생 → React throw.

### 2. Pre-fix audit
- Explore agent 로 어드민 6 페이지 + AdminLayout 라인 단위 스캔: 모두 hook → early return 순서 정상.
- ESLint 설정 부재 확인: `package.json` 에 eslint 의존성·`.eslintrc.*`·`eslint.config.*`·`lint` script 모두 없음 → `react-hooks/rules-of-hooks` 룰이 켜질 환경 자체가 없었음 = 이 버그가 빌드/CI 에서 미검출된 근본 원인.

### 3. ESLint 최소 셋업 (Gap B)
- `npm install --save-dev eslint@^9 eslint-plugin-react-hooks@^5` — 86 packages 추가 (devDependencies 한정, production 런타임 무영향, Docker `npm ci --omit=dev` 도 무영향).
- `eslint.config.js` 작성 — flat config, `files: ['src/**/*.{js,jsx}']`, `rules-of-hooks: 'error'` *만*.
- `package.json` scripts 에 `"lint": "eslint src/"` 추가.

### 4. Pre-fix lint 실행 — 2건의 hook-order 위반 검출
```
src/components/organisms/MenuCard.jsx:38:21
  error  React Hook "useCartStore" is called conditionally. Did you accidentally call a React Hook after an early return?
src/pages/customer/MenuPage.jsx:36:25
  error  React Hook "useMemo" is called conditionally. Did you accidentally call a React Hook after an early return?
```
**의도치 않은 추가 발견**: `MenuCard.jsx` 도 같은 패턴 (line 34 `if (!menu) return null;` → line 38 `useCartStore(...)`). 잠복 버그였지만 lint 가 caught. Pre-fix audit 범위(어드민 페이지·CustomerLayout) 밖이라 Explore agent 가 못 잡았던 곳. 플랜 §B 절차 4("위반이 추가 발견되면 이 PR 안에서 즉시 같은 패턴으로 수정") 에 따라 함께 수정.

### 5. 코드 수정
- **MenuPage.jsx**: `useMemo` 블록을 early return *위* 로 이동. 의미적 동등 — `useMenuData` 가 `menus = menuQuery.data ?? []` 보장(`src/hooks/useMenuData.js:24`) 이라 로딩 중에도 `menus.filter(...)` 안전.
- **MenuCard.jsx**: `useCartStore` selector 를 early return *위* 로 이동, `menuId = menu?.id` null-guard 로 menu=null 시 0 반환. early return 후 사용되지 않으므로 결과 영향 0.

### 6. Post-fix 검증
- `npm run lint` → exit 0, errors 0건 (3 warnings 잔존 — 기존 코드의 `// eslint-disable-next-line no-console` 등이 우리가 안 켠 룰을 가리켜 "unused directive" 로 분류. 정보성, 실패 아님).
- `npm test` → **939/939 통과**, 회귀 0건.
- `docker compose up -d --build app` → app 컨테이너 재기동 후 healthy.
- Live curl 매트릭스 (모두 200 + text/html 1112B):
  - `GET /` → 200
  - `GET /menu` → 200
  - `GET /admin/login` → 200
  - `GET /admin/dashboard` → 200
- `business_state` 확인: `{"status":"OPEN","operating_date":"2026-05-20"}` — 사용자가 누른 "장사 시작" 그대로 유지.
- 새 번들 해시 `index-Bf0b2IUC.js` 배포 확인, `Cache-Control: public, max-age=31536000, immutable` (ADR-023 nginx P2 정책 정상 동작).
- 옛 번들 요청 (`index-Bx4bqo9u.js`) → Express SPA fallback HTML + nginx `no-store` (Codex P2 fix 가 stale asset 트랩 차단 — 정상).

## 테스트 결과

| 단계 | 결과 |
|------|------|
| Pre-fix `npm run lint` | ✗ 2 errors (MenuPage:36 + MenuCard:38) — 의도대로 검출 |
| Post-fix `npm run lint` | ✓ exit 0, 0 errors |
| `npm test` | ✓ 939/939 passed, 90 test files |
| `docker compose up -d --build app` | ✓ container healthy 10s |
| Live curl `/`, `/menu`, `/admin/login`, `/admin/dashboard` | ✓ 4/4 routes 200 |
| 브라우저 검증 | **사용자 수동 — D-1 리허설(5/19) 직전 확인 권장** |

## 위반 사항 / 절대 깨지면 안 되는 것

이번 수정은 다음 어떤 항목과도 무관:
- ADR-020 Pattern B 가격 계산 — 무수정
- ADR-019 쿠폰 학번 정규식 — 무수정
- ADR-021 학번+이름 — 무수정
- ADR-025 주문 상태 머신 — 무수정
- G13 영업 상태 머신 — 무수정
- ADR-012 정산 마감 가드 — 무수정
- ADR-023 Docker compose + nginx — 무수정 (P2 캐시 정책 그대로 작동 확인)
- ADR-024 React 18 SPA — 무수정
- §3.5 React 가이드 8조 — **개선** (Hook Rules 룰 자동 검사 도입)

## 다음에 할 것

- D-1 리허설(2026-05-19) 시 사용자 브라우저로 `http://localhost/` → `/menu` → 카테고리 탭 (전체/추천/치킨/사이드/음료) 클릭 → React error 부재·필터링 정상 확인.
- (별개 PR 가치) `react-hooks/exhaustive-deps` 룰 활성화 — `useApi.js:71` 의 의도적 disable 주석이 정상 인식되도록 검증 후. D-day 후.
- (별개 PR 가치) ESLint CI 통합 / pre-commit hook. D-day 후.
- (별개 PR 가치) MenuPage 회귀 테스트 추가 — `useMenuData` mock 으로 isLoading=true→false 전환 시뮬레이션 후 hook 카운트 변동 안 됨을 확인.
