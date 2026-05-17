# Codex find_error_v3 최종 재리뷰

## 1. 최종 판단

**커밋 가능**

현재 브랜치는 `find_error_v3`로 확인되었고, `main...HEAD`에는 커밋된 차이가 없으며 모든 v3 변경은 working tree의 modified/untracked 상태에 있습니다. 이전 리뷰에서 지적한 P1 2건은 코드와 테스트 기준으로 해결되었습니다.

- Windows 호스트 `npm run build` 실패는 `cross-env` 기반 build script로 수정되었고, Windows 호스트에서 직접 빌드 성공을 확인했습니다.
- 관리자 로그인 로그 누락은 `ADMIN_LOGIN` 이벤트에 `operating_date`를 채워 저장하도록 수정되어 `type=system` 및 `type=all` 조회에 포함됩니다.
- `history type` allowlist 검증, 어드민 이모지 제거 보완, 메뉴 변경과 로그 기록 transaction 처리도 확인되었습니다.

단, 아직 커밋 전 상태이므로 아래 Git/커밋 전 확인 항목에 있는 modified/untracked 파일을 빠짐없이 포함하고, `.env`, DB 실데이터, `dist`, `node_modules`, 세션/비밀 파일은 커밋에서 제외해야 합니다.

## 2. P0/P1 이슈

없음.

최종 재리뷰 기준으로 커밋을 막아야 하는 P0/P1 결함은 확인되지 않았습니다.

## 3. 이전 P1 해결 여부

| P1 항목 | 해결 여부 | 근거 파일 | 추가 수정 필요 여부 |
| --- | --- | --- | --- |
| P1-1. Windows `npm run build` 실패 | 해결 | `package.json`, `package-lock.json` | 없음. `build`가 `cross-env NODE_ENV=production vite build`로 변경되었고 Windows 호스트 빌드 성공을 확인했습니다. Dockerfile도 Node 20 계열이라 `cross-env@10.1.0` 요구사항과 맞습니다. |
| P1-2. 관리자 로그인 로그 system history 누락 | 해결 | `server/routes/admin.js`, `server/routes/__tests__/admin.test.js`, `server/repositories/admin-events-repo.js` | 없음. 로그인 성공 시 `ADMIN_LOGIN` 로그에 `operating_date`가 저장되고, `type=system`/`type=all` 조회 테스트가 추가되었습니다. |

## 4. P2/P3 잔여 이슈

| 심각도 | 항목 | 병합 전 필수 여부 | 근거/설명 | 권장 처리 |
| --- | --- | --- | --- | --- |
| P3 | `cross-env@10.1.0`은 Node 20 이상을 요구 | 병합 후 처리 가능 | 현재 호스트는 Node `v20.19.0`, Dockerfile/Dockerfile.dev도 `node:20-alpine`이라 현 환경에서는 문제 없습니다. | README/운영 문서에 로컬 개발 Node 20 기준을 명시하면 좋습니다. |
| P3 | History 탭 카운트가 현재 조회 목록 기준으로만 계산됨 | 병합 후 처리 가능 | 필터 기능 자체는 동작하지만, 탭별 전체 카운트를 별도 집계하지 않습니다. | 운영자가 탭별 건수를 중요하게 쓰면 API 집계 필드 추가를 검토하세요. |
| P3 | 통합 history 정렬 tie-break가 제한적 | 병합 후 처리 가능 | `created_at DESC` 중심 정렬이라 동일 timestamp 이벤트의 세부 순서는 DB/결합 순서에 의존할 수 있습니다. | 필요 시 `created_at DESC, id DESC` 또는 event id 기반 보조 정렬을 추가하세요. |
| P3 | 테스트 출력 경고가 여전히 많음 | 병합 후 처리 가능 | `jsdom`/`axe`의 `getComputedStyle` pseudo-element 경고와 React Router future flag 경고가 출력되지만 테스트 exit code는 0입니다. | 테스트 로그 가독성 개선 차원에서 별도 정리하세요. |
| P3 | 어드민 이모지 검색 결과가 테스트/댓글/공용 기본 config에는 남음 | 병합 후 처리 가능 | 어드민 runtime 사용처는 `showIcon={false}`로 보완됐고, 고객/공용 기본 표시는 유지됩니다. | “어드민 화면 런타임 미노출” 기준이면 문제 없습니다. 완전 검색 제거가 목표라면 테스트명/댓글까지 정리하세요. |

