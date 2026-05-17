# 2026-05-17 — front_closed_design: 관리자 로그인 웹로고 교체 + CLOSED 화면 미니멀화

브랜치: `main` → `front_closed_design`
계획서: `C:/Users/user/.claude/plans/ui-ux-1-zesty-bentley.md`

## 목표

D-day 직전 잔여 UI/UX 2건 정리.

1. **관리자 로그인 페이지** — 카드 상단 시각 아이덴티티를 마스코트(`.brand-mark` 48×48)에서 "웹 로고" 이미지로 교체. 관리자 진입 첫 화면의 브랜드 톤 통일.
2. **사용자 CLOSED 안내 페이지** — 자물쇠 🔒 / 새로고침 🔄 버튼 제거. 차분한 안내로 정리하고, OPEN 전환은 이미 동작 중인 CustomerLayout 30초 폴링에 일임.

## 만든 것

| 파일 | 종류 |
|------|------|
| `public/web-logo.png` | 신규 자산 (2.44MB, `docs/design-bundle/uploads/웹 로고.png` 영문 rename 복사) |
| `docs/tasks/2026-05-17-front-closed-design.md` | 작업 로그 (본 문서) |

## 한 일

### 1. 브랜치 분기
```bash
git checkout main && git checkout -b front_closed_design
```

### 2. 웹 로고 자산 복사
```bash
cp "docs/design-bundle/uploads/웹 로고.png" public/web-logo.png
```
한글 파일명 → 영문 `web-logo.png` 로 rename (URL 인코딩 안정성).

### 3. `src/pages/admin/LoginPage.jsx` — 마스코트 → 웹로고 교체
- 상단 코멘트(L1–5)에 "로고 교체 (2026-05-17 front_closed_design)" 1줄 추가
- L40 `<div className="login-mark"><div className="brand-mark" aria-hidden="true" /></div>` → `<img src="/web-logo.png" alt="치킨이닭 웹 로고" className="login-logo" />` 로 교체

### 4. `src/styles/components.css` — `.login-logo` 룰 추가
- L1919 인근 (기존 `.login-mark .brand-mark` 직후) 추가:
```css
.login-mark .login-logo {
  max-width: 200px; max-height: 64px;
  width: auto; height: auto;
  object-fit: contain; display: block;
}
```
- 기존 `.login-mark .brand-mark` 룰은 그대로 유지 (다른 자산 교체 시 재사용 가능, 즉시 cleanup 보류)

### 5. `src/components/organisms/ClosedScreen.jsx` — 자물쇠/새로고침 제거
- 상단 코멘트에 "자물쇠/새로고침 제거 (2026-05-17 front_closed_design)" 2줄 추가
- props 시그니처 `onRefresh` 제거: `{ reason, operatingDate, className, ...rest }`
- L36 `<div className="icon" aria-hidden="true">🔒</div>` 제거
- L62–64 새로고침 `<button>🔄 새로고침</button>` 블록 전체 제거
- 결과 라인 수: 70 → 68 (페이지 ≤120줄 규칙 OK)

### 6. `src/pages/customer/ClosedPage.jsx` — onRefresh prop 전달 제거
- 상단 코멘트 갱신
- `<ClosedScreen onRefresh={...} />` → `<ClosedScreen reason={...} operatingDate={...} />`

### 7. 테스트 조정
- `src/pages/admin/__tests__/LoginPage.test.jsx` — "★ 카드 상단 웹로고 이미지 렌더" 케이스 추가 (`getByAltText('치킨이닭 웹 로고')` + `src="/web-logo.png"` 검증)
- `src/components/organisms/__tests__/ClosedScreen.test.jsx` — "새로고침 CTA 클릭 시 onRefresh 호출" 케이스(L74–85) 삭제, 상단 회귀 항목 주석 갱신, 미사용 `vi`/`fireEvent` import 정리

## 테스트 결과

```
$ npm test
Test Files  94 passed (94)
     Tests  1005 passed (1005)
  Duration  60.94s
```

변경 3 파일 단독 실행:
```
✓ src/pages/admin/__tests__/LoginPage.test.jsx (9 tests)        # +1
✓ src/components/organisms/__tests__/ClosedScreen.test.jsx (13 tests)  # -1
✓ src/pages/customer/__tests__/ClosedPage.test.jsx (8 tests)    # 변동 없음
```

회귀 없음. 합계 변동 0 (+1 − 1).

수동 시각 검증은 사용자가 `npm run dev` 후 브라우저에서 검수 지시서(plan §3.2) 따라 진행.

## 다음에 할 것

- (선택) `npm run test:e2e` Playwright smoke 통과 확인 — 본 변경은 라우팅·테스트 ID 무변경이라 영향 없음 예상
- (선택) 사용자 시각 검증 후 PR `front_closed_design` → `main`
- (별건) `.login-mark .brand-mark` CSS 룰 cleanup (다음 사이클)
- (별건) `public/web-logo.png` 2.44MB → 최적화 (WebP 변환 또는 PNG 압축)

---

## 후속 변경 — 2단계 (2026-05-17 사용자 피드백)

