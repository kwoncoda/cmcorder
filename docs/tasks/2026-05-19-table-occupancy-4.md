# 작업 로그 — Subagent 4: 어드민 테이블 잠금 페이지

**날짜:** 2026-05-19  
**브랜치:** table_lock  
**담당:** Admin Table Lock Page Agent

---

## 목표

어드민 nav에 "테이블 잠금" 탭 추가 + `/admin/tables` 페이지 신설.  
1~15 테이블 카드 그리드, 잠금/해제 단일 버튼, admin_events 로깅.

---

## 만든 것

- `src/pages/admin/TablesPage.jsx` (신규, 118줄)
- `src/pages/admin/__tests__/TablesPage.test.jsx` (신규, 12 테스트)
- `docs/tasks/2026-05-19-table-occupancy-4.md` (본 파일)

---

## 한 일

### 백엔드

**`server/routes/admin.js`**
- import 추가: `lockTable`, `unlockTable` (table-locks-repo), `getAdminTablesView` (table-availability)
- `GET /admin/api/tables` — getBusinessState().operating_date → getAdminTablesView → 15행 JSON
- `POST /admin/api/tables/:tableNo/lock` — 1~15 범위 검증 + lockTable + logAdminEvent (단일 트랜잭션) + 응답
- `POST /admin/api/tables/:tableNo/unlock` — 동일 패턴, TABLE_UNLOCK 이벤트

admin_events 필드: category='system', event_type='TABLE_LOCK'|'TABLE_UNLOCK', action_name='테이블 잠금'|'테이블 잠금 해제', actor='admin', operating_date from getBusinessState(db).operating_date (non-null 보장), target_id=tableNo, target_name='테이블 N번'

범위 검증 (0/16/abc/NaN) → 400 VALIDATION_ERROR.

**`src/api/routes.js`**
- `TABLES_AVAILABILITY`, `ADMIN_TABLES`, `ADMIN_TABLE_LOCK(n)`, `ADMIN_TABLE_UNLOCK(n)` 추가

### 프론트엔드

**`src/components/layouts/AdminLayout.jsx`**
- ITEMS 5종 → 6종: `{ to: '/admin/tables', label: '테이블 잠금', testid: 'admin-nav-tables' }` 마지막에 추가

**`src/App.jsx`**
- `AdminTablesPage` React.lazy 추가
- `<Route path="/admin/tables" element={<AdminTablesPage />} />` 추가

**`src/styles/components.css`**
- `.tables-grid` (5열 그리드, 반응형 3열/2열), `.table-lock-card`, `.table-lock-no`, `.table-lock-badge` (available/occupied/dining/locked variant) 추가

**`src/pages/admin/TablesPage.jsx`** (신규)
- TablesViewSchema: z.array(TableStatusSchema).length(15)
- useApi로 GET /admin/api/tables 1회 fetch
- 15개 TableCard 렌더 (data-testid: table-card-N)
- 잠금/해제 버튼 (data-testid: table-N-lock/unlock), pending 동안 disabled+aria-busy
- 해제 후 fresh fetch — 여전히 occupied/dining이면 tables-hint 노출
- 401 → navigate('/admin/login'), 5xx → ErrorState + retry, loading → LoadingState

### 테스트

**`server/routes/__tests__/admin.test.js`** 확장 (+20 케이스)
- GET /admin/api/tables: 15개/occupied/locked/401
- POST lock: 200+locked+events, 범위0/16/abc/CSRF없음/미인증
- POST unlock: 200+unlocked+events, 범위16
- 회귀: 잠금 테이블 주문 409, 점유 테이블 주문 409
- history?type=system TABLE_LOCK/UNLOCK 노출

**`src/pages/admin/__tests__/TablesPage.test.jsx`** 신설 (12 케이스)
- LoadingState, 15카드, occupied/locked 배지+버튼, lock/unlock POST 호출, 점유해제 hint, 단순해제 hint없음, 5xx ErrorState+retry, 401 navigate, 페이지 ≤120줄

**`src/components/layouts/__tests__/AdminLayout.test.jsx`** 갱신
- 5개→6개 nav 항목 검증, testid='admin-nav-tables', 라벨='테이블 잠금'

---

## 테스트 결과

```
docker compose -f docker-compose.dev.yml exec dev npm test -- --run
Test Files  105 passed (105)
Tests       1292 passed (1292)
```

타겟 테스트 (admin.test.js: 85 passed, TablesPage.test.jsx: 12 passed, AdminLayout.test.jsx: 7 passed)

---

## 정책 준수

- CSRF: requireCsrf가 /admin/api 전체에 적용 — POST routes 자동 보호 (명시 확인)
- admin auth: requireAdmin이 /admin/api 전체에 적용 — 401 자동 처리
- operating_date: getBusinessState(db).operating_date 사용 (find_error_v3 P1-2 패턴 동일)
- reason 컬럼 없음 (Q4 확정)
- TablesPage 118줄 ≤ 120 제한 충족
- DO NOT COMMIT 준수
