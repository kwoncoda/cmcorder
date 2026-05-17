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