사용자 추가 지시:
1. CLOSED 화면 본문의 마스코트(군모) 제거 + 웹로고로 교체
2. CLOSED 화면 상단 헤더가 design-bundle ScreenClosed와 너무 달라 정합 — 서브명 "CLOSED" + 우측 액션(🗺️/🎒) 숨김
3. 관리자 로그인 웹로고가 안 보임 → 진단

### 추가 변경 파일

| 파일 | 변경 |
|------|------|
| `src/components/organisms/ClosedScreen.jsx` | `MascotState` import + 사용 제거, REASON_CONFIG의 `mascot` 필드 제거, `<img src="/web-logo.png" alt="치킨이닭 웹 로고" className="closed-logo" />` 추가 |
| `src/styles/components.css` | `.closed-screen .closed-logo` 룰 추가 (max-width 160px, max-height 120px, object-fit contain) |
| `src/components/layouts/CustomerLayout.jsx` | `isClosedView = location.pathname === '/closed'` 분기 도입. 서브명 'CLOSED' vs 'WINNER · ...', 우측 head-actions 조건부 렌더 |
| `src/components/organisms/__tests__/ClosedScreen.test.jsx` | "마스코트 표시 — both-days-done 시 canceled" 케이스 → "★ 웹로고 이미지 렌더" 케이스로 교체 (alt/src 검증) |

### 진단 — "관리자 로그인 웹로고 안 보임"

| 점검 항목 | 결과 |
|----------|------|
| `public/web-logo.png` 파일 헤더 | PNG image data, 1254×1254, 8-bit RGB, 2.44MB 정상 |
| `dist/web-logo.png` (빌드 산출물) | 존재, 정상 PNG |
| `dist/assets/index-CpEIQiyC.css` 안 `.login-logo` 룰 | 포함됨 |
| `dist/assets/LoginPage-CxbQPGVo.js` 안 `web-logo` 참조 | 포함됨 |
| nginx `default.conf` /web-logo.png 라우팅 | `location /` → Express 프록시 (정상, 별도 처리 불요) |
| Express SPA 정적 서빙 | `DIST_PATH=/app/dist`로 dist/ 전체 서빙 (Dockerfile L44) |

**결론**: 소스·빌드·nginx 모두 정상. **현재 실행 중인 Docker 컨테이너 안의 `/app/dist`가 옛 빌드**인 게 가장 유력. 컨테이너 재빌드 필요.

```bash
docker compose build --no-cache app && docker compose up -d
# 또는
docker compose up -d --build
```

dev 모드(`npm run dev`)에서 본 거라면 브라우저 hard refresh(Ctrl+F5) 또는 dev server 재시작.

### 테스트 결과 (2단계 후)

```
Test Files  94 passed (94)
     Tests  1005 passed (1005)
```

ClosedScreen.test.jsx: 13 케이스 유지 (마스코트 -1 / 웹로고 +1).

---

## 후속 변경 — 3단계 (2026-05-17 사용자 docker rebuild 후 재현)

사용자가 `docker compose build --no-cache app && docker compose up -d` 후에도 웹로고가 broken으로 표시. 헤더의 "CLOSED" 서브명 + alt 텍스트는 새 코드 반영됨 → JS/CSS는 새 빌드, 이미지만 404 의심.

### 진단 결과 — 진짜 원인

`curl -sI http://localhost/web-logo.png` 응답:
```
HTTP/1.1 423 Locked
Content-Type: application/json
Content-Length: 100
```

`/mascot/mascot.png`도 동일하게 423. (curl -I는 HEAD 요청이라 423 분기로 떨어진 것이고, 실제 브라우저 GET은 가드에서 `302 redirect → /closed` → HTML 응답 → `<img>`가 HTML 받아 broken)

`server/middleware/business-state.js` 분석:
- `isGetPassthrough` 화이트리스트가 `/assets/` prefix와 `/favicon.ico`, `/robots.txt`만 통과
- **`/web-logo.png`, `/mascot/mascot.png`, `/items/*.webp`, `/map/*` 등 public/ root 정적 자산은 화이트리스트에 없음**
- → CLOSED 상태에서 모든 일반 정적 자산이 302 redirect로 가로채짐 (거대 회귀 — 본인이 마스코트 → 웹로고 교체하면서 처음 드러남)

### 추가 변경 파일

| 파일 | 변경 |
|------|------|
| `server/middleware/business-state.js` | `STATIC_ASSET_EXT = /\.(png\|jpe?g\|webp\|gif\|svg\|ico\|css\|js\|map\|woff2?\|ttf\|eot\|webmanifest)$/i` 추가, `isGetPassthrough`에서 확장자 매칭 시 통과. SPA 라우트는 확장자 X — 충돌 없음. |
| `server/middleware/__tests__/business-state.test.js` | 회귀 4건 추가 — `/web-logo.png`, `/mascot/mascot.png`, `/items/foo.webp`, `/map/booth.svg` 모두 CLOSED 시 200 통과 검증 |

### 테스트 결과 (3단계 후)

```
Test Files  94 passed (94)
     Tests  1009 passed (1009)
```

- business-state.test.js: 12 → 16 (+4 회귀)

### 사용자 다음 단계

```bash
docker compose build app && docker compose up -d
```

(서버 코드 변경이라 frontend cache는 그대로 재활용. `--no-cache` 불필요)

재배포 후 CLOSED 페이지에서 웹로고 + 헤더 마스코트가 정상 표시되어야 함.
