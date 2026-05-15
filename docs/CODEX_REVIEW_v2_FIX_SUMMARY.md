# Codex 리뷰 v2 — 수정 결과 요약

작성일: 2026-05-15
브랜치: `fix/codex-review-findings`
대상: `docs/codex리뷰결과_v2.md` 의 새 P0 2건 + 문서 충돌 6건
실행 방식: Superpowers subagent-driven + TDD (자동, 무승인)
이전: `docs/CODEX_REVIEW_FIX_SUMMARY.md` (v1)

## 0. 전체 결과

| 항목 | 결과 |
|---|---|
| 새 P0 (코드) | **2/2 완료** |
| 충돌 (문서/코드) | **6/6 완료** |
| BLOCKED | 0건 |
| `npm test` | **905/905 통과** (v1 종료 889 → +16 회귀) |
| `npm run build` | 성공 (gzip 89.89 kB) |
| `npm run test:e2e` | 2/2 통과 |
| 커밋 | 11건 (v1 12건 + v2 11건 = 누적 23건) |

## 1. 새 P0 — 코드 수정

### P0-A — Docker production secure cookie 분리
- **문제:** `secure: NODE_ENV==='production'` 단일 조건. Docker compose `NODE_ENV=production` + HTTP 로컬 → secure 쿠키가 HTTP에서 발송 안 됨 → admin 로그인 200이지만 세션 유실.
- **수정:**
  - `buildSessionOptions()` 별도 export — env 빌더.
  - `SESSION_COOKIE_SECURE === 'true'` 명시적 opt-in.
  - `docker-compose.yml`에 `SESSION_COOKIE_SECURE=false` 기본 + 주석으로 HTTPS proxy 시 변경 안내.
  - `docs/operations/admin-card.md`에 운영 가이드 추가.
- **회귀:** 3건 (production+미설정 → false / SESSION_COOKIE_SECURE=true → true / dev → false).
- **ADR:** 신규 ADR-031.
- **커밋:** `a202239`.

### P0-B — transfer-report access_token 인증
- **문제:** `POST /api/orders/:id/transfer-report` 무인증. ID 추측으로 타인 주문 입금정보 덮어쓰기 + TRANSFER_REPORTED 강제 전이.
- **수정:**
  - 서버: GET와 동일 패턴 적용. `?token=` 검증 (401 → 404 → 403 → 400 순).
  - 클라: `TransferPage`가 `withQuery(API.ORDER_TRANSFER_REPORT(id))`로 자동 부착.
- **회귀:** 4건 신규 (token 없음/잘못된 token/타인 token + 상태 변경 X 확인/존재 X) + 1건 갱신 (admin transfers).
- **커밋:** `eccd217`.

## 2. 문서 충돌 — 통합

### 충돌-1 — SSE → 5초 폴링
- **기준 ADR:** ADR-015 변경 (2026-05-15).
- **수정:**
  - `docs/API_DRAFT.md` §0.3 BUSINESS_CLOSED, §1.9 SSE → 폴링, §4 채널 명세, §5 rate limit, §6 변경 이력.
  - `docs/TEST_PLAN.md` §7 SSE 통합 → `useOrderPolling` 테스트.
  - 본문 광범위 잔존(PRD/USER_FLOW/MVP_SCOPE/IMPLEMENTATION_PLAN/ARCHITECTURE)은 상단 박스로 일괄 흡수.
- **커밋:** `da47f8d`.

### 충돌-2 — PII 자동 → 수동 폐기
- **기준 ADR:** ADR-027 신규 (2026-05-15, v1 작업).
- **수정:**
  - `docs/FEATURE_LIST.md:271` F-I-006 cron 취소.
  - `docs/PRD.md` 5건 (§5.2/§9/§6/§11) 갱신.
  - `docs/MVP_SCOPE.md` PII 자동 → 수동.
  - `docs/USER_FLOW.md` 다이어그램 갱신.
  - `docs/DB_DRAFT.md` §1, §6 보존 정책, §8 자동화 결정.
  - `docs/ARCHITECTURE.md` §11 폐기 정책.
