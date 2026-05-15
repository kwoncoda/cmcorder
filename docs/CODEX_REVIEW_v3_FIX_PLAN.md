# Codex 리뷰 v3 P1 수정 계획

작성일: 2026-05-15
대상: `docs/codex리뷰결과_v3.md` 의 P1 6건 (P0 0건, P2 5건은 본 작업 범위 X)
실행 모드: Superpowers subagent-driven-development + TDD (자동, 무승인)

## 0. v3 P1 항목 매핑

| # | 항목 | 본 계획 ID | 우선순위(작업 순서) |
|---|---|---|---|
| 1 | ZIP 백업 구성물 미충족 | P1-1 | 5 (마지막 코드) |
| 2 | 자동 백업 Docker volume 경로 | P1-2 | 2 |
| 3 | access_token 로그 노출 | P1-3 | 1 (보안 최우선) |
| 4 | /admin/menu vs /admin/menus + nav 부재 | P1-4 | 3 |
| 5 | 일자별/합산 정산 UI 부재 | P1-5 | 4 |
| 6 | E2E 14개 시나리오 | P1-6 | 6 (BLOCKED 검토) |

## 1. 사전 검증

| 항목 | 검증 | 결론 |
|---|---|---|
| P1-1 ZIP 구성 | `server/jobs/auto-snapshot.js:78-90` createSettlementZip = settlement.sql + summary.json 2개만. FEATURE F-A-034는 manifest/orders/coupons/menu/PDF/images. | **누락 확정** |
| P1-2 백업 경로 | `auto-snapshot.js:29` 기본 `./backups`. `server/server.js:25-29` BACKUP_DIR 미주입. compose volume은 `/data`만 | **누락 확정** |
| P1-3 token 로그 | `server/app.js:41-45` pino-http 기본. `server/lib/logger.js` redaction 없음. `req.url`, `req.query.token` 출력 | **보안 확정** |
| P1-4 경로 불일치 | `src/App.jsx:85` `/admin/menu` (singular). 테스트/문서는 `/admin/menus` (plural). nav 부재 | **경로 + UX 확정** |
| P1-5 일자별 정산 | API는 date 지원. UI는 현재 일자만. F-A-028는 P0 양일/합산 | **누락 확정** |
| P1-6 E2E 14 | smoke 1개만. PLAN/TEST_PLAN의 E2E-01~14 미구현 | **부분 BLOCKED** |

## 2. 작업 순서 — 보안 → 운영 → UI

### P1-3 (1순위, 보안). 로그 token redaction
**파일:** `server/lib/logger.js`, `server/app.js`
**TDD:**
1. 실패 테스트: `logger.info({ req: { url: '/api/orders/1?token=secret' } }, '...')` → 출력 JSON에 `secret` 미포함 (마스킹된 `[REDACTED]`).
2. pino `redact.paths`에 `req.url`, `query.token`, `req.query.token` 등 추가 + `censor` 함수로 URL의 `token` 쿼리만 마스킹.
3. pino-http는 logger 상속 — 자동 적용.

### P1-2 (2순위). 백업 Docker volume 경로
**파일:** `server/server.js`, `docker-compose.yml`, `docs/operations/admin-card.md`
**TDD:**
1. 실패 테스트: `server/__tests__/server-config.test.js` (또는 startAutoSnapshot에 dir 옵션 검증). NODE_ENV=production 환경에서 BACKUP_DIR default가 `/data/backups`.
2. `server/server.js` BACKUP_DIR 환경변수 + `startAutoSnapshot(db, { dbPath, dir: BACKUP_DIR })`.
3. `docker-compose.yml` 환경변수 `BACKUP_DIR=/data/backups` 명시.
4. ADR-022 본문/admin-card 갱신.

### P1-4 (3순위). 경로 통일 + Admin nav
**파일:** `src/App.jsx`, `src/components/layouts/AdminLayout.jsx` (신규), `src/pages/admin/*.jsx` 6개 (페이지가 nav를 포함)
**TDD:**
1. 실패 테스트: `App.test.jsx` `/admin/menus` 진입 시 `admin-menu-page` 렌더.
2. 실패 테스트: `AdminLayout`에 본부/메뉴/정산 링크 + 현재 위치 강조.
3. `src/App.jsx` `/admin/menu` → `/admin/menus`. AdminLayout 도입 (5개 페이지 공통).
4. nav: 본부(`/admin/dashboard`) / 메뉴(`/admin/menus`) / 정산(`/admin/settlement`) / 이체확인(`/admin/transfers`).

### P1-5 (4순위). 일자별 정산 + 합산 UI
**파일:** `src/pages/admin/SettlementPage.jsx`, 신규 도메인 함수 `getSettlementSummaryAggregated(db, dates)`
**TDD:**
1. 실패 테스트(서버): 신규 `getSettlementSummaryAggregated`가 여러 날짜 합산 반환.
2. 실패 테스트(UI): 일자 셀렉터(2026-05-20/21/합산) → 각 데이터 표시.
3. SettlementPage에 select + state + apiFetch(date) 재호출.
4. ≤120줄 유지 (또는 도메인 분리).

### P1-1 (5순위). 정산 ZIP 구성 보강
**파일:** `server/jobs/auto-snapshot.js`, `server/jobs/__tests__/auto-snapshot.test.js`
**TDD:**
1. 실패 테스트: ZIP 내용물에 `manifest.json`, `orders.csv`, `coupons.csv`, `menu-snapshot.json`, `settlement.sql`, `summary.json` 모두 포함.
2. `createSettlementZip` 확장: orders/order_items/used_coupons/menus를 CSV/JSON로 export + manifest.json (생성 시각, 운영일자, 파일 목록).
3. PDF/images는 보류 (PDF 생성기 부재 — 운영 폴더 별도 보관).
4. ZIP 크기 ≤ 1MB 확인 (운영 시 download 가능).

### P1-6 (6순위). E2E 14
**판단:** 14개 시나리오 full 구현은 비용 ≫ 가치. D-1 리허설로 흐름 검증.
**BLOCKED 사유:** 일회성 운영 + 시간 압박. 단, 핵심 1건 (주문 → 입금신고 → 관리자 PAID → 사용자 status 갱신)은 시간 허용 시 시도.
**문서:** TEST_PLAN.md §6 E2E 14개 항목 상태 갱신.

## 3. 종료 조건

- 각 항목 수정 후 관련 테스트 통과.
- `npm test` 전체 통과.
- `npm run build` 성공.
- `docs/CODEX_REVIEW_FIX_SUMMARY.md`에 v3 섹션 추가 갱신.

## 4. 자동 수정 위험 — 사전 대비

- **P1-4 (경로 통일)**: 옛 `/admin/menu`를 북마크/QR 사용 중인 운영자 없음 (구현 완료 후 미배포 상태). 안전.
- **P1-5 (정산 UI)**: 페이지 ≤120줄 제약 — 도메인 분리 또는 컴포넌트 추출.
- **P1-1 (ZIP)**: CSV 컬럼 사양은 운영자 친화로. UTF-8 BOM 추가 (Excel 호환).
- **P1-6 (E2E)**: 운영 환경(Docker) 없이 webServer만 띄우는 한계 — BLOCKED 정당화.
