# 구현 진행 기록

`docs/IMPLEMENTATION_PLAN.md`의 52개 task를 React 기준으로 모두 완료. **D-day 5/20 16:30 운영 시작 준비 완료**.

**시작일:** 2026-05-12 (PRD/MVP·기획 단계)
**구현 시작:** 2026-05-14
**구현 마감:** 2026-05-14 (당일 8 Phase 완료)
**D-day:** 2026-05-20 16:30

## 진행 상태

| Phase | 범위 | 상태 |
|---|---|---|
| 0 | 부트스트랩 (Vite + React + 토큰 + 라우터 + 테스트 + Express + Docker, 6 task) | ✅ 완료 |
| 1 | 디자인 토큰 + Atoms 8개 (3 task) | ✅ 완료 |
| 2 | Molecules + Organisms 25개 (11 task) | ✅ 완료 |
| 3 | Zustand 3 slice + API client + SSE + 전역 에러 (4 task) | ✅ 완료 |
| 4 | 사용자 페이지 9종 (모두 ≤120줄) (9 task) | ✅ 완료 |
| 5 | 관리자 페이지 5종 + 단축키 안내 모달 (5 task) | ✅ 완료 |
| 6 | 백엔드 도메인 7개 + 사용자/관리자 API + 미들웨어 + 자동 ZIP (9 task) | ✅ 완료 |
| 7 | 부록 D 자동화 + 운영 카드 + D-1 리허설 (5 task) | ✅ 완료 |

## 종합 결과

- **단위·통합 테스트**: 835/835 통과 (Vitest)
- **번들**: 사용자 chunk 89.32 kB gzip (cap 250 kB), 관리자 6 chunk 분리
- **회귀 안전망**: ADR-020 ★★★ pricing 4 회귀 + ADR-019 쿠폰 12 + 상태 머신 18 + G13 11 + 정산 가드 4 + 부록 D 8항목 자동화
- **운영 자산**: `docs/operations/admin-card.md` (인쇄 카드), `docs/operations/d1-rehearsal.md` (5/19 리허설 10 섹션 체크리스트)

## 작업 로그

각 작업의 상세는 `docs/tasks/2026-05-14-task-*.md` 참조 (31개 파일). 아래는 Task별 간략 요약.

