// Task 7.3 — KeyboardHelpModal organism 단위 테스트.
// 결정 D (단축키 4종 안내 모달).
//
// 회귀 보호 항목:
//   - open=false 시 렌더 X
//   - open=true 시 dialog + 4개 단축키 표시
//   - Esc 키 → onClose 호출
//   - backdrop 클릭 → onClose 호출
//   - 닫기 버튼 클릭 → onClose 호출
//   - a11y (axe)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { axe } from 'vitest-axe';
import KeyboardHelpModal from '../KeyboardHelpModal.jsx';

afterEach(() => cleanup());

describe('KeyboardHelpModal', () => {
  it('open=false 시 렌더되지 않는다', () => {
    const { container } = render(<KeyboardHelpModal open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('open=true 시 dialog + 4개 단축키(Enter/Esc/Tab/?) 렌더', () => {
    render(<KeyboardHelpModal open onClose={() => {}} />);
    const dialog = screen.getByTestId('keyboard-help-modal');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'help-title');
    expect(dialog.textContent).toMatch(/Enter/);
    expect(dialog.textContent).toMatch(/Esc/);
    expect(dialog.textContent).toMatch(/Tab/);
    expect(dialog.textContent).toMatch(/\?/);
  });

  it('★ Esc 키 → onClose 호출', () => {
    const onClose = vi.fn();
    render(<KeyboardHelpModal open onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop(검은 버튼) 클릭 → onClose 호출', () => {
    const onClose = vi.fn();
    render(<KeyboardHelpModal open onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('단축키 안내 닫기'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('닫기 버튼 클릭 → onClose 호출', () => {
    const onClose = vi.fn();
    render(<KeyboardHelpModal open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(<KeyboardHelpModal open onClose={() => {}} />);
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });
});