## 5. Git/커밋 전 확인

확인 결과:

- 현재 브랜치: `find_error_v3`
- `main...HEAD` diff: 없음
- working tree: modified 37개, untracked 11개 확인
- 변경 리뷰 범위: main 대비 커밋 diff가 없으므로 working tree modified/untracked 전체가 리뷰 대상입니다.

커밋에 포함해야 할 modified 파일:

- `package-lock.json`
- `package.json`
- `server/db/bootstrap.js`
- `server/db/init.sql`
- `server/domain/__tests__/coupon.test.js`
- `server/domain/coupon.js`
- `server/jobs/__tests__/auto-snapshot.test.js`
- `server/jobs/auto-snapshot.js`
- `server/repositories/coupon-repo.js`
- `server/routes/__tests__/admin.test.js`
- `server/routes/__tests__/customer.test.js`
- `server/routes/admin.js`
- `src/__tests__/App.test.jsx`
- `src/api/schemas.js`
- `src/components/layouts/AdminLayout.jsx`
- `src/components/molecules/StatusChip.jsx`
- `src/components/molecules/__tests__/StatusChip.test.jsx`
- `src/components/organisms/AdminCardColumn.jsx`
- `src/components/organisms/BusinessStateBadge.jsx`
- `src/components/organisms/OrderTimeline.jsx`
- `src/components/organisms/StartBusinessCTA.jsx`
- `src/components/organisms/__tests__/AdminCardColumn.test.jsx`
- `src/components/organisms/__tests__/BusinessStateBadge.test.jsx`
- `src/components/organisms/__tests__/OrderTimeline.test.jsx`
- `src/pages/admin/CouponsPage.jsx`
- `src/pages/admin/DashboardPage.jsx`
- `src/pages/admin/HistoryPage.jsx`
- `src/pages/admin/MenuAdminPage.jsx`
- `src/pages/admin/OrderDetailPage.jsx`
- `src/pages/admin/SettlementPage.jsx`
- `src/pages/admin/TransfersPage.jsx`
- `src/pages/admin/__tests__/DashboardPage.test.jsx`
- `src/pages/admin/__tests__/HistoryPage.test.jsx`
- `src/pages/admin/__tests__/MenuAdminPage.test.jsx`
- `src/pages/customer/CheckoutPage.jsx`
- `src/pages/customer/__tests__/CheckoutPage.test.jsx`
- `src/styles/components.css`

커밋에 포함해야 할 untracked 파일:

- `codereview/codex_find_error_v3_review.md`
- `codereview/codex_find_error_v3_final_review.md`
- `docs/find_error_v3_development_plan.md`
- `docs/find_error_v3_qa_plan.md`
- `docs/find_error_v3_work_instruction.md`
- `docs/tasks/2026-05-18-find_error_v3.md`
- `server/repositories/admin-events-repo.js`
- `server/repositories/__tests__/admin-events-repo.test.js`
- `src/components/layouts/__tests__/AdminLayout.test.jsx`
- `src/constants/menu-effects.js`
- `src/constants/__tests__/menu-effects.test.js`
- `src/utils/admin-display.js`
- `src/utils/__tests__/admin-display.test.js`

커밋에서 제외해야 할 파일/디렉터리:

- `.env` 및 환경변수 파일
- DB 실데이터 파일
- 세션/비밀키/암호 파일
- `dist`
- `node_modules`
- 로그/임시 파일
- `test-results`
- 개인 로컬 설정 파일

커밋 전 재실행 권장 명령:

```powershell
npm run build
npm test -- --run
npm run lint
```

프로젝트의 공식 검증 경로가 Docker 기준이면 다음도 커밋 직전 재확인하는 것이 좋습니다.

```powershell
docker compose -f docker-compose.dev.yml exec dev npm run build
docker compose -f docker-compose.dev.yml exec dev npm test -- --run
docker compose -f docker-compose.dev.yml exec dev npm run lint
```

## 6. 테스트/빌드/lint 평가

