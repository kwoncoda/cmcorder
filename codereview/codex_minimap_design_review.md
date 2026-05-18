# Codex minimap_design 코드 리뷰

## 1. 최종 판단

조건부 병합 가능.

P0/P1 수준의 기능 회귀나 배포 차단 버그는 발견하지 못했습니다. 다만 현재 `minimap_design`의 HEAD는 `main`과 같은 커밋이고, 실제 변경은 working tree에만 있습니다. main 병합 전에는 아래 파일들을 의도대로 커밋에 포함해야 합니다. 특히 `public/map/table-location.png`가 누락되면 배포 빌드에서 지도 이미지가 빠집니다.

- 수정됨: `src/components/organisms/BoothMinimapModal.jsx`, `src/components/organisms/__tests__/BoothMinimapModal.test.jsx`, `src/pages/customer/CheckoutPage.jsx`, `src/pages/customer/MapPage.jsx`, `src/pages/customer/__tests__/MapPage.test.jsx`
- 신규: `public/map/table-location.png`
- 신규 작업 로그: `docs/tasks/2026-05-19-minimap-design-and-table-range.md`

`.env`, DB 실데이터, `dist`, `node_modules`, 세션/비밀 파일은 리뷰 대상 변경에 포함되지 않았고, ignored 파일로만 확인했습니다.

## 2. P0/P1 이슈

없음.

## 3. P2/P3 이슈

| 심각도 | 병합 전 필수 여부 | 파일/위치 | 문제 | 근거 | 영향 | Claude 수정 지시 |
|---|---:|---|---|---|---|---|
| P2 | 필수 | Git 상태 | 변경사항이 아직 커밋되지 않음 | `git diff main...HEAD`는 비어 있고, `git status --short`에 working tree 변경과 신규 이미지가 표시됨 | 브랜치만 병합하면 현재 리뷰한 변경이 main에 반영되지 않음 | main 병합 전 변경 파일과 `public/map/table-location.png`를 커밋에 포함하세요. 작업 로그 문서는 팀 방침에 따라 커밋하거나 제외하세요. |
| P2 | 권장 | `server/routes/customer.js:46`, `server/db/init.sql:53` | 백엔드 `table_no` 1~15 범위 검증 부재 | 주문 생성 스키마는 `z.number().int().nullable().optional()`만 검사하고 DB도 `INTEGER`만 사용 | UI는 1~15만 제공하지만 직접 API 호출로 16, 99 같은 값이 저장될 수 있음. 축제 현장 운영 데이터 혼선 가능 | 운영 전 가능하면 `dineIn` 주문은 `table_no` 1~15 필수, `takeout`은 null 허용으로 서버 검증을 추가하세요. |
| P2 | 권장 | `public/map/table-location.png` | PNG 용량 3,317,366 bytes | 이미지 크기 1254x1254, 빌드 후에도 동일 크기로 `dist/map/table-location.png` 포함 | 모바일 첫 지도 진입 시 다운로드 비용이 큼 | 기능 병합은 가능하지만 운영 전 WebP 변환 또는 PNG 압축을 권장합니다. |
| P3 | 아니오 | `src/components/organisms/BoothMinimapModal.jsx:108` | 이미지에 명시적 `width`/`height`가 없음 | 현재 `<img>`는 CSS `width:100%`, `height:auto`, `maxHeight:70vh`만 지정 | 이미지 로드 전 모달 본문 레이아웃이 흔들릴 수 있음 | `width={1254}` `height={1254}` 또는 wrapper `aspectRatio: '1 / 1'`을 추가하세요. |
| P3 | 아니오 | `src/components/organisms/BoothMinimapModal.jsx:119` 이후 | fallback grid가 4x4, 16칸으로 남아 있음 | `mapImage`가 없을 때 `cols*rows`로 T1~T16 렌더 | MapPage에서는 이미지가 항상 전달되어 노출되지 않지만, 컴포넌트 단독 사용 시 정책 혼동 가능 | 호환 fallback을 유지할지, minimap 전용 컴포넌트에서 제거할지 후속 정리하세요. |
| P3 | 아니오 | `src/components/organisms/BoothMinimapModal.jsx:108` | 본인 테이블 시각 오버레이 마커 미구현 | 기존 중앙 오버레이는 제거되었고, 현재는 legend와 이미지 `aria-label`만 사용 | 사용자가 이미지에서 번호를 직접 찾아야 함. 좌표가 없는 상태에서는 허용 가능한 UX | 정확한 좌표 매핑이 준비되면 별도 SVG/absolute marker로 구현하세요. |
| P3 | 아니오 | `src/pages/customer/__tests__/CheckoutPage.test.jsx` | CheckoutPage에서 1~15 버튼 수와 16번 미노출을 직접 검증하는 테스트가 없음 | 현재 테스트는 테이블 입력 존재와 submit payload 중심 | TABLES 회귀를 MapPage 테스트만으로는 충분히 잡기 어려움 | CheckoutPage 테스트에 15개 radio 버튼과 16번 미노출 검증을 추가하세요. |

