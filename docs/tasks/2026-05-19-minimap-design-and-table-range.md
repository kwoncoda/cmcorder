# 2026-05-19 — 미니맵 UI 교체 + 테이블 번호 1~15 정리 (minimap_design 브랜치)

## 목표

- 미니맵(테이블 지도) 모달의 임시 격자형 UI(`T1~T16`)를 **`테이블 위치 맵.png`** 기반 이미지 UI로 교체.
- 주문 시 테이블 번호 선택 UI/검증을 **1~15**로 정리 (기존 1~12 + 미니맵 16칸 불일치 해소).

## 만든 것

- `public/map/table-location.png` — 루트의 `테이블 위치 맵.png` (3.3MB) 사본. Vite 정적 자산.
- 새 prop: `BoothMinimapModal.totalTables` — legend "총 N개 테이블" 표기를 `gridSize`와 독립적으로 지정.
- 새 회귀 테스트 7건 (BoothMinimapModal 4 + MapPage 3).

## 한 일

### 1. 이미지 자산 배치

- `cp "테이블 위치 맵.png" "public/map/table-location.png"` (ASCII 경로로 정리, Vite `/map/table-location.png` 서빙).
- 원본 PNG는 루트에 그대로 보존(직전 커밋 `b4df18d` 자산).

### 2. `src/components/organisms/BoothMinimapModal.jsx`

- `totalTables` prop 추가 (default `cols*rows` — backward-compat).
- 이미지 모드 렌더링 개선:
  - 가운데 위치 부정확한 `<div ... top:50%; left:50%>` 오버레이 마커 **제거** (이미지에 위치가 새겨져 있어 좌표를 알 수 없고 항상 가운데를 가리키는 마커는 오정보 — 하단 legend로 본인 테이블 번호 강조 대체).
  - `<img>` 컨테이너 wrap: `data-testid="map-image-wrap"`, 다크 배경, `border-radius` + `overflow:hidden`.
  - `<img>` 스타일: `width:100%; height:auto; max-width:100%; max-height:70vh; object-fit:contain` (반응형 + 찌그러짐 방지 + 뷰포트 70% 상한).
  - `alt` 텍스트를 `myTableNo` 유무에 따라 분기: `"테이블 위치 약도 — 내 테이블 5번"` / `"테이블 위치 약도"`.
  - `aria-label`은 `myTableNo` 설정 시에만 부여 (`내 테이블 5번`) — 기존 회귀 보호.
- legend의 "총 N개 테이블" 문구를 항상 표시 (기존: `myTableNo` 없는 경우만 노출).
- 격자 fallback 분기는 그대로 유지 (`mapImage` 미수령 시) — 컴포넌트 자체의 backward-compat을 위해 보존.

### 3. `src/pages/customer/MapPage.jsx`

- `mapImage="/map/table-location.png"` + `totalTables={15}` 전달.
- 기존 `gridSize={{ cols: 4, rows: 4 }}` 제거 (이미지 모드에서 미사용).
- 파일 38줄 (≤120줄 정책 충족).

### 4. `src/pages/customer/CheckoutPage.jsx`

- `TABLES = [1,2,3,4,5,6,7,8,9,10,11,12]` → `[1,...,15]` (3개 추가).
- 라벨 `테이블 번호 (1~12)` → `테이블 번호 (1~15)`.
- 파일 119줄 (≤120줄 정책 충족, +1).

### 5. 테스트

- `src/components/organisms/__tests__/BoothMinimapModal.test.jsx`
  - `mapImage 있을 시 <img> 렌더 + 그리드 fallback X` — 새 alt 텍스트(`/테이블 위치 약도/`)로 갱신.
  - **신규 ★ `mapImage + myTableNo` 시 이미지 aria-label="내 테이블 N번"**.
  - **신규 ★ `mapImage + myTableNo 없음` 시 aria-label 미부여 + alt 기본값**.
  - **신규 ★ `totalTables` prop 이 `cols*rows`보다 우선** (legend 15 표기).
