// Task 2.10 — BoothMinimapModal organism 단위 테스트.
// IMPLEMENTATION_PLAN §2.10 / G12 / 결정 e / 결정 h / UX §8.7.
//
// 회귀 보호 항목:
//   - open=false 시 렌더 X (null 반환)
//   - role=dialog + aria-modal=true + aria-labelledby (모달 a11y 기본)
//   - 3 닫기 방식 (하단 큰 닫기 버튼은 2026-05-19 design_fix_v2 후속에서 제거):
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

  it('상단 X 버튼 클릭 시 onClose("top-x")', () => {
    const onClose = vi.fn();
    render(<BoothMinimapModal open myTableNo={5} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('modal-close-top'));
    expect(onClose).toHaveBeenCalledWith('top-x');
  });

  it('★ 외부 backdrop 클릭 시 onClose("backdrop") — 별도 backdrop 레이어 (리뷰 fix I-2)', () => {
    const onClose = vi.fn();
    render(<BoothMinimapModal open myTableNo={5} onClose={onClose} />);
    // backdrop 은 별도 absolute 레이어 (data-testid="modal-backdrop").
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledWith('backdrop');
  });

  it('★ 콘텐츠 영역(modal-head) 클릭은 backdrop 닫기 발동 X (리뷰 fix I-2)', () => {
    const onClose = vi.fn();
    render(<BoothMinimapModal open myTableNo={5} onClose={onClose} />);
    // 모달 콘텐츠 영역 클릭은 backdrop 으로 새지 않아야 한다.
    const head = screen.getByText(/테이블 지도/).closest('.modal-head');
    fireEvent.click(head);
    // backdrop reason 으로 호출되지 않아야 함 (다른 reason 은 무관).
    expect(onClose).not.toHaveBeenCalledWith('backdrop');
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

  it('★ 모달 open 시 상단 X 버튼에 포커스 (포커스 트랩 기본)', () => {
    render(<BoothMinimapModal open myTableNo={5} onClose={() => {}} />);
    expect(screen.getByTestId('modal-close-top')).toHaveFocus();
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

  it('★ 부모가 onClose 를 매 렌더 새 함수로 전달해도 effect 재실행 X (리뷰 fix I-1)', () => {
    // 안티패턴 부모 시뮬: 매 렌더 새 onClose 함수 — latest ref 패턴 검증.
    function Parent({ open }) {
      return (
        <BoothMinimapModal
          open={open}
          myTableNo={5}
          onClose={() => {}}
        />
      );
    }
    const { rerender } = render(<Parent open={true} />);
    // 최초 마운트: 닫기 버튼 포커스 + body overflow=hidden.
    expect(screen.getByTestId('modal-close-top')).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');

    // 다른 요소로 포커스 이동 — effect 가 재실행되면 다시 닫기 버튼으로 끌려감.
    const otherBtn = document.createElement('button');
    otherBtn.textContent = '딴 곳';
    document.body.appendChild(otherBtn);
    otherBtn.focus();
    expect(document.activeElement).toBe(otherBtn);

    // rerender 여러 번 — 매 렌더 새 onClose, effect 가 재실행되면 안 됨.
    rerender(<Parent open={true} />);
    rerender(<Parent open={true} />);
    rerender(<Parent open={true} />);

    // 검증 1: 포커스가 그대로 유지 (effect 재실행 X → 닫기 버튼으로 안 끌려감).
    expect(document.activeElement).toBe(otherBtn);
    // 검증 2: body overflow 그대로 'hidden' (effect cleanup → reapply 흔적 X).
    expect(document.body.style.overflow).toBe('hidden');

    document.body.removeChild(otherBtn);
  });

  it('★ Esc 키 핸들러는 항상 최신 onClose 사용 (latest ref — 리뷰 fix I-1)', () => {
    // 부모가 onClose 를 교체해도 Esc 핸들러는 최신 콜백을 호출해야 한다.
    const firstOnClose = vi.fn();
    const secondOnClose = vi.fn();
    const { rerender } = render(
      <BoothMinimapModal open myTableNo={5} onClose={firstOnClose} />,
    );
    // 첫 onClose 교체 — effect 는 재실행되면 안 되지만 ref 는 최신을 가리킨다.
    rerender(
      <BoothMinimapModal open myTableNo={5} onClose={secondOnClose} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    // 최신 onClose 만 호출되어야 함.
    expect(firstOnClose).not.toHaveBeenCalled();
    expect(secondOnClose).toHaveBeenCalledWith('escape');
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
