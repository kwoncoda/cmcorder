// Task 2.7 — AdminCardColumn organism 단위 테스트.
// IMPLEMENTATION_PLAN §2.7 / §3.5 6조·7조 / ADR-021.
//
// 회귀 보호 항목:
//   - title + 카운트 표시
//   - orders 빈 배열 시 "비어 있음" 표시
//   - orders 목록 → OrderCard 렌더 (key=order.id, data-testid=admin-order-card-<id>)
//   - 5분 이상 경과 시 noteworthy 색 (border-warning)
//   - 10분 이상 경과 시 danger 색 (border-danger)
//   - 5분 미만은 기본 (border-divider)
//   - 카드 클릭 시 onSelectOrder(order.id) 호출
//   - ★ React.memo 회귀 — OrderCard는 React.memo로 감싸졌다 ($$typeof=react.memo)
//   - forwardRef 로 section 참조 전달
//   - a11y (axe)
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
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

  it('orders 비어있을 때 "비어 있음" 표시', () => {
    render(
      <AdminCardColumn
        title="이체 확인"
        status="TRANSFER_REPORTED"
        orders={[]}
        tick={BASE_TICK}
      />,
    );
    expect(screen.getByText('비어 있음')).toBeInTheDocument();
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

  it('카드 클릭 시 onSelectOrder(order.id) 호출', () => {
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
    fireEvent.click(screen.getByTestId('admin-order-card-17'));
    expect(onSelectOrder).toHaveBeenCalledWith(17);
  });

  it('depositorName 없을 때 "(이름 없음)" 표시', () => {
    const orders = [mkOrder({ id: 17, no: 17, depositorName: null })];
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

  // ★ React.memo 회귀 — OrderCard가 memo로 감싸져 있는지 검증 (§3.5 7조).
  // memo 결과는 { $$typeof: Symbol.for('react.memo'), type: ... } 객체.
  it('★ OrderCard는 React.memo로 감싸져 있다 (§3.5 7조)', () => {
    expect(typeof OrderCard).toBe('object');
    expect(OrderCard.$$typeof).toBeDefined();
    expect(OrderCard.$$typeof.toString()).toMatch(/react\.memo/);
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
