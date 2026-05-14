# Codex 리뷰 v2 수정 계획 — P0 2건 + 문서 충돌 통합

작성일: 2026-05-15 (v2 재리뷰 기반)
대상: `docs/codex리뷰결과_v2.md` 의 새 P0 2건 + 문서 충돌 6항목
실행 모드: Superpowers subagent-driven-development + TDD (자동, 무승인)
이전 v1 계획: `docs/CODEX_REVIEW_FIX_PLAN.md` (기존 — 본 문서가 덮어씀, git history로 보존)

## 0. 진행 원칙 (v1과 동일)

1. 항목마다 **실제 코드/문서 기준 재검증**.
2. production code 수정 전 **실패 테스트 먼저** (TDD).
3. 보안·정합성·가격·권한은 **서버 기준 재계산/검증**.
4. 단순 우회·테스트 삭제·기능 제거 금지.
5. 항목 단위 1 커밋 (한국어 메시지).
6. 자동 위험 시 BLOCKED로 기록 후 다음으로 진행.
7. 전체 종료 후 `npm test` + `npm run build` 통과 + summary 작성.

## 1. 검증 — 코드/문서 ↔ v2 리뷰 매칭

| v2 항목 | 검증 | 결론 |
|---|---|---|
| 새 P0-A: Docker production secure cookie | `server/middleware/admin-auth.js:32` `secure: NODE_ENV==='production'` + `docker-compose.yml` `NODE_ENV=production` + `admin-card.md`가 HTTP 로컬 안내 → secure 쿠키가 HTTP에서 전송 안 됨 | **버그 확정** |
| 새 P0-B: transfer-report 인증 누락 | `server/routes/customer.js:152-168` `?token=` 미검증. ID만으로 입금정보 덮어쓰기 가능 | **버그 확정** |
| 충돌-1: SSE vs 폴링 | 6+ 문서가 SSE 잔존, 코드는 폴링 — ADR-015 (2026-05-15) 변경이 최신 | **문서 갱신** (ADR-015 기준) |
| 충돌-2: PII 자동 vs 수동 | 6+ 문서가 자동 잔존, 코드/ADR-027(2026-05-15)는 수동 | **문서 갱신** (ADR-027 기준) |
| 충돌-3: CLOSED GET — 서버 vs SPA | API_DRAFT/FEATURE_LIST는 서버 middleware 명세, 코드는 SPA만 — Codex v2 P1 지적 | **서버 middleware 추가** + SPA 유지 (이중 가드) |
| 충돌-4: react-hook-form | IMPLEMENTATION_PLAN 5곳 잔존, ADR-028(2026-05-15) 미반영 | **문서 갱신** (ADR-028 기준) |
| 충돌-5: 메뉴 CRUD 범위 | F-A-024 전체 CRUD 요구, 코드는 가격+토글만 — 일회성 8개 고정 메뉴 | **명세 축소 + ADR-029** |
| 충돌-6: 정산 그래프/ZIP 이력 | F-A-032/035 P0 요구, 코드 미구현 — ZIP의 summary.json 사후 분석 가능 | **명세 축소 + ADR-030** |

## 2. P0 — 코드 수정

### P0-A. Docker production secure cookie

**근본 원인:**
- `secure: process.env.NODE_ENV === 'production'` 단일 조건은 *전송 프로토콜*과 *환경 라벨*을 혼동.
- Docker compose가 `NODE_ENV=production` + HTTP 로컬 운영 → secure 쿠키가 HTTP에서 발송 X.

**파일:**
- 수정: `server/middleware/admin-auth.js`
- 수정: `docker-compose.yml` (`SESSION_COOKIE_SECURE` env 명시)
- 신규 테스트: `server/middleware/__tests__/admin-auth.test.js` (P0-A 케이스 추가)

**TDD:**
1. 실패 테스트: `NODE_ENV=production` + `SESSION_COOKIE_SECURE` 미설정 시 cookie `secure` flag *없음* (HTTP 호환).
2. 실패 테스트: `SESSION_COOKIE_SECURE=true` 시 cookie `secure` flag *있음*.
3. 수정: `secure: process.env.SESSION_COOKIE_SECURE === 'true'` (명시적 opt-in).
4. docker-compose.yml `environment`에 `SESSION_COOKIE_SECURE=false` 기본 명시 + 주석으로 HTTPS proxy 시 `true` 설정 안내.
5. admin-card.md 운영 가이드에 환경변수 안내 추가.