| Task | 상태 | 커밋 | 비고 |
|---|---|---|---|
| 0.1 Vite + React 18 셸 | ✅ | a5d39fc | TDD smoke 1 |
| 0.2 디자인 토큰 + Tailwind | ✅ | 9bae016 | 9 컬러 회귀 |
| 0.3 라우팅 셸 + lazy 관리자 | ✅ | 2d792c4 + 66578ef | 19 케이스 |
| 0.4 테스트 인프라 (vitest+axe+Playwright) | ✅ | a1e23dc | 번들 axe-core 0건 회귀 |
| 0.5 Express 백엔드 셸 | ✅ | 59876ab | /healthz + helmet+pino |
| 0.6 Docker compose + named volume | ✅ | 87c33f4 | 빌드 검증은 D-1 리허설 위임 |
| 1.1 Button atom | ✅ | e3c68cc | 5 variant + 3 size + a11y |
| 1.2 Form atoms 5종 | ✅ | 0e9a046 | forwardRef + 29 케이스 |
| 1.3 Icon/Spinner/Divider + barrel 회귀 | ✅ | f1f3faf | lucide-react named import 강제 |
| 2.1 StampBadge | ✅ | 7a0308e | 5 도장 + 회전 inline style |
| 2.2 PriceTag/StatusChip/CountBadge/IconLabel/MenuFallback | ✅ | aa968b6 + 4de4d33 (fix) | tokens-tailwind sync 회귀 추가 |
| 2.3 DogTagFrame ★ Memorable | ✅ | 8d44264 | useState 초기화 함수 (useEffect X) |
| 2.4 MascotState | ✅ | 5becee2 | 5 state + 이모지 fallback |
| 2.5 MenuCard + 8 메뉴 데이터 | ✅ | c257900 | "줍기" 버튼만 클릭 (결정 f) |
| 2.6 CartItem + OrderTimeline | ✅ | da201b0 | ADR-010 보존 (추정 X) |
| 2.7 TransferReportForm + AdminCardColumn (memo) | ✅ | 54794c4 | React.memo + tick 패턴 |
| 2.8 BusinessStateBadge + StartBusinessCTA | ✅ | bc357d0 | 깜박 매번 재생 (결정 h) |
| 2.9 ClosedScreen | ✅ | e207b62 | aria-live=polite 운영 일정 |
| 2.10 BoothMinimapModal + fix | ✅ | 4c1e047 + ec97809 | backdrop + onClose latest ref |
| 2.11 EmptyState + LoadingState + ErrorState | ✅ | 12756cd | 3분기 공통 컴포넌트 |
| 3.1 Zustand store 3 slice | ✅ | 6251fc3 | 셀렉터 강제 회귀 |
| 3.2 API client + zod + AbortController | ✅ | bcdc546 | BusinessClosedError 423 |
| 3.3+3.4 useOrderStream SSE + 전역 에러 | ✅ | 6a843d4 | onStatusChange(prev, next) |
| 4.1 CustomerLayout (423 reactive, 폴링 X) | ✅ | 8c435f3 | useGlobalErrorHandler |
| 4.2 MenuPage + 4 organism 분리 | ✅ | 5347801 | 98줄, StickyCartBar 직접 구독 |
| 4.3+4.4 CartPage + CheckoutPage | ✅ | 69bf5c8 | 학번 정규식 + DeliveryTypeSelector |
| 4.5+4.6 CompletePage + TransferPage | ✅ | 0ae4dd9 | Clipboard 3단계 fallback |
| 4.7+4.8+4.9 StatusPage(SSE) + MapPage + Closed/Error | ✅ | f91bab4 | READY 진동 prev/next 회귀 |
| 5.1+5.3 LoginPage + OrderDetailPage + TransfersPage | ✅ | cbe1905 | PIN 정규식 + 6 액션 + 13 합법 전이 |
| 5.2 DashboardPage (Kanban + G13 토글) | ✅ | 7c96e28 + 6fb723f | tick + React.memo |
| 5.4+5.5 MenuAdminPage + SettlementPage (ZIP) | ✅ | f3c211b | 낙관 토글 + ADR-012 가드 |
| 6.1 init.sql + bootstrap + seedAdmin | ✅ | a19d28d | 11 테이블 + 시드 + PIN 해시 |
| 6.2+6.3+6.4 도메인 7 모듈 | ✅ | 5607090 | ADR-020 4 ★★★ + ADR-019 변경 |
| 6.5+6.6+6.8 Repositories + 사용자 API + Middleware | ✅ | 7c2b895 | 63 신규 케이스 |
| 6.7+6.9 관리자 API 16 + 자동 ZIP | ✅ | 3f4018c | express-session + archiver |
| 7.3+7.4+7.5 단축키 안내 + 부록 D + 운영 카드 + D-1 | ✅ | f5d1dae | 운영 준비 완료 |

## D-1 (5/19) 진입 전 미해결

1. **DECISIONS.md ADR-019 변경 기록** — 2026-05-14 보강 완료. CLAUDE.md `prefix 202637` 표기는 사용자 수정 권한이라 미변경.
2. **Docker compose 실 빌드** — Docker Desktop 미가동으로 syntax만 검증. `docs/operations/d1-rehearsal.md` §2 SW 가동 절차로 5/19에 실 검증.
3. **PUBG 일러스트 8장 / 마스코트 5장 자산** — D-3 (5/17) 수령 예정. 미수령 시 이모지 fallback 자동 동작.
4. **E2E Playwright 14 시나리오 자동화** — 인프라 비용 vs 일정 트레이드오프로 보류. `d1-rehearsal.md` 10 섹션 체크리스트로 수동 대체.
5. **express-session 운영 store** — 현재 메모리 store (단일 컨테이너라 OK). 재부팅 시 세션 끊김 — D-1 리허설에서 운영자 PIN 재로그인 경로 확인.

---

## 디자인 보정 라운드 (`design_fix_v2`, 2026-05-18 ~ 05-19)

D-day 직전 디자인 정합·UX 마찰·운영 UI 정리 3차 누적. 각 차수는 별도 작업 문서에 상세 기록. 본 라운드는 **새 ADR 신설 없이** ADR-006/020/021/024/033 보존 범위 안에서의 UI 보정·시각 정합·미사용 경로 정리.

