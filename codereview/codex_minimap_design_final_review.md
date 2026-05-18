# Codex minimap_design 최종 리뷰

## 1. 최종 판단

조건부 커밋 가능.

P0/P1 차단 이슈는 없습니다. WebP 전환, `/map/table-location.webp` 참조, 서버 `table_no` 1~15 범위 검증, `totalTables={15}` 기반 fallback cap은 의도대로 들어갔습니다. 다만 현재 `main...HEAD` diff는 비어 있고 실제 변경은 working tree에만 있으므로, 커밋 전 포함 파일을 정리해야 합니다. 또한 API 레벨에서 `dineIn` 주문도 `table_no: null` 또는 미지정을 허용하는 정책이 운영상 의도된 것인지 한 번 확인해야 합니다.

## 2. P0/P1 이슈

없음.

## 3. P2/P3 이슈

| 심각도 | 항목 | 위치 | 판단 | 영향 | 권장 조치 |
|---|---|---|---|---|---|
| P2 | working tree 미커밋 상태 | Git 상태 | `git diff main...HEAD`는 비어 있고, 코드/테스트/WebP가 working tree 변경으로 남아 있음 | 브랜치만 병합하면 후속 보완이 main에 반영되지 않음 | 커밋 전 포함 파일 목록을 확인하고 `public/map/table-location.webp`를 반드시 포함 |
| P2 | `dineIn` + `table_no` null/미지정 허용 | `server/routes/customer.js:47` | `nullable().optional()`은 포장 호환에는 맞지만 `delivery_type`과 교차 검증하지 않음 | 직접 API 호출 시 매장 식사인데 테이블 미지정 주문이 생성될 수 있음 | 운영 정책상 허용이면 유지. 데이터 정합성을 더 중시하면 `dineIn`은 1~15 필수로 superRefine 추가 |
| P3 | WebP 2.43MB | `public/map/table-location.webp` | 3.32MB PNG보다 개선됐지만 여전히 큰 단일 이미지 | 모바일 첫 지도 표시에서 다운로드 비용 있음 | 병합 차단은 아님. 행사 전 추가 압축/해상도 조정 검토 |
| P3 | `img` 명시 치수 없음 | `src/components/organisms/BoothMinimapModal.jsx:108` | Web Interface Guidelines상 이미지에는 `width`/`height` 권장 | 로드 전 레이아웃 흔들림 가능 | 후속으로 `width`/`height` 또는 wrapper `aspectRatio` 추가 |
| P3 | fallback 기본값은 여전히 16칸 | `src/components/organisms/BoothMinimapModal.jsx:56` | `totalTables` 미지정 시 기존 `cols * rows` 유지 | 앱 경로는 `totalTables={15}`라 T16 미노출. 단독 사용 시 16칸 가능 | backward compatibility로 유지 가능. 전역 정책을 15로 고정하려면 기본값 변경 필요 |
| P3 | 일부 테스트 케이스 미직접 커버 | `server/routes/__tests__/customer.test.js` | 0, 16, 999, -1, `"abc"`는 테스트됨. 1.5, `"5"`, NaN은 구현상 Zod로 거부되지만 직접 테스트는 없음 | 회귀 감지력이 약간 낮음 | 필요 시 1.5와 `"5"` 거부 테스트 추가. NaN은 표준 JSON payload로는 표현 불가 |
| P3 | 이전 리뷰/작업 문서의 PNG 언급 | `codereview/codex_minimap_design_review.md`, `docs/tasks/2026-05-19-minimap-design-and-table-range.md` | 런타임 코드는 WebP만 참조하지만 과거 문서에는 PNG 경로가 남음 | 커밋 시 문서 독자가 혼동할 수 있음 | 역사 문서로 둘지, 커밋 제외할지 팀 방침으로 결정 |

## 4. WebP 전환 리뷰

- `public/map/table-location.webp`가 존재하며 크기는 2,430,992 bytes입니다.
- `public/map/table-location.png`는 현재 존재하지 않습니다. `dist/map/table-location.png`도 build 후 존재하지 않았습니다.
- 소스 런타임 참조는 `/map/table-location.webp`로 전환되었습니다. `src/pages/customer/MapPage.jsx:11`에서 `TABLE_MAP_IMAGE = '/map/table-location.webp'`입니다.
- `src/pages/customer/__tests__/MapPage.test.jsx`도 `.webp` 경로를 검증합니다.
- `npm run build` 후 `dist/map/table-location.webp`가 생성되었고, public 원본과 SHA256 해시가 동일했습니다.
- 기존 PNG 삭제는 안전합니다. 현재 Git 기준 `public/map/table-location.png`는 tracked 파일이 아니어서 삭제 diff는 없고, WebP 신규 파일만 커밋 대상입니다.
- 2.43MB는 병합 차단 수준은 아닙니다. 다만 행사장 모바일 네트워크를 고려하면 병합 후 추가 최적화 후보입니다.

## 5. table_no 1~15 백엔드 검증 리뷰