- Windows build: 직접 확인 완료. `npm run build`가 성공했습니다.
- Docker build: Claude 보고 기준 성공했습니다.
- 전체 테스트: 호스트에서 `npm test -- --run`을 실행했고 exit code 0을 확인했습니다. Claude 보고 기준 Docker 전체 테스트는 `101 files / 1167 tests passed`입니다.
- lint: 직접 확인 완료. `npm run lint`는 0 errors / 기존 warnings 3개입니다.
- 추가로 필요한 검증: 자동 테스트는 충분히 보강되었지만, 관리자 UI/모바일/현장 주문 흐름은 브라우저 수동 QA가 필요합니다.

기존 lint warnings:

- `src/components/ErrorBoundary.jsx`: unused eslint-disable `no-console`
- `src/hooks/useApi.js`: unused eslint-disable `react-hooks/exhaustive-deps`
- `src/hooks/useGlobalErrorHandler.js`: unused eslint-disable `no-console`

## 7. main 병합 전 수동 QA 체크리스트

- [ ] 같은 `student_id` + 다른 이름으로 쿠폰 중복 사용이 차단되는지 확인
- [ ] 같은 `student_id`로 쿠폰 없이 일반 주문이 가능한지 확인
- [ ] 쿠폰 중복 시 “이미 쿠폰을 사용한 학번이에요.” 문구가 보이는지 확인
- [ ] 관리자 내역 system 탭에서 관리자 로그인 로그가 표시되는지 확인
- [ ] history type 필터 `all` / `orders` / `menus` / `system`이 각각 동작하는지 확인
- [ ] 잘못된 history type 요청이 `400 INVALID_HISTORY_TYPE`으로 처리되는지 확인
- [ ] 메뉴 품절/품절 해제 로그가 메뉴 내역에 남는지 확인
- [ ] 메뉴 추천 상태 변경 로그가 메뉴 내역에 남는지 확인
- [ ] 메뉴 가격 변경 로그가 메뉴 내역에 남는지 확인
- [ ] 장사 시작 시스템 로그가 남는지 확인
- [ ] 자동 백업 로그가 시스템 내역에 남는지 확인
- [ ] 어드민 메뉴 페이지에서 메뉴 효과가 정확히 표시되는지 확인
- [ ] 어드민 nav에서 이체확인 탭이 보이지 않는지 확인
- [ ] 직접 `/admin/transfers` 접근과 관련 라우트/API가 보존되어 있는지 확인
- [ ] 쿠폰 문구가 “컴모융 학생 1,000원 할인”으로 보이는지 확인
- [ ] 쿠폰 대상 패턴 안내 문구가 사용자 화면에서 제거되었는지 확인
- [ ] `admin1` 또는 내부 actor가 화면에서 “어드민”으로 표시되는지 확인
- [ ] 어드민 화면의 불필요한 이모지가 제거되었는지 확인
- [ ] `OPEN`/영업중 옆 초록색 dot은 유지되는지 확인
- [ ] 장사 시작 전에도 6개 상태 컬럼이 표시되는지 확인
- [ ] 대시보드 카드/취소 버튼/스크롤 UI가 design_bundle 기준에 가깝게 보이는지 확인
- [ ] 관리자 UI가 모바일/좁은 화면에서 심각하게 깨지지 않는지 확인

## 8. 결론

커밋 가능 여부: **가능**

main 병합 가능 여부: **수동 QA와 커밋 대상 파일 확인 후 병합 가능**

병합 전 반드시 해야 할 것:

- modified 37개와 untracked 신규 파일을 누락 없이 staging
- `.env`, DB 실데이터, `dist`, `node_modules`, 세션/비밀 파일 제외
- 커밋 직전 `npm run build`, `npm test -- --run`, `npm run lint` 재실행
- Docker를 공식 기준으로 삼는다면 Docker build/test/lint도 재실행
- 위 수동 QA 체크리스트 중 쿠폰, history 필터, 관리자 로그인 로그, 메뉴 로그, 모바일 관리자 UI 확인

병합 후 추적할 것:

- Node 20 로컬 개발 기준 문서화
- History 탭별 카운트/정렬 tie-break 개선 여부
- 테스트 로그 경고 정리
- 어드민 이모지 제거 기준을 런타임 기준으로 유지할지, 문자열 검색 기준까지 넓힐지 결정

이번 최종 재리뷰에서는 소스코드를 수정하지 않았고, 리뷰 문서만 작성했습니다.
