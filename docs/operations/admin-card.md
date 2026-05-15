# 본부 운영 카드 — 2026-05-20 (수) · 5/21 (목)

> 인쇄해서 운영진이 부스 노트북 옆에 두는 한 장짜리 가이드.

## 가동 (5/20 16:30 / 5/21 11:00 전)

1. 부스 노트북에서 `cd C:\ACoding\09_order && docker compose up -d`
2. 첫 부팅 시 컨테이너 로그에 `[INIT] Generated admin PIN: XXXXXX` 출력 → **메모**
   - `docker compose logs -f api | head -20` 으로 확인
3. 노트북 브라우저: `http://localhost:3000/admin/login` 접속 → PIN 6자리 입력
4. 영업 상태 빨간 CLOSED 배지 확인 → "장사 시작" 큰 노란 버튼 클릭 → 녹색 OPEN
5. 모바일 폰에서 `http://<노트북IP>:3000/menu` 진입 → 메뉴 정상 표시 확인

> **세션 쿠키 (P0-A, ADR-031 2026-05-15):** `docker-compose.yml`은 `SESSION_COOKIE_SECURE=false` 기본. HTTP 로컬 운영 호환. **HTTPS reverse proxy 도입 시 `SESSION_COOKIE_SECURE=true`로 변경 + Express `trust proxy` 설정 필요.** 부스 로컬 와이파이는 HTTP가 정상 경로.

> **자동 백업 (P1-2 Codex v3, 2026-05-15):** `BACKUP_DIR=/data/backups` 환경변수가 `chickenedak-data` named volume 안쪽으로 강제. 컨테이너 재생성·이미지 재빌드·`docker compose down` 후에도 ZIP 6개 회전 보존. `docker compose exec chickenedak ls /data/backups`로 확인 가능. PII 폐기 시 (`docs/operations/pii-deletion.md`) volume 삭제 전에 ZIP을 학생회 클라우드로 옮길 것.

## 운영 중 (한 화면)

대시보드는 6 컬럼 칸반(Kanban) 형태로 표시.

- **이체확인요청** 컬럼: 학생이 이체 신고 → 카드 클릭 → 입금 일치 확인 → "이체 확인" (체크)
- 다른 이름 이체 / 금액 불일치 → "보류" → 학생에게 직접 안내
- "조리 시작" → COOKING (주방에 알림) → 완료 시 "조리 완료" → 호명 단계
- "전달 완료" → DONE 처리

## 단축키 (관리자 대시보드)

- `Enter` : 카드 선택
- `Esc` : 모달 닫기
- `Tab` : 포커스 이동 (브라우저 기본)
- `?` : 이 단축키 안내 열기/닫기

## 정산 마감 (각 일자 종료 시)

1. 좌측 사이드 카운터에서 **진행 중 주문 0건** 확인 (ADR-012 — 강제 마감 X)
2. `/admin/settlement` 진입 → 요약 (총 N건, 총 ₩X) 확인
3. "오늘 정산 마감" 큰 빨간 버튼 클릭
4. **자동 동작**: 사용자 측 화면이 "영업 외" 화면으로 전환됨
5. ZIP 다운로드 → USB 백업 (선택)

## 비상 시

| 증상 | 대응 |
| --- | --- |
| DB 손상 | `docker compose logs` 확인 → `backups/` 디렉터리 최신 ZIP 복원 |
| 사용자 측 응답 X | 노트북 + 라우터 양쪽 재부팅 |
| PIN 분실 | docker volume `chickenedak-data` 안 `order.sqlite` 백업 → `admins` 테이블 행 삭제 → 컨테이너 재부팅 시 새 PIN 생성 |
| SSE 연결 끊김 | 사용자 측: 자동 재연결 / 안 되면 새로고침 |

## 외부인 (학번 없음) 흐름

- 학생이 "학번 없음" 체크 → 이름만 입력 → 완료 화면에 token 포함 URL 표시
- 외부인은 그 URL을 새 시크릿 탭에서 열어 상태 추적 가능 (학번 기반 자동 권한 없음)

## D-day + 7일 — PII 폐기 (ADR-027 / 2026-05-28까지)

운영 종료 후 7일 이내 *반드시*:
1. `/admin/settlement` → "📦 ZIP 다운로드" → 학생회 클라우드(학과 폴더)에 업로드.
2. `docs/operations/pii-deletion.md` 절차로 DB PII 폐기.
3. docker volume `chickenedak-data` 삭제.

**미수행 시 GDPR/개인정보보호법 위반 소지** — 학번·이름·이체 정보의 불필요한 장기 보유 금지.