- `src/pages/customer/__tests__/MapPage.test.jsx`
  - **신규 ★ 메인 이미지 `/map/table-location.png` 렌더 + 격자 fallback 미노출 + `T16` 미존재**.
  - **신규 ★ "총 15개 테이블" legend 노출**.
  - 기존 `?order_id=5 시 본인 테이블 강조` 테스트의 주석을 그리드→이미지 모드로 정정.
  - 기존 `myTableNo=undefined` 테스트 주석 동일.

## 테스트 결과

모든 명령은 **docker dev 컨테이너**(`docker-compose.dev.yml`)에서 실행 (ADR-033).

| 명령                                                                            | 결과                                |
| ------------------------------------------------------------------------------- | ----------------------------------- |
| `docker compose -f docker-compose.dev.yml exec dev npm test -- --run`           | **1174/1174 통과**                  |
| `docker compose -f docker-compose.dev.yml exec dev npm run lint`                | 0 errors / 3 warnings (pre-existing) |
| `docker compose -f docker-compose.dev.yml exec dev npm run build`               | 6.66s, 성공. `dist/map/table-location.png` 포함 |

운영 컨테이너 HTTP 사이드체크(`docker compose build app && curl`)는 **권한 거부**되어 미실행 (브랜치 작업 단계 — 사용자 정책). 정적 자산 prefix는 `/map/`(기존 `public/map/` 폴더 존재) + 확장자 `.png`로 ADR-033 CLOSED 화이트리스트(`isStaticAssetByExtension`) 통과 형태.

## 검증 매트릭스

- [x] 미니맵 모달에서 `T1~T16` 격자 UI가 보이지 않음 (`queryByTestId('map-fallback-grid')` not present).
- [x] `테이블 위치 맵.png` 이미지가 `/map/table-location.png`로 렌더링.
- [x] 모달 닫기 버튼(상단 X) 정상 동작 (기존 회귀 유지).
- [x] "총 15개 테이블" legend 표시.
- [x] 테이블 번호 선택 UI에 1~15가 표시되고 16번은 없음.
- [x] 주문 payload `table_no`는 기존 구조(`Number(tableNo)`) 유지.
- [x] TransferReportForm / TransferPage / 다른 이름으로 이체 — 손대지 않음 (git diff 미포함).
- [x] CompletePage / StatusPage / 관리자 화면 — 손대지 않음.
- [x] 백엔드 zod 스키마(`server/routes/customer.js:46` `table_no: z.number().int().nullable().optional()`) — range 검증 없음, 그대로 둠 (사용자 지침: "최소 수정").

## 남은 리스크 / 확인 필요

1. **백엔드 1~15 검증 부재** — 클라이언트만 1~15. 악의적 사용자가 직접 API에 `table_no: 99`를 보내면 통과. 운영상 영향 미미하지만, 추가 강화하려면 `server/routes/customer.js`의 zod에 `.min(1).max(15)` 추가 (의도적으로 이번 작업 범위에서 제외).
2. **운영 컨테이너 정적 자산 회귀** — `/map/table-location.png`는 `.png` 확장자이므로 ADR-033 화이트리스트 통과 (`server/middleware/__tests__/business-state.test.js` 기존 16 케이스 그대로 통과). prod 빌드 시각 검증은 권한상 미실행.
3. **이미지 크기 3.3MB** — 모바일 첫 진입 시 다소 큰 다운로드. `loading="lazy"` 적용. 추후 webp 변환 검토 가능하나 사용자 지침("새 이미지 생성 금지")으로 보류.
4. **본인 테이블 오버레이 마커 미구현** — 이미지에 테이블 위치가 새겨져 있어 화면 좌표 미상. legend(`내 테이블: #5`) + 이미지 aria-label로 대체. 더 정확한 강조가 필요하면 SVG 좌표 매핑이 별도 작업으로 필요.

## 변경 파일

```
M  src/components/organisms/BoothMinimapModal.jsx
M  src/components/organisms/__tests__/BoothMinimapModal.test.jsx
M  src/pages/customer/CheckoutPage.jsx
M  src/pages/customer/MapPage.jsx
M  src/pages/customer/__tests__/MapPage.test.jsx
?? public/map/table-location.png
```