## 4. 수정사항 해결 여부

| 항목 | 해결 여부 | 근거 파일 | 추가 수정 필요 여부 | 심각도 재평가 |
|---|---|---|---|---|
| 1. 미니맵 격자 UI -> 이미지 UI 교체 | 해결 | `src/pages/customer/MapPage.jsx:11`, `src/pages/customer/MapPage.jsx:29` | 없음 | 정상 |
| 2. `테이블 위치 맵.png` 적용 | 해결 | `public/map/table-location.png`, SHA256 원본과 동일 | 커밋 포함 필수 | P2 프로세스 |
| 3. 총 테이블 수 15개 표시 | 해결 | `src/pages/customer/MapPage.jsx:12`, `src/components/organisms/BoothMinimapModal.jsx:160` | 없음 | 정상 |
| 4. 테이블 번호 UI 1~15 정리 | 해결 | `src/pages/customer/CheckoutPage.jsx:18`, `src/pages/customer/CheckoutPage.jsx:88` | 서버 검증은 별도 | P2 |
| 5. 16번 테이블 제거 | 해결 | `src/pages/customer/CheckoutPage.jsx:18`, `src/pages/customer/__tests__/MapPage.test.jsx:71` | CheckoutPage 직접 테스트 보강 권장 | P3 |
| 6. 기존 하단 정보 유지 | 해결 | `src/components/organisms/BoothMinimapModal.jsx:157` | 없음 | 정상 |
| 7. 모바일 반응형 처리 | 대부분 해결 | `src/components/organisms/BoothMinimapModal.jsx:112` | 이미지 치수 또는 aspect-ratio 추가 권장 | P3 |
| 8. Transfer/Complete/Status 미수정 | 해결 | `git diff --name-only main -- ...` 결과 없음 | 없음 | 정상 |
| 9. 다른 이름 이체 기능 영향 없음 | 해결 | `src/components/organisms/TransferReportForm.jsx`, 관련 diff 없음 | 현 정책상 제거 상태가 맞는지 QA에서 확인 | 정상 |

## 5. 이미지 자산/배포 리뷰

- `테이블 위치 맵.png`와 `public/map/table-location.png`의 SHA256이 동일해 사본 배치는 정상입니다.
- Vite public 자산 경로로 `/map/table-location.png`를 사용하므로 배포 후 루트 기준 정적 서빙이 가능합니다.
- `npm run build` 결과 `dist/map/table-location.png`가 생성되었고 원본과 해시가 같습니다.
- 실제 이미지는 1254x1254 PNG, 3,317,366 bytes입니다. 기능 차단은 아니지만 모바일 환경에서는 WebP 또는 압축 PNG가 더 적합합니다.
- `alt`는 `테이블 위치 약도`, 본인 테이블이 있을 때는 `테이블 위치 약도 - 내 테이블 N번` 취지로 제공됩니다. 다만 `aria-label`이 이미지의 접근성 이름을 덮어쓰므로, 시각 마커가 없는 현재 구조에서는 후속 정리 여지가 있습니다.
- `loading="lazy"`가 적용되어 있습니다. 모달 진입 즉시 보이는 이미지라 실제 지연 효과는 제한적입니다.
- `objectFit: 'contain'`, `width: '100%'`, `height: 'auto'`, `maxHeight: '70vh'`로 모바일 찌그러짐 방지는 되어 있습니다.
- 명시적 `width`/`height` 또는 `aspect-ratio`가 없어 CLS 방지 측면은 P3 보강 대상입니다.
- 닫기 동작은 상단 X, backdrop, Escape 테스트가 유지됩니다. 하단 닫기 버튼은 main 기준 이전 커밋에서 이미 제거된 상태라 이번 변경의 회귀 대상은 아닙니다.

## 6. 테이블 번호 정책 리뷰

- 프론트 정책은 1~15로 정리되었습니다. `CheckoutPage`의 `TABLES`는 1부터 15까지이고 라벨도 `테이블 번호 (1~15)`입니다.
- `MapPage`는 `TOTAL_TABLES = 15`를 `BoothMinimapModal`에 전달합니다.
- 주문 payload 구조는 유지됩니다. `table_no: delivery === 'dineIn' ? Number(tableNo) : null` 형태라 기존 API와 호환됩니다.
- 백엔드는 `table_no`를 정수/null로만 검증합니다. 공개 주문 API를 직접 호출할 수 있는 구조라면 1~15 검증을 서버에도 두는 편이 맞습니다.
- 이번 변경 자체로 기존 주문 payload, 쿠폰 payload, 상태 전이 payload를 깨뜨린 흔적은 없습니다.

## 7. 회귀 위험 평가

