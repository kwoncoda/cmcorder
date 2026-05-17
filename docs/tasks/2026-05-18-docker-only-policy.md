# 2026-05-18 — ADR-033 docker 전용 검증·테스트·dev 정책 도입

브랜치: `front_closed_design`
ADR: `docs/DECISIONS.md` ADR-033
직접 계기: 2026-05-17 CLOSED 가드가 정적 자산을 가로채던 거대 회귀 (host vitest 1005/1005 통과 상태에서 prod에 들어감)

## 목표

호스트 `npm`과 prod 컨테이너 환경 분리가 일으킨 거대 회귀 (CLOSED 시 모든 사용자 정적 자산이 broken) 재발 차단. 검증·테스트·dev를 docker 환경에서만 실행하도록 인프라 + 정책 문서 일괄 도입.

## 만든 것

| 파일 | 종류 |
|------|------|
| `Dockerfile.dev` | dev/test 이미지 — devDeps 포함 |
| `docker-compose.dev.yml` | dev compose — volume mount + ports 5173/3000 + 백그라운드 유지 |
| `docs/tasks/2026-05-18-docker-only-policy.md` | 작업 로그 (본 문서) |

## 한 일

### 인프라
- **`Dockerfile.dev`** — `node:20-alpine` + `npm ci --include=dev` + `tail -f /dev/null` (백그라운드 유지). better-sqlite3 native build 위해 `python3 make g++ bash` 설치.
- **`docker-compose.dev.yml`** — `chickenedak-dev` 컨테이너. 호스트 코드 `.:/app` mount + `node_modules` 익명 volume (Windows 네이티브 빌드 회피) + `chickenedak-dev-data` named volume. 운영 compose와 volume/포트 완전 분리.

### 검증
```bash
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml exec -T dev npm test
# Test Files  94 passed (94)
# Tests       1009 passed (1009)
# Duration    201.11s  (호스트 60s 대비 3.4배 — Windows Docker Desktop volume mount overhead)
```

### 정책 문서 (4건)
- **`CLAUDE.md`**
  - "## 명령" 섹션을 docker 전용 명령으로 전면 교체. 운영 compose / dev compose 두 그룹으로 분리.
  - "## 규칙"에 ★ "호스트 npm 직접 실행 금지" 한 줄 추가.
  - "## 작업 절차" 3단계 → **4단계화** (4단계: 정적 자산/미들웨어/nginx 영향 시 운영 경로 사이드체크 `curl -sI http://localhost/<path>` 강제).
  - "## 절대 깨지면 안 되는 것"에 ADR-033 한 줄 추가.

- **`docs/TEST_PLAN.md`**
  - L234 ADR-020 원칙 줄 + L538 CI 섹션을 docker 명령 패턴으로 갱신.
  - GitHub Actions yml 예시도 `docker compose -f docker-compose.dev.yml exec -T dev` 형태로.

- **`docs/DECISIONS.md`**
  - 신규 ADR-033 추가 (컨텍스트/결정/대안/회귀 가드/문서 영향).
  - 변경 로그에 한 줄 추가.

- **`docs/operations/admin-card.md`**
  - 가동 절차에 "★ 정적 자산 사이드체크 (ADR-033)" 6번째 항목 추가. 운영 compose는 `docker-compose.yml`임을 명시 (dev compose와 혼동 방지).
  - 포트: `localhost:3000` → `localhost` (nginx :80 경유).

- **`docs/operations/d1-rehearsal.md`**
  - §2 SW 가동에 "2-A 정적 자산 사이드체크" 신규 (`curl -sI` 3건).
  - §10 최종 점검에 ADR-033 회귀 게이트 (docker dev 컨테이너에서 단위 1009 통과 확인) 추가.
  - 로그 stream 컨테이너 이름 `api` → `app` (실제 service 이름 정합).

### ADR 번호 충돌 회피
- 처음 027 → 029 → 032 순으로 시도했으나 모두 점유 (PII 폐기/react-hook-form/메뉴 CRUD/정산 보조/세션 쿠키/Rate limit).
- 최종 **ADR-033** 할당. 본문 + 변경 로그 + 5개 reference 파일(CLAUDE.md, Dockerfile.dev, docker-compose.dev.yml, TEST_PLAN.md, 작업 로그) 모두 정합.
- 원래 ADR-027 (PII 폐기) 본문은 replace_all 사고로 잠시 ADR-029로 바뀐 후 복원.

## 테스트 결과

| 명령 | 결과 |
|------|------|
| `docker compose -f docker-compose.dev.yml up -d --build` | 컨테이너 정상 빌드 + 기동 (1차 빌드 ~135s) |
| `docker compose -f docker-compose.dev.yml exec -T dev npm test` | **1009/1009 passed** (94 test files, 201s) |
| `grep "^## ADR-[0-9]" docs/DECISIONS.md \| sort -t'-' -k2 -n` | ADR-001 ~ ADR-033, 중복 없음 |
| 신규 ADR-033 본문 + 변경 로그 일치 | 확인 |

## 다음에 할 것

- (필수) 5/19 리허설 시 §2-A 정적 자산 사이드체크 + §10 회귀 게이트 실행 (정책 적용 1회차 검증).
- (선택) Playwright E2E를 docker 안에서 실행하려면 추가 셋업 필요할 수 있음 (chromium 의존 — `npx playwright install chromium` 컨테이너 안에서 1회 실행). 본 작업에서는 보류 — 이번 사고와 직접 관계 없음.
- (별건) D-day 운영 종료 후 ADR-027 PII 폐기 절차 (운영자 수동, D+7일).