- `server/routes/customer.js`의 `CreateOrderSchema.table_no`는 `z.number().int().min(1).max(15).nullable().optional()`입니다.
- 1, 8, 15는 테스트에서 200 응답으로 확인됩니다.
- 0, 16, 999, -1, `"abc"`는 테스트에서 400 `VALIDATION_ERROR`로 확인됩니다.
- `"5"`와 1.5는 직접 테스트는 없지만, `z.number()`와 `.int()` 조합상 거부됩니다.
- NaN은 표준 JSON 요청 본문으로 표현할 수 없습니다. 비표준 런타임 객체라면 Zod number가 거부하는 경로입니다.
- 포장 주문에서 `table_no: null` 또는 미지정은 현재 서비스 흐름과 맞습니다.
- 매장 주문은 프론트 `CheckoutPage`에서 테이블 선택이 필수이고, payload는 `Number(tableNo)`로 기존 구조를 유지합니다.
- 서버는 `delivery_type: 'dineIn'`이면서 `table_no`가 null/미지정인 직접 API 요청을 허용합니다. 운영상 API 직접 호출까지 데이터 정합성을 보장하려면 이 부분은 추가 교차 검증이 필요합니다.
- `src/api/schemas.js` 미변경은 문제 없습니다. 해당 스키마는 응답 파싱용이고, `table_no` 응답은 여전히 `number | null | optional` 형태가 맞습니다.

## 6. fallback grid 15개 정리 리뷰

- `BoothMinimapModal`은 `totalTables` prop을 우선 사용하고, fallback grid 생성 시 `tableNo > totalTables`이면 렌더하지 않습니다.
- `MapPage`는 `totalTables={15}`를 전달하므로 앱의 지도 경로에서는 T16이 보이지 않습니다.
- `BoothMinimapModal.test.jsx`에 `totalTables={15}` fallback에서 gridcell 15개, T1/T15 표시, T16 미노출 검증이 추가되었습니다.
- `totalTables` 미지정 시 기본값은 기존대로 `cols * rows`입니다. 현재 앱에서 이 컴포넌트를 직접 사용하는 곳은 `MapPage`뿐이라 runtime 위험은 낮습니다.
- backward compatibility를 유지한 설계로 판단합니다. 단, “컴포넌트 기본 정책도 15개”가 요구사항이라면 아직 완전히 고정된 것은 아닙니다.

## 7. 회귀 위험 평가

- `TransferReportForm`, `TransferPage`, `CompletePage`, `StatusPage`는 `main` 대비 diff가 없습니다.
- 다른 이름으로 이체 기능에는 이번 변경의 직접 영향이 없습니다. 현재 main 기준 해당 경로는 이미 제거된 상태이며, 후속 보완 diff에 포함되지 않았습니다.
- 주문 생성 payload 구조는 유지됩니다. 프론트는 여전히 `table_no` 숫자 또는 null을 보냅니다.
- 쿠폰, 상태 전이, 관리자 API, DB schema는 이번 diff 범위에 포함되지 않았습니다.
- 전체 테스트는 101 files / 1185 tests passed입니다. `TransferPage`, `CompletePage`, `StatusPage`, `CheckoutPage`, `BoothMinimapModal`, `MapPage`, customer route 테스트가 함께 통과했습니다.
- `npm run lint`는 0 errors, 기존 unused eslint-disable warning 3건입니다.
- `npm run build`는 성공했습니다.

## 8. 커밋 전 확인

포함해야 할 파일:

- `server/routes/customer.js`
- `server/routes/__tests__/customer.test.js`
- `src/components/organisms/BoothMinimapModal.jsx`
- `src/components/organisms/__tests__/BoothMinimapModal.test.jsx`
- `src/pages/customer/CheckoutPage.jsx`
- `src/pages/customer/MapPage.jsx`
- `src/pages/customer/__tests__/MapPage.test.jsx`
- `public/map/table-location.webp`
- `codereview/codex_minimap_design_final_review.md`

팀 방침에 따라 포함 여부를 결정할 파일:

- `codereview/codex_minimap_design_review.md`
- `docs/tasks/2026-05-19-minimap-design-and-table-range.md`
- `docs/tasks/2026-05-19-minimap-webp-and-table-no-validation.md`

제외해야 할 파일:

- `.env`
- DB 실데이터
- `dist/`
- `node_modules/`
- `.claude/`
- 세션/비밀 파일
- `test-results/`

`public/map` 처리:

- `public/map/.gitkeep`는 기존 tracked 파일입니다.
- `public/map/table-location.webp`는 신규 커밋 대상입니다.
- `public/map/table-location.png`는 현재 존재하지 않고 tracked 파일도 아닙니다.

## 9. main 병합 전 수동 QA

- [ ] 미니맵 버튼 클릭 시 `/map/table-location.webp` 이미지 표시
- [ ] 기존 T1~T16 격자 UI 미노출
- [ ] 1~15 테이블 번호가 이미지와 주문 선택 UI에서 일치
- [ ] 16번 테이블 미노출
- [ ] 매장 주문에서 테이블 1, 15 선택 후 주문 생성 정상
- [ ] 포장 주문에서 `table_no` 없이 주문 생성 정상
- [ ] 직접 API 또는 QA 도구로 `table_no=16` 주문 생성 시 400 응답
- [ ] 모바일에서 이미지 잘림/찌그러짐 없음
- [ ] 다른 이름 이체 관련 현 정책 확인 및 이체 완료 요청 정상
- [ ] CompletePage/StatusPage 이동과 상태 표시 정상

## 10. 결론

- 커밋 가능 여부: 조건부 커밋 가능.
- main 병합 가능 여부: P0/P1이 없으므로 가능. 단, working tree 변경을 커밋에 정확히 포함해야 합니다.
- 병합 전 반드시 확인할 것: `public/map/table-location.webp` 포함, `.png` 미참조, `dineIn` 주문의 `table_no` null 허용 정책, 수동 QA.
- 병합 후 추적할 것: WebP 추가 최적화, 이미지 명시 치수/aspect-ratio, 1.5/`"5"` 거부 테스트 보강 여부.
