// Task 2.7 — AdminCardColumn organism 단위 테스트.
// IMPLEMENTATION_PLAN §2.7 / §3.5 6조·7조 / ADR-021.
//
// 회귀 보호 항목:
//   - title + 카운트 표시
//   - orders 빈 배열 시 "해당 상태 주문 없음" 표시 (find_error_v2)
//   - orders 목록 → OrderCard 렌더 (key=order.id, data-testid=admin-order-card-<id>)
//   - 5분 이상 경과 시 noteworthy 색 (border-warning)
//   - 10분 이상 경과 시 danger 색 (border-danger)
//   - 5분 미만은 기본 (border-divider)
//   - 카드 클릭 시 네비게이션 X (find_error_v2: onSelectOrder 무시)
//   - ★ React.memo 회귀 — OrderCard는 React.memo로 감싸졌다 ($$typeof=react.memo)
//   - forwardRef 로 section 참조 전달
//   - a11y (axe)
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import AdminCardColumn, { OrderCard } from '../AdminCardColumn.jsx';

// tick 기준 시각: 2026-05-20 17:30:00 (축제 운영 시각대).
const BASE_TICK = new Date('2026-05-20T17:30:00').getTime();

const mkOrder = (overrides = {}) => ({
  id: 17,
  no: 17,
  depositorName: '홍길동',
  transferred_at: '2026-05-20T17:28:00', // 2분 경과
  status: 'TRANSFER_REPORTED',
  ...overrides,
});

