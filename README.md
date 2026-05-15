# 오늘 저녁은 치킨이닭!

학교 축제 부스용 모바일 웹 주문 시스템. 컴퓨터모바일융합과 학생회.
D-day: 2026-05-20 (수) ~ 5/21 (목), 매일 16:30 오픈.

**WINNER WINNER CHICKEN DINNER!**

## 핵심 문서

- 작업 규칙 — [`CLAUDE.md`](./CLAUDE.md)
- 7차 기획서 — [`docs/order-system-plan.md`](./docs/order-system-plan.md)
- 구현 진입점 — [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md)
- 결정 이력 — [`docs/DECISIONS.md`](./docs/DECISIONS.md) (ADR 1~27)
- 디자인 시스템 — [`docs/DESIGN.md`](./docs/DESIGN.md)
- 화면 구조 — [`docs/SCREEN_STRUCTURE.md`](./docs/SCREEN_STRUCTURE.md)
- 운영 카드 ★ — [`docs/operations/admin-card.md`](./docs/operations/admin-card.md)
- 리허설 체크리스트 ★ — [`docs/operations/d1-rehearsal.md`](./docs/operations/d1-rehearsal.md)

## 기술 스택

- 프론트엔드: **React 18 SPA** + Vite + Tailwind + Zustand + React Router 6
- 백엔드: Node 20 + Express 4 + better-sqlite3 (WAL)
- 실시간: 5초 폴링 fallback (ADR-015 변경, SSE는 Phase 2)
- 배포: Docker compose + named volume `chickenedak-data` (ADR-023)
- 테스트: Vitest (단위 ~890 케이스) + Playwright (E2E smoke)

> ADR-024 변경 (2026-05-14): 초기 EJS+Alpine 후보는 폐기. 현재는 React SPA가 정답.

## 현재 상태

구현 완료 (2026-05-14). D-1 리허설 5/19 → D-day 5/20 16:30 운영 시작.
이후 작업은 *수정·패치·운영 가이드 보강* 단계.

- 8 Phase · 52 Task 모두 완료 (`docs/IMPLEMENTATION_PROGRESS.md`)
- Codex 리뷰 P0/P1/P2 자동 수정 완료 (2026-05-15, `docs/CODEX_REVIEW_FIX_SUMMARY.md`)

## 명령

```bash
npm install            # 의존성 설치
npm run dev            # 프론트엔드 dev (Vite 5173)
npm run server         # 백엔드 (Express 3000, /healthz)
npm run server:watch   # 백엔드 자동 재시작
npm test               # 단위·통합 (Vitest, 890+ 케이스)
npm run test:e2e       # Playwright E2E smoke
npm run build          # 프론트엔드 production 빌드 (dist/)

# 운영 (Docker)
docker compose up -d   # 컨테이너 가동 — 3000번 포트 (SPA + API 통합 서빙)
docker compose logs -f # 로그 (첫 부팅 시 PIN stdout 출력)
docker compose restart # 재시작
```

자세한 내용은 `docs/` 참조.
