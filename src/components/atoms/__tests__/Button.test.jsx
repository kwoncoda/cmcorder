// Task 1.1 — Button atom 단위 테스트.
// COMPONENT_GUIDE.md §2.1 / DESIGN.md §12.3 (focus-visible) 기준.
// 5 variant(primary/secondary/ghost/danger + disabled prop) · 3 size(sm/md/lg).
// 모바일 hitbox: sm 44px · md 48px · lg 56px (DESIGN — 44px 미만 금지).
// loading 시 aria-busy=true + spinner + onClick 차단.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import Button from '../Button.jsx';

describe('Button', () => {
  it.each(['primary', 'secondary', 'ghost', 'danger'])(
    '%s variant 가 렌더된다',
    (variant) => {
      render(<Button variant={variant}>버튼</Button>);
      expect(screen.getByRole('button', { name: '버튼' })).toBeInTheDocument();
    },
  );

  it.each([
    ['sm', '44'],
    ['md', '48'],
    ['lg', '56'],
  ])('size %s 는 min-height %spx 클래스를 갖는다', (size, height) => {
    render(<Button size={size}>버튼</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(new RegExp(`min-h-\\[${height}px\\]`));
  });

  it('click 시 onClick 콜백을 호출한다', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>버튼</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled 시 onClick 이 호출되지 않는다', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        버튼
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading 시 disabled 자동 + aria-busy=true + spinner 표시 + onClick 차단', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        버튼
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    // 자식 텍스트 대신 spinner — 텍스트가 안 보여야 한다.
    expect(screen.queryByText('버튼')).not.toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('block prop 시 w-full 클래스가 적용된다', () => {
    render(<Button block>버튼</Button>);
    expect(screen.getByRole('button').className).toMatch(/\bw-full\b/);
  });

  it('forwardRef 로 DOM 참조를 전달한다', () => {
    const ref = createRef();
    render(<Button ref={ref}>버튼</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('기본값은 variant=primary, size=md, type=button 이다', () => {
    render(<Button>버튼</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('type', 'button');
    // primary 는 bg-accent 클래스 매칭.
    expect(btn.className).toMatch(/\bbg-accent\b/);
    // 기본 size=md → min-h-[48px].
    expect(btn.className).toMatch(/min-h-\[48px\]/);
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(<Button>레이블이 있는 버튼</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('passthrough props (aria-label, data-testid) 가 button 으로 전달된다', () => {
    render(
      <Button aria-label="주문 접수" data-testid="submit-btn">
        버튼
      </Button>,
    );
    const btn = screen.getByTestId('submit-btn');
    expect(btn).toHaveAttribute('aria-label', '주문 접수');
  });

  it('type=submit 을 명시하면 그대로 전달된다', () => {
    render(<Button type="submit">제출</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('focus-visible 토큰(outline-accent) 클래스가 적용된다 — DESIGN §12.3', () => {
    render(<Button>버튼</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/focus-visible:outline-accent/);
    expect(btn.className).toMatch(/focus-visible:outline-offset-2/);
  });
});
