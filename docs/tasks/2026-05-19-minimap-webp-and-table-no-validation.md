# 2026-05-19 — 미니맵 WebP 전환 + table_no 백엔드 검증 (minimap_design 브랜치, follow-up)

## 목표

Codex 리뷰 통과 후 병합 전 안정성 보강 (P0/P1 없음, P2 수준 정리).

1. `public/map/table-location.png`(3.32MB) → `.webp`(2.43MB) 전환, 미니맵 이미지 경로 갱신.
2. 서버 `POST /api/orders`에 `table_no` 1~15 범위 검증 (프론트 UI만으론 부족 — 직접 API 호출 차단).
3. fallback 격자 코드도 totalTables prop으로 cap → `T16`이 어떤 경로로도 보이지 않음.

## 만든 것 / 한 일

### 1. WebP 전환

- 사용자가 `public/map/table-location.webp` (2.43MB, 80~90 품질 추정) 제공.
- `public/map/table-location.png` (3.32MB) 삭제 — 사용하지 않으므로 제거.
- 절감: ~890KB (27%).
- `src/pages/customer/MapPage.jsx` 상수 `TABLE_MAP_IMAGE` 와 주석을 `.webp`로 갱신.
- 빌드 시 `dist/map/table-location.webp` 정상 포함 확인.

### 2. 백엔드 `table_no` 검증

- `server/routes/customer.js` `CreateOrderSchema.table_no`:
  ```js
  table_no: z
    .number()
    .int()
    .min(1, '테이블 번호는 1번부터 15번까지만 선택할 수 있어요.')
    .max(15, '테이블 번호는 1번부터 15번까지만 선택할 수 있어요.')
    .nullable()
    .optional(),
  ```
- `nullable().optional()` 그대로 유지 → 포장(takeout) 케이스(`table_no: null`/미지정)는 회귀 없이 통과.
- 위반 시 `400 VALIDATION_ERROR` + 메시지 `테이블 번호는 1번부터 15번까지만 선택할 수 있어요.` (errorHandler ZodError 매핑 활용 — 신규 코드 0).

### 3. fallback 격자 cap

- `src/components/organisms/BoothMinimapModal.jsx` 격자 렌더링에 `if (tableNo > totalTables) return null;` 한 줄 추가.
- 기본 동작(`totalTables` 미지정) = `cols*rows`로 backward-compat (기존 4×4=16 셀 테스트 유지).
- 신규: `totalTables={15}` + `gridSize={cols:4,rows:4}` → 15 셀만 렌더 (T16 미노출).
- MapPage는 이미 이미지 모드라 fallback 경로 자체가 안 탐 — 컴포넌트 자체의 잠재 회귀 방어 차원.

## 테스트 보강

### 백엔드 — `server/routes/__tests__/customer.test.js` (신규 10건)

신규 describe: `사용자 API — POST /api/orders table_no 1~15 범위 검증`

| 케이스                                       | 기대                                            |
| -------------------------------------------- | ----------------------------------------------- |
| ★ table_no=1                                 | 200, body.table_no=1                            |
| ★ table_no=15                                | 200, body.table_no=15                           |
| ★ table_no=8                                 | 200                                             |
| ★ table_no=0                                 | 400 VALIDATION_ERROR + 메시지                   |
| ★ table_no=16                                | 400 VALIDATION_ERROR + 메시지                   |
| ★ table_no=999                               | 400 VALIDATION_ERROR                            |
| ★ table_no=-1                                | 400 VALIDATION_ERROR                            |
| ★ table_no="abc"                             | 400 VALIDATION_ERROR (문자 거부)                |
| ★ table_no=null (외부인 포장)                | 200, body.table_no=null (회귀)                  |
| ★ table_no 미지정 (외부인 포장)              | 200, body.table_no=null (회귀)                  |

### 프론트 — `src/components/organisms/__tests__/BoothMinimapModal.test.jsx` (신규 1건)

- ★ fallback 격자도 totalTables 로 cap — T16 미렌더 (1~15만).
  - 검증: 15 gridcells, `T1`/`T15` 노출, `T16` 미노출.

### 프론트 — `src/pages/customer/__tests__/MapPage.test.jsx` (갱신 1건)

- 메인 이미지 src 검증을 `.png` → `.webp`로 갱신.

## 테스트 결과 (docker dev 컨테이너 — ADR-033)