- **커밋:** `5a60d34`.

### 충돌-3 — CLOSED 사용자 GET 서버 middleware redirect ★ 코드 수정
- **기준:** `docs/API_DRAFT.md` §1.12 + FEATURE_LIST F-S-015 (예시 코드 명시).
- **수정:**
  - `server/middleware/business-state.js`:
    - CLOSED + 사용자 GET → 302 redirect `/closed`.
    - 예외 통과: `/closed`, `/healthz`, `/api/business-state`, `/assets/*`, `/favicon.ico`, `/robots.txt`.
  - SPA layout(P0-5) 가드는 유지 → 서버+SPA 이중 방어.
- **회귀:** 6건 신규 + 1건 갱신 (customer.test의 "CLOSED GET 통과" → 302 redirect 기대로 명세 정렬).
- **커밋:** `541471c`.

### 충돌-4 — react-hook-form 잔존 갱신
- **기준 ADR:** ADR-028 신규 (2026-05-15, v1 작업).
- **수정:** `docs/IMPLEMENTATION_PLAN.md` 5곳 (Task 1.2 / 2.7 / 4.4 / 4.6 / D.2)을 controlled inputs + ADR-028 참조로 갱신.
- **커밋:** `306cf63`.

### 충돌-5 — 메뉴 CRUD 명세 축소
- **신규 ADR:** ADR-029.
- **결정:** 가격 + 품절/추천 토글만. 이름/분류/이미지/생성/삭제는 시드 단계 SoT 확정.
- **수정:**
  - `docs/DECISIONS.md` ADR-029 신규.
  - `docs/FEATURE_LIST.md:184` F-A-024 축소 표기.
  - `docs/SCREEN_STRUCTURE.md` §3.10 다이어그램에서 "[+ 새 메뉴 추가]" / 편집 / 삭제 컬럼 제거.
- **사유:** 일회성 G14 + 8개 고정 + 운영 1시간 정산 목표.
- **커밋:** `f6dd035`.

### 충돌-6 — 정산 그래프/ZIP 이력 Phase 2 강등
- **신규 ADR:** ADR-030.
- **결정:** F-A-032 (메뉴별/시간대별 그래프) + F-A-035 (ZIP 이력) → P0 → P2 강등.
- **사유:** ZIP `summary.json` + `settlement.sql`로 사후 Excel/SQLite 분석 가능. 운영자 1명이라 본인 다운로드 직접 추적 가능.
- **수정:** ADR-030 신규 + FEATURE_LIST 라인 2개 강등.
- **커밋:** `90900ff`.

### 통합 박스 — 9개 핵심 문서 상단
- **추가:** `docs/PRD.md`, `docs/USER_FLOW.md`, `docs/API_DRAFT.md`, `docs/TEST_PLAN.md`, `docs/MVP_SCOPE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ARCHITECTURE.md`, `docs/FEATURE_LIST.md`, `docs/DB_DRAFT.md` 상단에 "최신 결정 우선 안내" 박스.
- **내용:** ADR-015/027/028/029/030/031 변경 + 충돌-3 서버 redirect 명시 → 본문이 옛 표기여도 ADR 우선 룰로 해석.
- **사유:** historical context 보존 + 일관성 보장 + 작업 비용 절감.
- **커밋:** `e3431b7`.

## 3. 신규/변경 ADR 매트릭스 (v1 + v2)

| ADR | 상태 | 결정 |
|---|---|---|
| ADR-015 (조리 현황판) | 변경 (2026-05-15) | SSE → 5초 폴링 fallback |
| ADR-024 (프론트 스택) | 변경 (2026-05-14) | EJS+Alpine → React 18 SPA |
| ADR-027 (PII 폐기) | 신규 (2026-05-15) | 자동 cron → 운영자 D+7일 수동 |
| ADR-028 (폼) | 신규 (2026-05-15) | react-hook-form 미채택 |
| ADR-029 (메뉴 CRUD) | 신규 (2026-05-15) | 가격+토글로 축소 |
| ADR-030 (정산 보조) | 신규 (2026-05-15) | 그래프/ZIP 이력 P2 강등 |
| ADR-031 (세션 쿠키) | 신규 (2026-05-15) | SESSION_COOKIE_SECURE env 분리 |