| 차수 | 일자 | 범위 | 커밋 | 작업 문서 |
|---|---|---|---|---|
| 1차 | 2026-05-18 | PUBG 그래픽 자산 5위치 적용 (이모지 → `<img>`: CustomerLayout 헤더 ×2, StickyCartBar, BoothMinimapModal, CartPage) + CheckoutPage 개인정보 수집 안내 문구 | `904009d` | `docs/tasks/2026-05-18-pubg-images-and-privacy-notice.md` |
| 2차 | 2026-05-19 | 사용자 흐름 UI 5건 정리 — CompletePage back-bar+ghost 버튼 제거, StatusPage `OrderTimeline`·"현재 상태" 행 제거, TransferReportForm "다른 이름으로 이체" 분기 제거(클라+서버 매칭/응답/스키마), `use_other_name`·`other_name` DB 컬럼은 운영 회피 차원에서 유지. 사전 기획·지시·검수 3문서 작성. | `5bcd3aa` | `docs/tasks/2026-05-19-ui-trim-cleanup.md` (+ `2026-05-19-ui-trim-cleanup/01~03-*.md`) |
| 3차 | 2026-05-19 | 메뉴 카드 인라인 빼기 보조 버튼 (`MenuCard` 의 새 `onDec` prop + `.pick-btn-group`/`.pick-btn-dec` 토큰, 카트≥1 일 때만 등장, 44px 타깃) + 어드민 페이지 노출 개발자 메모 정리 (`MenuAdminPage` 푸터 `Pattern B (ADR-020)` 블록 제거, `SettlementPage` close-guard 메시지 `(ADR-012)` 꼬리 제거). | `eedfbb7` | `docs/tasks/2026-05-19-ux-card-decrement-and-admin-cleanup.md` |
| 4차 (`minimap_design`) | 2026-05-19 | 미니맵 임시 격자 UI(T1~T16) → 이미지 기반 UI 교체 (`public/map/table-location.webp` 2.43MB · `BoothMinimapModal` 가운데 좌표 overlay 마커 제거 · `totalTables` prop 신설 · 격자 fallback도 cap 적용). 부스 좌석 1~15 정책 정렬 (CheckoutPage `TABLES` 1~15 / 라벨 "1~15" / 미니맵 legend "총 15개 테이블" / 서버 zod `min(1).max(15)` + 한글 위반 메시지). | (머지 커밋) | `docs/tasks/2026-05-19-minimap-design-and-table-range.md`, `docs/tasks/2026-05-19-minimap-webp-and-table-no-validation.md` |

**테스트 추이:** 1173 (1차 후) → 1165 (2차, 미사용 회귀 8건 정리) → 1170 (3차, 신규 5건 추가) → 1185 (4차, table_no 1~15 백엔드 10건 + 격자 cap 1건). 모든 차수에서 production 번들 빌드 정상, 운영 컨테이너 헬스체크 정상.

---

## table_lock 라운드 (`table_lock`, 2026-05-19)

DINING/SETTLED 상태 신설 + 테이블 점유 가드 + 어드민 잠금 페이지. 서브에이전트 1~6 협업 구현.

| 서브에이전트 | 담당 | 커밋 | 작업 문서 |
|---|---|---|---|
| SA-1 | table-availability 도메인 + table_locks 리포 + init.sql 스키마 + customer.js 가드 + GET /api/tables/availability | `table_lock` | — |
| SA-2 | LEGAL_TRANSITIONS (READY→DINING→SETTLED), DONE dead, dining_at/settled_at, UI 라벨 | `table_lock` | — |
| SA-3 | 어드민 대시보드 7열 그리드 + DINING 컬럼 + dining 경과 tone | `table_lock` | — |
| SA-4 | /admin/tables 페이지 + GET/POST /admin/api/tables + admin_events 'system' 로깅 | `table_lock` | — |
| SA-5 | CheckoutPage availability fetch + disabled 셀 + 안내 메시지 | `table_lock` | — |
| SA-6 | 로깅 검증 + 마이그레이션 006 신설 + 테스트 3건 추가 + docs 동기화 | `table_lock` | `docs/tasks/2026-05-19-table-occupancy.md` |