- 주문 생성: payload 구조는 유지되고 전체 테스트 통과. 다만 서버 table_no 범위 검증은 별도 P2입니다.
- 이체 완료 요청: `TransferPage`와 `TransferReportForm` diff 없음, `TransferPage.test.jsx` 통과.
- 다른 이름으로 이체: 현재 main 기준 `TransferReportForm`에서 해당 경로는 제거된 상태이고 이번 작업 diff 없음. 회귀라기보다 현 정책 확인 대상입니다.
- 주문 완료/status 이동: `CompletePage`, `StatusPage` diff 없음, 관련 테스트 통과.
- 쿠폰: `CheckoutPage`의 쿠폰 조건 및 payload 변경 없음, 쿠폰 도메인/라우트 diff 없음.
- 관리자 API/로그: `server/routes/admin.js`, 상태 전이, admin_events 관련 diff 없음.
- DB schema: `server/db/init.sql`, bootstrap/migration diff 없음.

## 8. 테스트/빌드/lint 결과

직접 실행 결과:

| 명령 | 결과 |
|---|---|
| `npm test -- --run --silent --reporter=dot` | 101 files, 1174 tests passed |
| `npm run lint` | 0 errors, 3 warnings. 경고는 기존 unused eslint-disable 3건 |
| `npm run build` | 성공, Vite build 3.69s, `dist/map/table-location.png` 포함 |

Claude 보고의 Docker 테스트(`docker compose ... npm test -- --run`, 1174/1174 통과)는 이번 로컬 실행 결과와 일치합니다. Codex는 Docker 명령은 재실행하지 않았고, 로컬 npm 명령으로 검증했습니다.

테스트 커버리지 평가는 다음과 같습니다.

- 미니맵 이미지 렌더링, `/map/table-location.png` 경로, fallback grid 미노출은 `MapPage.test.jsx`가 잡습니다.
- 16번 테이블 미노출은 MapPage에서 `T16` 미노출만 잡습니다. CheckoutPage의 1~15 버튼 수 검증은 추가하는 편이 좋습니다.
- TransferReportForm, TransferPage, CompletePage, StatusPage 회귀 테스트는 전체 테스트에서 통과했습니다.
- build 결과로 public 자산이 dist에 포함되는 것은 직접 확인했습니다.

## 9. main 병합 전 수동 QA 체크리스트

- [ ] 미니맵 버튼 클릭 시 이미지 지도 표시
- [ ] 기존 T1~T16 격자 UI 미노출
- [ ] 닫기 버튼 동작
- [ ] 하단 내 테이블/총 15개 테이블 표시
- [ ] 테이블 번호 선택 UI 1~15만 표시
- [ ] 16번 테이블 없음
- [ ] 모바일에서 이미지 잘림/찌그러짐 없음
- [ ] 주문 생성 정상
- [ ] 다른 이름으로 이체 정상. 현재 정책상 제거가 맞다면 체크박스 미노출과 기본 입금자 이름 경로 정상 여부 확인
- [ ] CompletePage/StatusPage 회귀 없음

## 10. Claude에게 줄 후속 수정 지시

P0/P1은 없습니다. 선택 수정 또는 운영 전 보강 프롬프트는 아래와 같습니다.

```text
minimap_design 후속 보강을 진행하세요. 소스 변경 범위는 필요한 파일로 제한하세요.

1. server/routes/customer.js의 CreateOrderSchema에 table_no 정책을 추가하세요.
   - delivery_type이 dineIn이면 table_no는 1~15 정수 필수
   - delivery_type이 takeout이면 table_no는 null 또는 undefined만 허용
   - 잘못된 값은 400/ZodError로 거부
   - customer route 테스트에 table_no=16, table_no=0, takeout+table_no 값 거부 케이스를 추가

2. CheckoutPage 테스트에 테이블 번호 버튼 1~15 렌더와 16번 미노출 검증을 추가하세요.

3. BoothMinimapModal의 이미지에 width/height 또는 aspect-ratio를 지정해 레이아웃 흔들림을 줄이세요.

4. public/map/table-location.png는 운영 전 WebP 또는 압축 PNG로 최적화하는 방안을 검토하세요.

5. fallback grid를 계속 유지할지 결정하고, 유지한다면 16칸 fallback이 현 15테이블 정책과 다른 이유를 주석/테스트명에 명확히 남기세요.
```

## 11. 결론

- main 병합 가능 여부: 조건부 가능.
- 병합 전 반드시 해야 할 것: 현재 working tree 변경과 `public/map/table-location.png`를 커밋에 포함하고, 위 수동 QA를 통과시켜야 합니다.
- 병합 전 코드상 필수 수정: P0/P1 없음.
- 병합 후 또는 운영 전 추적할 것: 서버 `table_no` 1~15 검증, 이미지 용량 최적화, 이미지 치수/aspect-ratio, CheckoutPage 테스트 보강, 오버레이 마커 여부 결정.
