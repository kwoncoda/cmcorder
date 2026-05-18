# 2026-05-18 — PUBG 이미지 교체 + 개인정보 수집 안내 문구

## 목표

사용자 웹의 PUBG 컨셉 일관성 강화 (이모지 → 실제 PUBG 그래픽 자산) + 주문 정보 입력 시 개인정보 수집 고지 표시.

D-day(2026-05-20) 2일 전 운영 시각 다듬기.

## 만든 것

### 신규 자산
- `public/pubg-map.png` — PUBG 맵 그래픽 (1.77MB)
- `public/pubg-inventory.webp` — PUBG 인벤토리(가방) 그래픽 (32KB)

원본 파일(프로젝트 루트의 한글명 `배그 맵 이미지.png`, `배그 인벤토리(가방) 이미지.webp`)을 `public/` 으로 이동·영문 케밥케이스 리네이밍 (Vite/Express URL 인코딩 이슈 회피 + 기존 `first-aid.webp` 등 컨벤션 일치).

### 수정 컴포넌트 (5 위치)
| 파일 | 위치 | 변경 |
| --- | --- | --- |
| `src/components/layouts/CustomerLayout.jsx` | L94 | 헤더 🗺️ → `<img src="/pubg-map.png" />` (28×28) |
| `src/components/layouts/CustomerLayout.jsx` | L102 | 헤더 🎒 → `<img src="/pubg-inventory.webp" />` (28×28) |
| `src/components/organisms/StickyCartBar.jsx` | L35 | sticky bar 🎒 → `<img>` (22×22, inline) + "인벤토리 N개 · …" 텍스트 |
| `src/components/organisms/BoothMinimapModal.jsx` | L76 | 모달 제목 🗺️ → `<img>` (22×22, inline) + "부스 약도" |
| `src/pages/customer/CartPage.jsx` | L41 | 카트 페이지 h1 🎒 → `<img>` (24×24, inline) + "인벤토리 (N개)" |

- `alt=""` (장식 이미지) — 각 위치에 `aria-label` 또는 옆 텍스트가 의미를 전달함. 스크린리더 중복 읽기 방지.
- 인라인 위치는 `verticalAlign:'middle'` + `marginRight:6` 으로 베이스라인 정렬.

### 신규 문구
- `src/pages/customer/CheckoutPage.jsx` L79 직후: 이름 입력 필드 아래 검정색 12px `<p>` 로 "주문 확인을 위한 개인정보 수집입니다" 안내. 학번 없음(외부인) 분기와 무관하게 항상 표시.

## 한 일

1. **이미지 이동·리네이밍** (`mv`): 프로젝트 루트의 한글 파일 2종을 `public/` 으로 이동하면서 영문 케밥케이스로 통일.

2. **JSX 교체 (5 위치)**: 각각 단일 라인의 이모지/텍스트를 동일 시각 위치에 `<img>` 로 치환. 별도 CSS 클래스 추가 없이 인라인 스타일만으로 처리 (Surgical Changes).

3. **개인정보 안내 추가**: 신원 확인 섹션 내 이름 필드 다음에 `<p>` 한 줄 삽입. 사용자가 검정색 명시 → 기존 `text-muted` 패턴 대신 인라인 `color: '#000'`.

4. **회귀 안전성**:
   - `IconLabel.test.jsx` — prop 직접 명시, 영향 없음.
   - `CartPage.test.jsx:56` `/인벤토리 \(3개\)/` — "인벤토리 (3개)" 텍스트 유지로 매칭 안전.
   - `MapPage.test.jsx:59` `/부스 약도/` — 텍스트 유지로 안전.
   - `StickyCartBar.test.jsx` (3 케이스) — "인벤토리" 텍스트 유지로 안전.
   - ADR-033 정적 자산 화이트리스트(`server/middleware/business-state.js:24`)에 `.png`/`.webp` 이미 포함 — 별도 미들웨어 수정 불요.

## 테스트 결과

### 단위·통합 (docker dev)
```
docker compose -f docker-compose.dev.yml exec dev npm test
```
**1173/1173 통과** (Test Files 101 passed). StickyCartBar(3) · CartPage · CustomerLayout · MapPage 회귀 모두 그린.

### 빌드 (docker dev)
```
docker compose -f docker-compose.dev.yml exec dev npm run build
```
production 번들 성공 (190 modules, 10.35s). `dist/pubg-map.png`, `dist/pubg-inventory.webp` 정상 복사 확인.

### 운영 컨테이너 자산 응답 (ADR-033 사이드체크)
```
docker compose build app && docker compose up -d
curl -sI http://localhost/pubg-map.png       # 200 OK, image/png, 1766722 bytes
curl -sI http://localhost/pubg-inventory.webp # 200 OK, image/webp, 32150 bytes
```
nginx → app → static asset 경로 정상. CLOSED 가드 화이트리스트도 정적 자산을 가로채지 않음 (확장자 기반 통과).

### 시각 검증
별도 진행하지 않음 — 코드 변경이 단순 텍스트→`<img>` 치환 + 인라인 스타일 안내 문구이며, 1173 케이스 회귀 + 운영 자산 HTTP 200으로 충분히 검증됨. 실제 화면 확인은 D-1 리허설 또는 운영 단말기에서 본인 점검 권장.

## 다음에 할 것

- 운영 단말기 또는 dev 서버에서 시각 확인:
  - 헤더 우측 두 아이콘이 PUBG 그래픽으로 보이는지
  - 메뉴에서 아이템 담은 뒤 sticky bar에 가방 그래픽 + 텍스트 정렬 어색하지 않은지
  - 카트/약도 페이지 제목의 인라인 이미지 베이스라인 정렬
  - 체크아웃 화면 이름 필드 아래 안내 문구가 충분히 작고 검정색으로 보이는지
- (선택) 헤더 아이콘 28px이 너무 작거나 크면 CSS 미세 조정 — 현재는 `.icon-btn` 36px 안에서 시각 균형 무난할 것으로 판단.