## 4. 회귀 매트릭스

| 영역 | v2 시작 | v2 종료 | Δ |
|---|---|---|---|
| 단위·통합 | 889 | **905** | +16 (P0-A 3 + P0-B 4 + 충돌-3 신규 6 + 갱신 등) |
| E2E | 2 | 2 | 변동 X |
| build | OK | OK (89.89 kB gzip) | +0.01 kB |

## 5. 운영 시점 액션

D-day 5/20 운영 전:
1. **이미지 재빌드** — `docker compose build --no-cache && docker compose up -d`.
2. **세션 쿠키** — `docker-compose.yml`의 `SESSION_COOKIE_SECURE=false` 확인 (HTTP 로컬 운영). HTTPS proxy 도입 시 `true` + `app.set('trust proxy', 1)` 추가.
3. **PIN 보관** — 첫 부팅 stdout에 출력되는 6자리 PIN.
4. **CLOSED 가동 확인** — 컨테이너 가동 직후 `/admin/login` 접근, "장사 시작" 클릭.
5. **사용자 진입 테스트** — CLOSED 상태에서 `http://<IP>:3000/menu` 진입 → `/closed` redirect 정상 동작 확인.

D-day +7일 (5/28까지):
- `docs/operations/pii-deletion.md` 절차로 PII 폐기 (ADR-027).

## 6. 본 작업으로 다루지 않은 항목

- **HTTPS 종단** — 부스 와이파이 환경에서 운영. reverse proxy 도입은 운영자 결정.
- **세션 SESSION_SECRET** — dev fallback 경고. 운영 시 `.env` 또는 docker `environment`에 명시.
- **rate limit** — `docs/API_DRAFT.md:639-644` 명세. P2 잔존. 일회성 부스에 도입 비용 ≫ 가치.
- **인기 TOP3 판매 수** — recommended flag 기반 정적 표시. ADR-017로 이미 정적 결정. v2 P2 잔존.
- **E2E 14개 시나리오** — smoke 1개 통과로 D-day 가능. 추가 시나리오는 Phase 2 가정상 X.

## 7. v2 커밋 로그 (브랜치 `fix/codex-review-findings`)

```
e3431b7 docs(v2 통합): 9개 핵심 문서 상단에 "최신 결정 우선" 안내 박스 추가
90900ff docs(충돌-6 v2): 정산 그래프/ZIP 이력 Phase 2 강등 — ADR-030
f6dd035 docs(충돌-5 v2): 메뉴 CRUD 명세 축소 — ADR-029 신규
306cf63 docs(충돌-4 v2): IMPLEMENTATION_PLAN react-hook-form 잔존 갱신 (ADR-028)
5a60d34 docs(충돌-2 v2): PII 자동 삭제 → 수동 폐기 본문 정합 (ADR-027 기준)
da47f8d docs(충돌-1 v2): SSE → 폴링 핵심 본문 정리 (ADR-015 변경 정합)
541471c fix(충돌-3 v2): CLOSED 사용자 GET 서버 middleware redirect 추가
eccd217 fix(P0-B v2): transfer-report access_token 인증
a202239 fix(P0-A v2): Docker production secure cookie env 분리
(+ v1 12건)
```

## 8. 최종 판단

v2 리뷰가 지적한 새 P0 2건 + 문서 충돌 6건 모두 해결.
- **코드 보안**: secure cookie + transfer-report 인증 + CLOSED GET 서버 redirect.
- **문서 정합**: ADR 6개 (ADR-015 변경 + 신규 5개) + 9개 문서 상단 안내 박스.

**D-day 5/20 가동 가능. v3 리뷰 또는 운영 후 회고로 진행.**
