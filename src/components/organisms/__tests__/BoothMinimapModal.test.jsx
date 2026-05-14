// Task 2.10 — BoothMinimapModal organism 단위 테스트.
// IMPLEMENTATION_PLAN §2.10 / G12 / 결정 e / 결정 h / UX §8.7.
//
// 회귀 보호 항목:
//   - open=false 시 렌더 X (null 반환)
//   - role=dialog + aria-modal=true + aria-labelledby (모달 a11y 기본)
//   - 4 닫기 방식 (결정 e — 4가지 모두):
//       하단 큰 닫기 버튼 → onClose('bottom-close')
//       상단 X 버튼       → onClose('top-x')
//       backdrop 클릭     → onClose('backdrop')
//       Esc 키            → onClose('escape')
//   - mapImage 미수령 시 CSS 그리드 fallback (4x4 = 16 셀)
//   - mapImage 있을 시 <img alt="부스 위치 약도"> + fallback X
//   - 본인 테이블 셀에 'booth-table-pulse' 클래스 (결정 h — 매번 재생)
//   - 다른 테이블 셀은 pulse 클래스 없음
//   - open 시 닫기 버튼에 포커스 (포커스 트랩 기본)
//   - close 시 이전 포커스 복귀 (cleanup)
//   - body scroll lock (overflow=hidden)
//   - a11y (axe)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import BoothMinimapModal from '../BoothMinimapModal.jsx';

afterEach(() => {
  // 테스트 간 body 스타일 누수 방지.
  document.body.style.overflow = '';
});

describe('BoothMinimapModal', () => {
  it('open=false 시 렌더 X (null)', () => {
    const { container } = render(
      <BoothMinimapModal open={false} myTableNo={5} onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('open=true 시 role=dialog + aria-modal=true + aria-labelledby', () => {
    render(<BoothMinimapModal open myTableNo={5} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'minimap-title');
  });

  it('★ 하단 큰 닫기 버튼 클릭 시 onClose("bottom-close") (결정 e)', () => {
    const onClose = vi.fn();
    render(<BoothMinimapModal open myTableNo={5} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('modal-close-bottom'));
    expect(onClose).toHaveBeenCalledWith('bottom-close');
  });

  it('상단 X 버튼 클릭 시 onClose("top-x")', () => {
    const onClose = vi.fn();
    render(<BoothMinimapModal open myTableNo={5} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('modal-close-top'));
    expect(onClose).toHaveBeenCalledWith('top-x');
  });

  it('외부(backdrop) 클릭 시 onClose("backdrop")', () => {
    const onClose = vi.fn();
    render(<BoothMinimapModal open myTableNo={5} onClose={onClose} />);
    // backdrop = dialog 컨테이너 자기 자신 (e.target === e.currentTarget).
    fireEvent.click(screen.getByTestId('booth-minimap-modal'));
    expect(onClose).toHaveBeenCalledWith('backdrop');
  });

  it('Esc 키 시 onClose("escape")', () => {
    const onClose = vi.fn();
    render(<BoothMinimapModal open myTableNo={5} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledWith('escape');
  });

  it('mapImage 미수령 시 CSS 그리드 fallback 표시 (4x4 = 16 셀)', () => {
    render(
      <BoothMinimapModal
        open
        myTableNo={5}
        gridSize={{ cols: 4, rows: 4 }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId('map-fallback-grid')).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell')).toHaveLength(16);
  });

  it('mapImage 있을 시 <img> 렌더 + 그리드 fallback X', () => {
    render(
      <BoothMinimapModal
        open
        myTableNo={5}
        mapImage="/map/booth.png"
        onClose={() => {}}
      />,
    );
    expect(screen.getByAltText('부스 위치 약도')).toBeInTheDocument();
    expect(screen.queryByTestId('map-fallback-grid')).not.toBeInTheDocument();
  });

  it('★ 본인 테이블 셀에 booth-table-pulse 클래스 (결정 h — 매번 재생)', () => {
    render(
      <BoothMinimapModal
        open
        myTableNo={5}
        gridSize={{ cols: 4, rows: 4 }}
        onClose={() => {}}
      />,
    );
    const myCell = screen.getByLabelText('내 테이블 5번');
    expect(myCell.className).toMatch(/booth-table-pulse/);
  });

  it('★ 다른 테이블 셀은 booth-table-pulse 클래스 없음', () => {
    render(
      <BoothMinimapModal
        open
        myTableNo={5}
        gridSize={{ cols: 4, rows: 4 }}
        onClose={() => {}}
      />,
    );
    const otherCell = screen.getByLabelText('3번 테이블');
    expect(otherCell.className).not.toMatch(/booth-table-pulse/);
  });

  it('★ 모달 open 시 하단 닫기 버튼에 포커스 (포커스 트랩 기본)', () => {
    render(<BoothMinimapModal open myTableNo={5} onClose={() => {}} />);
    expect(screen.getByTestId('modal-close-bottom')).toHaveFocus();
  });

  it('★ 모달 close 시 이전 포커스 복귀 (cleanup)', () => {
    const trigger = document.createElement('button');
    trigger.textContent = '맵 열기';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = render(
      <BoothMinimapModal open myTableNo={5} onClose={() => {}} />,
    );
    // open=false 로 rerender → useEffect cleanup 실행 → trigger 복귀.
    rerender(
      <BoothMinimapModal open={false} myTableNo={5} onClose={() => {}} />,
    );
    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });

  it('★ body scroll lock — open 시 overflow=hidden', () => {
    render(<BoothMinimapModal open myTableNo={5} onClose={() => {}} />);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('★ body scroll unlock — close 시 overflow 복귀', () => {
    document.body.style.overflow = 'auto';
    const { rerender } = render(
      <BoothMinimapModal open myTableNo={5} onClose={() => {}} />,
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <BoothMinimapModal open={false} myTableNo={5} onClose={() => {}} />,
    );
    expect(document.body.style.overflow).toBe('auto');
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(
      <BoothMinimapModal
        open
        myTableNo={5}
        gridSize={{ cols: 4, rows: 4 }}
        onClose={() => {}}
      />,
    );
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });
});
