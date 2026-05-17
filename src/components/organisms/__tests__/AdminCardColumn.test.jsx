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
});
