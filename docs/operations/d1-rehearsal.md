# D-1 리허설 (5/19 화요일)

> 5/20 D-day 16:30 운영 시작 전, 노트북·라우터·QR·시나리오 전체를 시뮬레이션한다.
> 항목별 체크박스를 따라가며 빠진 부분이 없는지 확인.

## 1. 환경 준비

- [ ] 부스 노트북 (Windows 권장) + 충전기
- [ ] 라우터/공유기 + 백업 라우터 1대
- [ ] QR 코드 3매 인쇄 (입구·테이블·홀)
- [ ] USB (백업용, 2GB 이상)
- [ ] 인쇄 운영 카드 (`docs/operations/admin-card.md`)
- [ ] 마스코트 이미지 5장 — D-3 수령 (미수령 시 이모지 fallback 자동)
- [ ] PUBG 일러스트 8장 — D-3 수령 (미수령 시 분류 이모지 fallback)

## 2. SW 가동 (★ 운영 compose — ADR-033 dev/test compose 와 별개)

```bash
cd C:\ACoding\09_order
docker compose down       # 기존 컨테이너 정리
docker compose up -d --build
docker compose logs -f app | head -50
```

- [ ] `[INIT] Generated admin PIN: XXXXXX` 메모
- [ ] `[server] 치킨이닭 백엔드 가동 — http://localhost:3000` 확인 (내부망 expose)
- [ ] `curl http://localhost/healthz` → `{"ok":true}` (nginx :80 경유 → app:3000 프록시)

### 2-A. ★ 정적 자산 사이드체크 (ADR-033 사고 재발 방지)

CLOSED 가드가 정적 자산을 가로채던 회귀(2026-05-17)가 재발하지 않도록 가동 직후 *반드시* 확인:

```bash
curl -sI http://localhost/web-logo.png       # HTTP/1.1 200 OK + Content-Type: image/png
curl -sI http://localhost/mascot/mascot.png  # 동일
curl -sI http://localhost/items/adrenaline.webp  # 동일 (200 + image/webp)
```

- [ ] 세 응답 모두 `200 OK` + `Content-Type: image/*` 기대. 302/423/text/html 응답 시 → CLOSED 가드 정적 자산 화이트리스트(`server/middleware/business-state.js` `STATIC_ASSET_EXT`) 누락. ADR-033 §6 회귀 테스트(`business-state.test.js`)도 통과인지 같이 확인.

## 3. 어드민 진입

- [ ] `http://localhost/admin/login` PIN 입력 → `/admin/dashboard`
- [ ] 빨간 CLOSED 배지 확인
- [ ] "장사 시작" 클릭 → 녹색 OPEN 배지 전환

## 4. 학생 주문 시나리오 (모바일)

- [ ] `http://<노트북IP>/menu` 진입 (모바일 폰, 같은 Wi-Fi — nginx :80)
- [ ] 메뉴 카테고리 탭 동작 확인
- [ ] 메뉴 "줍기" → `/cart` → `/checkout`
- [ ] 학번 `20263701` + 이름 입력 → `/orders/:id/complete` (도그태그 떨어지는 모션)
- [ ] 계좌번호 복사 클릭 → "복사됨" 또는 manual hint 표시
- [ ] `/orders/:id/transfer` 진입 → 은행 + 입금자 + 금액 → 제출 → `/orders/:id/status`

## 5. 본부 처리

- [ ] 새 주문이 "이체확인요청" 컬럼에 카드로 표시
- [ ] 카드 클릭 → `/admin/orders/:id` → "이체 확인" → PAID 전이
- [ ] 사용자 측 status 화면 SSE 자동 갱신 확인 (모바일)
- [ ] "조리 시작" → COOKING (학생 폰 자동 갱신)
- [ ] "조리 완료" → READY (학생 폰 진동·깜박)
- [ ] "전달 완료" → DONE

## 6. 외부인 시나리오

- [ ] "학번 없음" 체크 + 이름만 입력 → `/orders/:id/complete` → token URL
- [ ] 새 시크릿 탭에서 status URL 진입 → token으로 SSE 연결 가능

## 7. 정산 마감 (1일 종료 시뮬)

- [ ] `/admin/settlement` 진입 → 요약 (총 N건, 총 ₩X)
- [ ] 진행 중 주문 0건 확인 (ADR-012 가드 동작)
- [ ] "오늘 정산 마감" → 자동 CLOSED + 사용자 측 `/closed` redirect (200ms fade)
- [ ] ZIP 다운로드 → USB 저장

## 8. 5/21 시뮬레이션

- [ ] business_state operating_date 갱신 (운영자 별도 SQL 또는 자동)
- [ ] "장사 시작" 다시 클릭 → 녹색 OPEN
- [ ] 5/20 데이터와 격리 확인 (operating_date 분리)

## 9. 비상 시나리오

- [ ] 노트북 절전 → 복구 시 SSE 자동 재연결
- [ ] 라우터 재부팅 → 사용자 측 "연결 끊김" 표시 후 자동 복구
- [ ] PIN 분실 시 — admins 테이블 행 삭제 후 재부팅 (admin-card.md 비상 절차)

## 10. 최종 점검

- [ ] 백엔드 로그 노이즈 점검 (에러 / 경고 0)
- [ ] axe-core 위반 0 (모든 페이지 진입 후 dev 콘솔)
- [ ] 단축키 4종 (`Enter`, `Esc`, `Tab`, `?`) 작동
- [ ] reduced motion 시뮬 (OS 설정 `prefers-reduced-motion: reduce`) — 도그태그·펄스 정적 확인
- [ ] ★ ADR-033 회귀 게이트 — dev 컨테이너에서 단위·통합 전체 통과:
  ```bash
  docker compose -f docker-compose.dev.yml up -d
  docker compose -f docker-compose.dev.yml exec dev npm test
  # Tests  1009 passed (1009) 기대
  ```

---

**리허설 완료 후**: `docker compose down` → 데이터 ZIP 백업 → 5/20 당일 새로 부팅.