**테스트 추이 (table_lock):** 1308 (SA-5 종료) → 1311 (SA-6, READY→DINING→SETTLED 로깅 회귀 3건 추가). production 번들 빌드 정상. 운영 컨테이너 migration 006-table-lock 적용 후 `/api/tables/availability` 200 정상.

---

## table_lock Codex P1/P2 보완 라운드 (2026-05-19)

`codereview/codex_table_lock_review.md`(1차) → `codereview/codex_table_lock_p1_fix_review.md`(2차) 두 차례 리뷰 반영.

| 라운드 | 담당 | 핵심 |
|---|---|---|
| P1-1 | 프론트 schema/UI | `OrderStatusSchema`에 DINING/SETTLED 추가 + `OrderSchema.dining_at/settled_at` + StatusChip 매핑 + OrderTimeline 5단계 done |
| P1-2 | 정산/스냅샷 | `IN_PROGRESS_STATES`에 DINING 추가 + `COMPLETED_STATES = ['SETTLED', 'DONE']`로 매출 집계 (레거시 DONE 호환) |
| P1-3 | bootstrap 006 | 기존 DB의 `orders.status` CHECK 갱신 — orders table rebuild 패턴 (`orders_new` + INSERT SELECT + DROP + RENAME), idempotent |
| P2-#1 | dineIn 검증 | `delivery_type` undefined도 dineIn으로 간주 → table_no 필수 강화 |
| P2-#2 | 006 schema 검사 | `_migrations` 마크와 별개로 schema 확인. 불완전 006 좀비 DB 자동 보정 |
| P2-#3 | ISO 변환 | `dining_at`, `settled_at`을 admin/customer serializer TS_FIELDS에 포함 |

**테스트 추이 (Codex 보완):** 1311 (1차) → 1339 (P1) → 1343 (P2). 신규 회귀 +21건. 기존 페이로드 53+개에 `delivery_type: 'takeout'` 보강 (테스트 의도 보존, 기능 변화 0). lint 0 error / 3 기존 warning. production build 정상.

작업 문서: `docs/tasks/2026-05-19-table-occupancy-codex-fixes.md`.

---

## design_fix_v3 라운드 (`design_fix_v3`, 2026-05-19)

D-1 리허설 직전 사용자 두 건 요청 — 미니맵 legend 문구 두 줄 삭제 + ALREADY_USED 에러를 화면 가운데 모달 팝업으로 격상. **새 ADR 신설 없이** ADR-019/021/034 (쿠폰 정책) 보존 범위 안에서 UX 노출 형태만 변경.

| 차수 | 일자 | 범위 | 커밋 | 작업 문서 |
|---|---|---|---|---|
| R1 (카드) | 2026-05-19 | ① `BoothMinimapModal.jsx` `.minimap-legend` div 7줄 삭제 (`내 테이블: -(포장 또는 일반)` / `총 N개 테이블`). `totalTables` prop 은 fallback 격자 cap 용도로 계속 유효. ② `ALREADY_USED` 에러를 폼 아래 inline-field → `ErrorState variant="card"` (마스코트 + 안내 + `쿠폰 사용 해제` CTA). 신규 `src/components/molecules/CheckoutSubmitError.jsx` 추가. | `98f2b1f` | `docs/tasks/2026-05-19-minimap-legend-and-coupon-blocked-card.md` |
| R2 (모달) | 2026-05-19 | R1 카드가 sticky bar/긴 영수증 아래라 모바일에서 발견이 늦다는 사용자 피드백 — 화면 가운데 `role="alertdialog"` 모달 팝업으로 전환. 마스코트 + 메시지 + 안내 + `쿠폰 사용 해제` / `닫기` 두 버튼 + Escape · backdrop 닫기 + body 스크롤 잠금 + 자동 포커스 + cleanup. `submitError` state 를 `{ message, code? }` 객체로 격상하되 `CheckoutPage.jsx ≤ 120줄` 유지. | `98f2b1f` | 같은 문서 R2 섹션 |

**테스트 추이:** 1343 (P2 직후) → 1351 (R1: molecule 6 + 통합 2) → **1358** (R2: molecule 6 추가 + 통합 1 추가). production 번들 305.10 kB (gzip 95.01 kB, R1 대비 +1.56 kB). 운영 경로(서버 middleware / 정적 자산 / nginx) 미변경 → 4 단계 사이드체크 트리거 안 함.