| 명령                                                                            | 결과                          |
| ------------------------------------------------------------------------------- | ----------------------------- |
| `docker compose -f docker-compose.dev.yml exec dev npm test -- --run`           | **1185/1185 통과** (직전 1174 + 신규 11) |
| `docker compose -f docker-compose.dev.yml exec dev npm run lint`                | 0 errors / 3 warnings (pre-existing) |
| `docker compose -f docker-compose.dev.yml exec dev npm run build`               | 8.95s, 성공. `dist/map/table-location.webp` 포함 |

## 허용/거부 매트릭스 — `table_no`

| 입력                     | 결과       | 비고                                  |
| ------------------------ | ---------- | ------------------------------------- |
| 1, 2, …, 15              | 200        | 정상 (정수만)                         |
| 0                        | 400        | min(1) 위반                           |
| 16, 999, 100             | 400        | max(15) 위반                          |
| -1, -100                 | 400        | min(1) 위반                           |
| 1.5, 2.7                 | 400        | int() 위반                            |
| `"5"`, `"abc"`, `"15"`   | 400        | number() 위반 (문자 거부)             |
| `NaN`                    | 400        | number() 거부                         |
| `null`                   | 200        | 포장 케이스 — nullable() 통과         |
| 미지정                   | 200        | optional() 통과                       |

## 변경 파일

```
M  server/routes/customer.js                         (zod table_no 검증 +6줄)
M  server/routes/__tests__/customer.test.js          (테스트 +95줄)
M  src/components/organisms/BoothMinimapModal.jsx    (fallback cap +1줄)
M  src/components/organisms/__tests__/BoothMinimapModal.test.jsx  (테스트 +18줄)
M  src/pages/customer/MapPage.jsx                    (path .png → .webp)
M  src/pages/customer/__tests__/MapPage.test.jsx     (테스트 path 갱신)
D  public/map/table-location.png                     (3.32MB 삭제 — 미사용)
A  public/map/table-location.webp                    (2.43MB 신규)
```

(*PNG/WebP는 직전 round에서 추가된 untracked 파일이라 git status에는 D/A로 표시되지 않고 단순 디렉터리 변경으로 보임.*)

## 절대 깨지면 안 되는 것 — 회귀 확인

- ADR-020 Pattern B: 가격 재계산 회귀 (`pricing.test.js` 13 케이스) — pass.
- ADR-019 + ADR-034: 쿠폰 학번 정규식 / `(student_id)` UNIQUE (`coupon.test.js` 12) — pass.
- ADR-021: 학번+이름 필수 (`customer.test.js` 4 케이스) — pass.
- ADR-025: 주문 상태 13 합법 / 5 불법 (`order-state.test.js` 18) — pass.
- G13 영업 상태 / ADR-012 정산: pass.
- ADR-033 정적 자산 화이트리스트 (`business-state.test.js` 16): `.png` → `.webp` 모두 확장자 화이트리스트(`isStaticAssetByExtension`) 통과 — 별도 변경 불필요. pass.
- ADR-034 admin_events 통합 API: pass.
- §3.5 Appendix-D 페이지 ≤120줄: MapPage 38줄, CheckoutPage 119줄 — pass.

## 남은 리스크 / 확인 필요

1. **이미지 여전히 2.43MB** — 모바일 초회 진입 시 다소 큼. `loading="lazy"` 적용 중. 추가 압축 가능하나 사용자 지침 ("새 이미지 생성 금지") 범위 외. 현실적으로 부스 사용자가 D-day에 한 번 보는 자산이므로 캐시 효율 충분.
2. **운영 컨테이너 HTTP 사이드체크** — 정책상 prod rebuild 권한 미부여로 미실행. `/map/*.webp`는 ADR-033 정적 자산 화이트리스트 (확장자 기반) 통과 형태로, CLOSED 가드 회귀 위험 없음 (기존 `.png` 처리와 동일 매커니즘).
3. **본인 테이블 오버레이 미구현** — 직전 round에서 결정. legend + 이미지 `aria-label`로 대체. 위치 좌표 매핑 작업은 별도 task로 분리 가능.
4. **프론트 zod 응답 스키마 (`src/api/schemas.js`)** — `table_no: z.number().int().nullable().optional()` 그대로 둠. 응답 파싱용이라 범위 검증 불필요 (서버가 이미 1~15만 저장). 과거 데이터 호환을 위해 변경 X.