**결정 근거:** 보안 fail-secure를 *플랫폼 기본*으로 두지 않고 *운영자 명시 설정*으로 옮김. HTTP 로컬 운영이 명확한 일회성 부스이므로 이중 안전: SESSION_SECRET fallback 경고 + secure 명시.

### P0-B. transfer-report access_token 인증

**근본 원인:**
- P0-4에서 `GET /api/orders/:id`만 token 검증 추가, mutation `POST /api/orders/:id/transfer-report`는 무인증 잔존.
- ID 추측으로 타인 주문 입금정보 덮어쓰기 가능 → `TRANSFER_REPORTED`로 강제 전이.

**파일:**
- 수정: `server/routes/customer.js` (POST transfer-report에 token 검증)
- 수정: `src/pages/customer/TransferPage.jsx` (token query 부착)
- 신규 테스트: `server/routes/__tests__/customer.test.js` (token 없음/잘못된 token/타인 token)

**TDD:**
1. 실패 테스트: token 없이 POST → 401.
2. 실패 테스트: 잘못된 token → 403.
3. 실패 테스트: 타인 token → 403.
4. 수정: GET와 동일 패턴 — `?token=` 검증 후 access_token 비교, 미일치 시 401/403.
5. 클라: TransferPage가 `useOrderToken.withQuery(API.ORDER_TRANSFER_REPORT(id))`로 자동 부착.

## 3. 문서 충돌 통합

### 충돌-1: SSE → 폴링

**갱신 대상:**
- `docs/ARCHITECTURE.md` §4.3 + 다이어그램 (line 27/116/141/156/260/271/282-310/683/876/889/897/908): SSE 표기를 "5초 폴링 (ADR-015 변경)"로
- `docs/PRD.md`: SSE 잔존 위치 폴링으로
- `docs/USER_FLOW.md`: SSE 언급 → 폴링
- `docs/API_DRAFT.md`: §1.x SSE 엔드포인트 → 폴링 fallback 명시 + 0.3 SSE 423 항목 갱신
- `docs/TEST_PLAN.md`: E2E SSE 시나리오 → 폴링
- `docs/MVP_SCOPE.md`: SSE → 폴링
- `docs/FEATURE_LIST.md:347,350`: F-U-031/F-A-016 의존 라인 갱신
- `docs/IMPLEMENTATION_PLAN.md`: SSE/EventSource 잔존 라인 갱신
- 코드: `src/hooks/useOrderStream.js` 미사용 — `// @deprecated ADR-015 변경` 헤더만 추가 (삭제하면 P1-4 회귀 위험 적지만 보수적으로 보존)

**기준 ADR:** ADR-015 (2026-05-15 변경).

### 충돌-2: PII 자동 → 수동

**갱신 대상:**
- `docs/PRD.md:217,284,304,453`: "정산 후 N일 자동 삭제" → "정산 후 7일 내 운영자 수동 폐기 (ADR-027)"
- `docs/MVP_SCOPE.md:90`: 동일
- `docs/FEATURE_LIST.md:271`: F-I-006 cron → 수동 절차 (ADR-027 참조)
- `docs/USER_FLOW.md:419`: "PII 자동 삭제" → 운영자 수동 폐기
- `docs/DB_DRAFT.md:4,726,738,819`: "자동 삭제 정책" → "수동 폐기 절차"
- `docs/ARCHITECTURE.md:938`: PII 자동 삭제 → 수동

**기준 ADR:** ADR-027 (2026-05-15 신규).

### 충돌-3: CLOSED GET 서버 middleware

**근본 원인:** API_DRAFT.md §1.12 예시 코드가 `if (state.status === 'CLOSED') { if (req.method === 'GET') return res.redirect(302, '/closed'); }` 명세. 현재 `business-state.js`는 GET 통과.

**파일:**
- 수정: `server/middleware/business-state.js`
- 수정: `server/middleware/__tests__/business-state.test.js`
- 수정: `server/routes/__tests__/customer.test.js` (CLOSED + GET /api/menus 통과 → 302 redirect로 변경)