describe('AdminCardColumn', () => {
  it('title + 카운트 표시', () => {
    render(
      <AdminCardColumn
        title="이체 확인 요청"
        status="TRANSFER_REPORTED"
        orders={[]}
        tick={BASE_TICK}
      />,
    );
    expect(
      screen.getByRole('heading', { name: '이체 확인 요청' }),
    ).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('orders 비어있을 때 "해당 상태 주문 없음" 표시', () => {
    render(
      <AdminCardColumn
        title="이체 확인"
        status="TRANSFER_REPORTED"
        orders={[]}
        tick={BASE_TICK}
      />,
    );
    expect(screen.getByText('해당 상태 주문 없음')).toBeInTheDocument();
  });

  it('orders 목록 카드 렌더 (key=order.id, data-testid)', () => {
    const orders = [
      mkOrder({ id: 17, no: 17 }),
      mkOrder({ id: 18, no: 18, depositorName: '김철수' }),
    ];
    render(
      <AdminCardColumn
        title="이체"
        status="TRANSFER_REPORTED"
        orders={orders}
        tick={BASE_TICK}
      />,
    );
    expect(screen.getByTestId('admin-order-card-17')).toBeInTheDocument();
    expect(screen.getByTestId('admin-order-card-18')).toBeInTheDocument();
  });

  it('카운트 = orders.length', () => {
    const orders = [mkOrder({ id: 1, no: 1 }), mkOrder({ id: 2, no: 2 })];
    render(
      <AdminCardColumn
        title="이체"
        status="TRANSFER_REPORTED"
        orders={orders}
        tick={BASE_TICK}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('2분 경과 (5분 미만) 시 기본 border (border-divider)', () => {
    const orders = [
      mkOrder({ id: 1, no: 1, transferred_at: '2026-05-20T17:28:00' }),
    ];
    render(
      <AdminCardColumn
        title="x"
        status="TRANSFER_REPORTED"
        orders={orders}
        tick={BASE_TICK}
      />,
    );
    expect(screen.getByTestId('admin-order-card-1').className).toMatch(/border-divider/);
  });

  it('5분 이상 경과 시 noteworthy 색 (border-warning)', () => {
    const orders = [
      mkOrder({ id: 1, no: 1, transferred_at: '2026-05-20T17:24:00' }), // 6분 경과
    ];
    render(
      <AdminCardColumn
        title="x"
        status="TRANSFER_REPORTED"
        orders={orders}
        tick={BASE_TICK}
      />,
    );
    expect(screen.getByTestId('admin-order-card-1').className).toMatch(/border-warning/);
  });

  it('10분 이상 경과 시 danger 색 (border-danger)', () => {
    const orders = [
      mkOrder({ id: 1, no: 1, transferred_at: '2026-05-20T17:19:00' }), // 11분 경과
    ];
    render(
      <AdminCardColumn
        title="x"
        status="TRANSFER_REPORTED"
        orders={orders}
        tick={BASE_TICK}
      />,
    );
    expect(screen.getByTestId('admin-order-card-1').className).toMatch(/border-danger/);
  });

  it('카드에 경과 분 표시 ("N분 경과")', () => {
    const orders = [
      mkOrder({ id: 1, no: 1, transferred_at: '2026-05-20T17:24:00' }), // 6분
    ];
    render(
      <AdminCardColumn
        title="x"
        status="TRANSFER_REPORTED"
        orders={orders}
        tick={BASE_TICK}
      />,
    );
    expect(screen.getByText('6분 경과')).toBeInTheDocument();
  });

  it('★ 카드 본문 클릭은 onSelectOrder 를 호출하지 않는다 (네비게이션 제거)', () => {
    const onSelectOrder = vi.fn();
    const orders = [mkOrder({ id: 17, no: 17 })];
    render(
      <AdminCardColumn
        title="x"
        status="TRANSFER_REPORTED"
        orders={orders}
        tick={BASE_TICK}
        onSelectOrder={onSelectOrder}
      />,
    );
    // 카드 article 자체 클릭 → onSelectOrder 호출 X.
    fireEvent.click(screen.getByTestId('admin-order-card-17'));
    expect(onSelectOrder).not.toHaveBeenCalled();
  });

  it('★ 카드는 cursor-pointer 클래스를 가지지 않는다 (네비게이션 제거)', () => {
    const orders = [mkOrder({ id: 17, no: 17 })];
    render(
      <AdminCardColumn
        title="x"
        status="TRANSFER_REPORTED"
        orders={orders}
        tick={BASE_TICK}
      />,
    );
    const card = screen.getByTestId('admin-order-card-17');
    expect(card.className).not.toMatch(/cursor-pointer/);
    expect(card.className).not.toMatch(/hover:opacity-90/);
  });

  it('★ items 배열이 있으면 "이름 ×수량" 으로 최대 3개 표시', () => {
    const orders = [
      mkOrder({
        id: 17,
        no: 17,
        items: [
          { menu_id: 1, name: '후라이드', base_price: 18000, quantity: 1, category: 'CHICKEN' },
          { menu_id: 2, name: '콜라', base_price: 2000, quantity: 2, category: 'DRINK' },
        ],
      }),
    ];
    render(
      <AdminCardColumn
        title="x"
        status="TRANSFER_REPORTED"
        orders={orders}
        tick={BASE_TICK}
      />,
    );
    const card = screen.getByTestId('admin-order-card-17');
    expect(within(card).getByText(/후라이드 ×1/)).toBeInTheDocument();
    expect(within(card).getByText(/콜라 ×2/)).toBeInTheDocument();
  });

  it('★ items 가 3개 초과면 처음 3개 + "외 N개" 표시', () => {
    const orders = [
      mkOrder({
        id: 17,
        no: 17,
        items: [
          { menu_id: 1, name: '후라이드', base_price: 18000, quantity: 1, category: 'CHICKEN' },
          { menu_id: 2, name: '양념', base_price: 18000, quantity: 1, category: 'CHICKEN' },
          { menu_id: 3, name: '간장', base_price: 18000, quantity: 1, category: 'CHICKEN' },
          { menu_id: 4, name: '콜라', base_price: 2000, quantity: 2, category: 'DRINK' },
          { menu_id: 5, name: '사이다', base_price: 2000, quantity: 1, category: 'DRINK' },
        ],
      }),
    ];
    render(
      <AdminCardColumn
        title="x"
        status="TRANSFER_REPORTED"
        orders={orders}
        tick={BASE_TICK}
      />,
    );
    const card = screen.getByTestId('admin-order-card-17');
    expect(within(card).getByText(/후라이드 ×1/)).toBeInTheDocument();
    expect(within(card).getByText(/양념 ×1/)).toBeInTheDocument();
    expect(within(card).getByText(/간장 ×1/)).toBeInTheDocument();
    expect(within(card).getByText(/외 2개/)).toBeInTheDocument();
    // 3번째 이후 항목은 직접 노출되지 않음.
    expect(within(card).queryByText(/콜라 ×2/)).not.toBeInTheDocument();
  });

  it('★ items 가 빈 배열이거나 누락 시 깨지지 않고 항목 라인 미렌더', () => {
    const orders = [
      mkOrder({ id: 17, no: 17, items: [] }),
      mkOrder({ id: 18, no: 18 }), // items 누락
    ];
    render(
      <AdminCardColumn
        title="x"
        status="TRANSFER_REPORTED"
        orders={orders}
        tick={BASE_TICK}
      />,
    );
    // 양쪽 모두 정상 렌더되어야 한다.
    expect(screen.getByTestId('admin-order-card-17')).toBeInTheDocument();
    expect(screen.getByTestId('admin-order-card-18')).toBeInTheDocument();
  });

  it('depositorName 없을 때 "(이름 없음)" 표시', () => {
    const orders = [mkOrder({ id: 17, no: 17, depositorName: null, depositor_name: null, name: null })];
    render(
      <AdminCardColumn
        title="x"
        status="TRANSFER_REPORTED"
        orders={orders}
        tick={BASE_TICK}
      />,
    );
    expect(screen.getByText('(이름 없음)')).toBeInTheDocument();
  });

  // ── P1-2 (Codex 리뷰) 서버 응답 shape 정합 ────────────────────
  it('★ P1-2 — depositor_name (snake_case, 서버 실제 shape) 표시', () => {
    const orders = [
      {
        id: 99, no: 99, status: 'TRANSFER_REPORTED',
        depositor_name: '서버케이스',
        total_price: 25000,
        transferred_at: '2026-05-20T17:28:00',
      },
    ];
    render(
      <AdminCardColumn title="이체" status="TRANSFER_REPORTED" orders={orders} tick={BASE_TICK} />,
    );
    expect(screen.getByText('서버케이스')).toBeInTheDocument();
  });

  it('★ P1-2 — depositor_name 없을 때 name fallback', () => {
    const orders = [
      {
        id: 100, no: 100, status: 'ORDERED',
        name: '주문자이름',
        total_price: 18000,
        created_at: '2026-05-20T17:25:00',
      },
    ];
    render(
      <AdminCardColumn title="주문중" status="ORDERED" orders={orders} tick={BASE_TICK} />,
    );
    expect(screen.getByText('주문자이름')).toBeInTheDocument();
  });

  it('★ P1-2 — 카드에 금액(total_price) 표시 (F-A-007 요구)', () => {
    const orders = [
      {
        id: 101, no: 101, status: 'TRANSFER_REPORTED',
        depositor_name: '홍길동',
        total_price: 36000,
        transferred_at: '2026-05-20T17:28:00',
      },
    ];
    render(
      <AdminCardColumn title="이체" status="TRANSFER_REPORTED" orders={orders} tick={BASE_TICK} />,
    );
    // 36,000원 또는 ₩36,000 형식 — 정확한 토큰은 PriceTag 출력 따름.
    expect(screen.getByText(/36[,.]?000/)).toBeInTheDocument();
  });

  // P2-3 (Codex v3 2026-05-15): React.memo 제거 결정 (A 방향).
  // 사유: 5초 폴링마다 fresh JSON → order object reference 매번 새로 생성 →
  //       memo 효과 0 (referential equality 깨짐). 카드 ≤30개 운영 부하 미미 →
  //       memo 제거로 코드 단순화. §3.5 7조의 "list memoization"은
  //       *효과 있는 경우만* 적용. 본 케이스는 폴링 구조상 무용.
  it('★ P2-3 — OrderCard는 일반 함수 컴포넌트 (React.memo 제거됨)', () => {
    expect(typeof OrderCard).toBe('function');
    // memo wrap 시 $$typeof가 react.memo Symbol — 본 검증으로 회귀 방지.
    expect(OrderCard.$$typeof).toBeUndefined();
  });

  it('forwardRef 로 section 참조 전달', () => {
    const ref = createRef();
    render(
      <AdminCardColumn
        ref={ref}
        title="이체"
        status="TRANSFER_REPORTED"
        orders={[]}
        tick={BASE_TICK}
      />,
    );
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });

  // ── find_error_v3 — design-bundle .col / .col-head / .col-body / .order-card 클래스 정합 ──
  it('★ find_error_v3 — 컬럼에 .col 클래스 + 헤더에 .col-head + body에 .col-body 적용', () => {
    const orders = [mkOrder({ id: 17, no: 17 })];
    render(
      <AdminCardColumn title="이체" status="TRANSFER_REPORTED" orders={orders} tick={BASE_TICK} />,
    );
    const col = screen.getByTestId('admin-column-TRANSFER_REPORTED');
    expect(col.className).toMatch(/\bcol\b/);
    expect(col.querySelector('.col-head')).not.toBeNull();
    expect(col.querySelector('.col-body')).not.toBeNull();
  });

  it('★ find_error_v3 — 기본 카드에 .order-card 클래스 (5분 미만)', () => {
    const orders = [mkOrder({ id: 1, no: 1, transferred_at: '2026-05-20T17:28:00' })];
    render(
      <AdminCardColumn title="x" status="TRANSFER_REPORTED" orders={orders} tick={BASE_TICK} />,
    );
    const card = screen.getByTestId('admin-order-card-1');
    expect(card.className).toMatch(/\border-card\b/);
    expect(card.className).not.toMatch(/order-card warn|order-card danger/);
  });

  it('★ find_error_v3 — 5분 이상 카드에 .order-card.warn 클래스', () => {
    const orders = [mkOrder({ id: 1, no: 1, transferred_at: '2026-05-20T17:24:00' })];
    render(
      <AdminCardColumn title="x" status="TRANSFER_REPORTED" orders={orders} tick={BASE_TICK} />,
    );
    expect(screen.getByTestId('admin-order-card-1').className).toMatch(/order-card warn/);
  });

  it('★ find_error_v3 — 10분 이상 카드에 .order-card.danger 클래스', () => {
    const orders = [mkOrder({ id: 1, no: 1, transferred_at: '2026-05-20T17:19:00' })];
    render(
      <AdminCardColumn title="x" status="TRANSFER_REPORTED" orders={orders} tick={BASE_TICK} />,
    );
    expect(screen.getByTestId('admin-order-card-1').className).toMatch(/order-card danger/);
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const orders = [mkOrder({ id: 17, no: 17 })];
    const { container } = render(
      <AdminCardColumn
        title="이체 확인"
        status="TRANSFER_REPORTED"
        orders={orders}
        tick={BASE_TICK}
      />,
    );
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });
});

// ── Bug 9, 10 — OrderCard inline 액션 ─────────────────────────
// 칸반 카드 안에서 상태별 빠른 전이 버튼 노출 + onAction(id, to) 호출.
// design-bundle screens-admin.jsx 295~322 라인의 act(o.id, ...) 패턴 정합.
describe('OrderCard inline 액션 (Bug 9, 10)', () => {
  // 상태별 액션 노출 매트릭스.
  const ACTION_MATRIX = [
    { status: 'ORDERED',           labels: ['취소'] },
    { status: 'TRANSFER_REPORTED', labels: ['확인', '보류'] },
    { status: 'PAID',              labels: ['조리 시작'] },
    { status: 'COOKING',           labels: ['조리 완료'] },
    { status: 'READY',             labels: ['전달 완료'] },
    { status: 'DINING',            labels: ['테이블 준비 완료'] },
    { status: 'HOLD',              labels: ['이체 확인', '취소'] },
  ];

  it.each(ACTION_MATRIX)('status=$status 카드에 inline 액션 버튼 노출 — $labels', ({ status, labels }) => {
    const orders = [mkOrder({ id: 17, no: 17, status })];
    render(
      <AdminCardColumn title="x" status={status} orders={orders} tick={BASE_TICK} />,
    );
    const card = screen.getByTestId('admin-order-card-17');
    for (const label of labels) {
      // 카드 내부에 해당 라벨 버튼이 있어야 한다 (within(card)).
      const btn = within(card).getByRole('button', { name: label });
      expect(btn).toBeInTheDocument();
    }
  });

  it('★ Bug 10 — TRANSFER_REPORTED 카드 "확인" 클릭 시 onAction(17, "PAID") 호출', () => {
    const onAction = vi.fn();
    const orders = [mkOrder({ id: 17, no: 17, status: 'TRANSFER_REPORTED' })];
    render(
      <AdminCardColumn
        title="x" status="TRANSFER_REPORTED" orders={orders}
        tick={BASE_TICK} onAction={onAction}
      />,
    );
    const card = screen.getByTestId('admin-order-card-17');
    fireEvent.click(within(card).getByRole('button', { name: '확인' }));
    expect(onAction).toHaveBeenCalledWith(17, 'PAID');
  });

  it('★ Bug 9 — TRANSFER_REPORTED 카드 "보류" 클릭 시 onAction(17, "HOLD") 호출', () => {
    const onAction = vi.fn();
    const orders = [mkOrder({ id: 17, no: 17, status: 'TRANSFER_REPORTED' })];
    render(
      <AdminCardColumn
        title="x" status="TRANSFER_REPORTED" orders={orders}
        tick={BASE_TICK} onAction={onAction}
      />,
    );
    const card = screen.getByTestId('admin-order-card-17');
    fireEvent.click(within(card).getByRole('button', { name: '보류' }));
    expect(onAction).toHaveBeenCalledWith(17, 'HOLD');
  });

  it('★ inline 액션 버튼 클릭은 onSelectOrder 를 호출하지 않는다 (이벤트 분리)', () => {
    const onAction = vi.fn();
    const onSelectOrder = vi.fn();
    const orders = [mkOrder({ id: 17, no: 17, status: 'TRANSFER_REPORTED' })];
    render(
      <AdminCardColumn
        title="x" status="TRANSFER_REPORTED" orders={orders}
        tick={BASE_TICK} onAction={onAction} onSelectOrder={onSelectOrder}
      />,
    );
    const card = screen.getByTestId('admin-order-card-17');
    fireEvent.click(within(card).getByRole('button', { name: '확인' }));
    expect(onSelectOrder).not.toHaveBeenCalled();
  });

  it('★ 카드 본문 클릭은 onSelectOrder 를 호출하지 않는다 (네비게이션 제거 회귀)', () => {
    const onSelectOrder = vi.fn();
    const orders = [mkOrder({ id: 17, no: 17, status: 'TRANSFER_REPORTED' })];
    render(
      <AdminCardColumn
        title="x" status="TRANSFER_REPORTED" orders={orders}
        tick={BASE_TICK} onSelectOrder={onSelectOrder}
      />,
    );
    // 본문 article 자체 클릭 → onSelectOrder 호출되지 않음.
    fireEvent.click(screen.getByTestId('admin-order-card-17'));
    expect(onSelectOrder).not.toHaveBeenCalled();
  });

  it('★ HOLD 카드 "이체 확인" 클릭 시 onAction(17, "PAID") 호출 (라벨 변경: 재확인 → 이체 확인)', () => {
    const onAction = vi.fn();
    const orders = [mkOrder({ id: 17, no: 17, status: 'HOLD' })];
    render(
      <AdminCardColumn
        title="x" status="HOLD" orders={orders}
        tick={BASE_TICK} onAction={onAction}
      />,
    );
    const card = screen.getByTestId('admin-order-card-17');
    fireEvent.click(within(card).getByRole('button', { name: '이체 확인' }));
    expect(onAction).toHaveBeenCalledWith(17, 'PAID');
  });

  // ── design_fix v5 — F1/F2 카드에 은행/테이블 위치 표시 ──
  it('★ design_fix v5 — delivery_type=dineIn 카드에 "테이블 N" 노출', () => {
    const orders = [mkOrder({ id: 17, no: 17, delivery_type: 'dineIn', table_no: 5 })];
    render(
      <AdminCardColumn title="x" status="TRANSFER_REPORTED" orders={orders} tick={BASE_TICK} />,
    );
    expect(within(screen.getByTestId('admin-order-card-17')).getByTestId('order-location'))
      .toHaveTextContent('테이블 5');
  });

  it('★ design_fix v5 — delivery_type=takeout 카드에 "포장" 노출', () => {
    const orders = [mkOrder({ id: 18, no: 18, delivery_type: 'takeout', table_no: null })];
    render(
      <AdminCardColumn title="x" status="ORDERED" orders={orders} tick={BASE_TICK} />,
    );
    expect(within(screen.getByTestId('admin-order-card-18')).getByTestId('order-location'))
      .toHaveTextContent('포장');
  });

  it('★ design_fix v5 — TRANSFER_REPORTED 카드에만 "은행: <name>" 노출 (다른 상태는 미노출)', () => {
    const orders = [
      mkOrder({ id: 17, no: 17, status: 'TRANSFER_REPORTED', bank: '카카오' }),
      mkOrder({ id: 18, no: 18, status: 'TRANSFER_REPORTED', bank: '기타', custom_bank: '새마을금고' }),
    ];
    render(
      <AdminCardColumn title="x" status="TRANSFER_REPORTED" orders={orders} tick={BASE_TICK} />,
    );
    expect(within(screen.getByTestId('admin-order-card-17')).getByTestId('order-bank'))
      .toHaveTextContent('은행: 카카오');
    expect(within(screen.getByTestId('admin-order-card-18')).getByTestId('order-bank'))
      .toHaveTextContent('은행: 새마을금고');
  });

  it('★ design_fix v5 — TRANSFER_REPORTED 가 아닌 카드 (ORDERED) 에는 은행 라인 미노출', () => {
    const orders = [mkOrder({ id: 17, no: 17, status: 'ORDERED', bank: '카카오' })];
    render(
      <AdminCardColumn title="x" status="ORDERED" orders={orders} tick={BASE_TICK} />,
    );
    expect(within(screen.getByTestId('admin-order-card-17')).queryByTestId('order-bank'))
      .toBeNull();
  });

  // ── design_fix — 카드 액션 버튼은 design_bundle .order-card .actions button 톤 ──
  // 위험 액션(취소/보류) 은 전역 btn-danger* 변형을 쓰지 않고 카드 액션 기본 톤(elevated bg + ink text) 만 사용.
  // primary(확인/조리 시작 등) 만 .primary 클래스로 옐로 강조 (.order-card .actions button.primary CSS).
  it('★ design_fix — ORDERED 카드 "취소" 버튼은 btn-danger* 클래스 미사용 (.order-card .actions 기본 톤)', () => {
    const orders = [mkOrder({ id: 17, no: 17, status: 'ORDERED' })];
    render(
      <AdminCardColumn title="x" status="ORDERED" orders={orders} tick={BASE_TICK} />,
    );
    const card = screen.getByTestId('admin-order-card-17');
    const btn = within(card).getByRole('button', { name: '취소' });
    expect(btn).not.toHaveClass('btn-danger');
    expect(btn).not.toHaveClass('btn-danger-outline');
    expect(btn).not.toHaveClass('primary');
  });

  it('★ design_fix — TRANSFER_REPORTED "보류"는 기본 톤, "확인"은 .primary (옐로 강조)', () => {
    const orders = [mkOrder({ id: 17, no: 17, status: 'TRANSFER_REPORTED' })];
    render(
      <AdminCardColumn title="x" status="TRANSFER_REPORTED" orders={orders} tick={BASE_TICK} />,
    );
    const card = screen.getByTestId('admin-order-card-17');
    const holdBtn = within(card).getByRole('button', { name: '보류' });
    expect(holdBtn).not.toHaveClass('btn-danger-outline');
    expect(holdBtn).not.toHaveClass('primary');
    const confirmBtn = within(card).getByRole('button', { name: '확인' });
    expect(confirmBtn).toHaveClass('primary');
  });

  // ── READY → DINING 전이 버튼 회귀 ──
  // design_fix_v4 (2026-05-19): dineIn 만 DINING 으로 전이. delivery_type 명시.
  it('★ dineIn READY 카드 버튼 라벨 "전달 완료" + to: "DINING" 호출 (DONE 아님)', () => {
    const onAction = vi.fn();
    const orders = [mkOrder({ id: 17, no: 17, status: 'READY', delivery_type: 'dineIn', table_no: 3 })];
    render(
      <AdminCardColumn title="x" status="READY" orders={orders} tick={BASE_TICK} onAction={onAction} />,
    );
    const card = screen.getByTestId('admin-order-card-17');
    const btn = within(card).getByRole('button', { name: '전달 완료' });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledWith(17, 'DINING');
  });

  // ── design_fix_v4 — takeout READY → SETTLED 직접 전이 ─────────────────────
  // 포장은 DINING 단계 없이 READY → SETTLED 로 바로 전이.
  // 운영자 라벨은 dineIn/takeout 둘 다 "전달 완료" 로 통일 — 인지 부담 최소.
  it('★ design_fix_v4 — takeout READY 카드 버튼 라벨 "전달 완료" + to: "SETTLED" 호출', () => {
    const onAction = vi.fn();
    const orders = [mkOrder({ id: 18, no: 18, status: 'READY', delivery_type: 'takeout', table_no: null })];
    render(
      <AdminCardColumn title="x" status="READY" orders={orders} tick={BASE_TICK} onAction={onAction} />,
    );
    const card = screen.getByTestId('admin-order-card-18');
    const btn = within(card).getByRole('button', { name: '전달 완료' });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    // takeout 은 DINING 건너뛰고 SETTLED 로 직접.
    expect(onAction).toHaveBeenCalledWith(18, 'SETTLED');
  });

  it('★ design_fix_v4 — delivery_type 누락(undefined) 시 dineIn 기본 → DINING (backwards-compat)', () => {
    const onAction = vi.fn();
    // delivery_type 명시 X 인 레거시 데이터/테스트 픽스처 회귀 보호.
    const orders = [mkOrder({ id: 19, no: 19, status: 'READY' })];
    render(
      <AdminCardColumn title="x" status="READY" orders={orders} tick={BASE_TICK} onAction={onAction} />,
    );
    const card = screen.getByTestId('admin-order-card-19');
    fireEvent.click(within(card).getByRole('button', { name: '전달 완료' }));
    expect(onAction).toHaveBeenCalledWith(19, 'DINING');
  });

  // ── DINING 컬럼 ──
  it('★ DINING 카드 버튼 라벨 "테이블 준비 완료" + to: "SETTLED" 호출', () => {
    const onAction = vi.fn();
    const orders = [mkOrder({ id: 20, no: 20, status: 'DINING', dining_at: '2026-05-20T17:20:00' })];
    render(
      <AdminCardColumn title="식사중" status="DINING" orders={orders} tick={BASE_TICK} onAction={onAction} />,
    );
    const card = screen.getByTestId('admin-order-card-20');
    const btn = within(card).getByRole('button', { name: '테이블 준비 완료' });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledWith(20, 'SETTLED');
  });

  it('★ DINING 카드 경과는 dining_at 기준으로 계산 (transferred_at 아님)', () => {
    // tick=17:30, dining_at=17:20 → 10분, transferred_at=17:28 → 2분
    const orders = [
      mkOrder({ id: 21, no: 21, status: 'DINING',
        dining_at: '2026-05-20T17:20:00',
        transferred_at: '2026-05-20T17:28:00' }),
    ];
    render(
      <AdminCardColumn title="식사중" status="DINING" orders={orders} tick={BASE_TICK} />,
    );
    expect(screen.getByText('10분 경과')).toBeInTheDocument();
  });

  it('★ DINING 카드 29분 미만 → border-divider (기본)', () => {
    // tick=17:30, dining_at=17:05 → 25분
    const orders = [
      mkOrder({ id: 22, no: 22, status: 'DINING', dining_at: '2026-05-20T17:05:00' }),
    ];
    render(
      <AdminCardColumn title="식사중" status="DINING" orders={orders} tick={BASE_TICK} />,
    );
    expect(screen.getByTestId('admin-order-card-22').className).toMatch(/border-divider/);
  });

  it('★ DINING 카드 30분 이상 59분 미만 → border-warning', () => {
    // tick=17:30, dining_at=16:55 → 35분
    const orders = [
      mkOrder({ id: 23, no: 23, status: 'DINING', dining_at: '2026-05-20T16:55:00' }),
    ];
    render(
      <AdminCardColumn title="식사중" status="DINING" orders={orders} tick={BASE_TICK} />,
    );
    expect(screen.getByTestId('admin-order-card-23').className).toMatch(/border-warning/);
  });

  it('★ DINING 카드 60분 이상 → border-danger', () => {
    // tick=17:30, dining_at=16:25 → 65분
    const orders = [
      mkOrder({ id: 24, no: 24, status: 'DINING', dining_at: '2026-05-20T16:25:00' }),
    ];
    render(
      <AdminCardColumn title="식사중" status="DINING" orders={orders} tick={BASE_TICK} />,
    );
    expect(screen.getByTestId('admin-order-card-24').className).toMatch(/border-danger/);
  });

  it('★ READY 카드 (대조) — 기존 5/10분 톤 유지 (회귀)', () => {
    // 5분 미만: border-divider
    const ordersDefault = [mkOrder({ id: 30, no: 30, status: 'READY', transferred_at: '2026-05-20T17:28:00' })];
    const { unmount } = render(
      <AdminCardColumn title="수령대기" status="READY" orders={ordersDefault} tick={BASE_TICK} />,
    );
    expect(screen.getByTestId('admin-order-card-30').className).toMatch(/border-divider/);
    unmount();

    // 5분 이상: border-warning
    const ordersWarn = [mkOrder({ id: 31, no: 31, status: 'READY', transferred_at: '2026-05-20T17:24:00' })];
    const { unmount: unmount2 } = render(
      <AdminCardColumn title="수령대기" status="READY" orders={ordersWarn} tick={BASE_TICK} />,
    );
    expect(screen.getByTestId('admin-order-card-31').className).toMatch(/border-warning/);
    unmount2();

    // 10분 이상: border-danger
    const ordersDanger = [mkOrder({ id: 32, no: 32, status: 'READY', transferred_at: '2026-05-20T17:19:00' })];
    render(
      <AdminCardColumn title="수령대기" status="READY" orders={ordersDanger} tick={BASE_TICK} />,
    );
    expect(screen.getByTestId('admin-order-card-32').className).toMatch(/border-danger/);
  });
});