**TDD:**
1. 실패 테스트: CLOSED + GET `/menu` (SPA 경로) → 302 redirect `/closed`.
2. 실패 테스트: CLOSED + GET `/api/business-state` → 200 (사용자가 영업 상태 알아야 함 — 예외).
3. 실패 테스트: CLOSED + GET `/api/menus` → 302 (조회도 차단).
4. 실패 테스트: CLOSED + GET `/closed` → 200 (자기 자신 무한 루프 X).
5. 실패 테스트: CLOSED + GET 정적 자산 (`/assets/...`, `/favicon.ico`) → 200 (SPA 자산 로드 필요).
6. 수정: middleware에 GET 분기. CLOSED 시 사용자 GET → 302. 예외: `/api/business-state`, `/closed`, `/healthz`, `/admin/*`, `/assets/*`, 정적 파일.
7. 기존 테스트 "CLOSED — GET 요청은 통과" 케이스를 갱신 (명세 정렬 — 기능 제거 X).
8. SPA 가드(P0-5)는 유지 — JS 비활성 환경에서 서버 redirect, JS 동작 환경에서 SPA 가드 = 이중 방어.

### 충돌-4: react-hook-form 문서

**갱신 대상:**
- `docs/IMPLEMENTATION_PLAN.md:307` REFACTOR react-hook-form 라인 → "controlled inputs (ADR-028)"
- `:423` "react-hook-form watch" → "useState"
- `:601` "GREEN: react-hook-form + zod" → "controlled + 정규식 검증"
- `:636` "react-hook-form + zod 명시" → "controlled + Task 4.4 패턴"
- `:989` "react-hook-form + zod" → "zod (서버 검증 + 클라 정규식)"
- `docs/tasks/2026-05-14-task-1.2-form-atoms.md`, `2026-05-14-task-2.7-transfer-admin-card.md`: 본문 끝에 "ADR-028 (2026-05-15) — react-hook-form 미채택 확정" 후기 추가 (tasks는 history라 본문 수정 X, 후기 추가)
- `docs/tasks/2026-05-14-implementation-plan-react.md:24`: 동일 라인 갱신

### 충돌-5: 메뉴 CRUD 명세 축소

**신규:** ADR-029 — 메뉴 CRUD 축소

**갱신:**
- `docs/FEATURE_LIST.md:184`: F-A-024를 "메뉴 가격 + 품절/추천 토글 (ADR-029 변경, 2026-05-15)"
- `docs/SCREEN_STRUCTURE.md:380` "[+ 새 메뉴 추가]" → "[가격 편집/품절 토글/추천 토글]"
- `docs/PRD.md`: 메뉴 8개 고정 운영 명시 (이미 G14 일회성)

**사유:** 일회성 2일 · 8개 고정 메뉴 · 운영자 1명. 이름/분류/이미지/생성/삭제는 시드 단계에서 SoT(`src/constants/menus.js` + `init.sql`)로 충분.

### 충돌-6: 정산 그래프/ZIP 이력 축소

**신규:** ADR-030 — 정산 보조 P2 강등

**갱신:**
- `docs/FEATURE_LIST.md:197` F-A-032 메뉴별/시간대별 그래프 → **P2 강등** (ZIP `summary.json` 사후 분석)
- `docs/FEATURE_LIST.md:200` F-A-035 ZIP 다운로드 이력 → **P2 강등** (운영자 1명이라 외부 추적 가능)
- `docs/PRD.md:163`: "메뉴별 판매 ZIP" 표현 유지하되 그래프 UI 없음 명시

**사유:** ZIP에 `serializeDb` 전체 덤프 + `summary.json` 포함. 정산 후 Excel/SQLite 직접 열람으로 메뉴별/시간대별 분석 가능. 운영 중 그래프 UI 비용 ≫ 가치.

## 4. 종료 조건

- 각 항목 수정 후 관련 테스트 통과.
- `npm test` 전체 통과 (시작 889/889 → 종료 +N 회귀).
- `npm run build` 성공.
- `docs/CODEX_REVIEW_v2_FIX_SUMMARY.md` 작성.

## 5. BLOCKED 기준

- API 계약 변경이 운영 중 주문 흐름을 *현재* 깨는 경우 (D-day 5일 전).
- 사용자 결정이 필요한 정책 (현재로선 없음 — 충돌 6건 방향성은 위에 명시).
