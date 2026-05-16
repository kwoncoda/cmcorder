// BoothMinimapModal — design-bundle .modal-backdrop + .minimap + .entrance + .table.mine 정합.
// 4가지 닫기 (bottom-close · top-x · backdrop · escape) 유지. testid 보존.
import { useEffect, useRef, forwardRef } from 'react';

const BoothMinimapModal = forwardRef(function BoothMinimapModal(
  {
    open,
    myTableNo,
    mapImage,
    gridSize = { cols: 4, rows: 4 },
    onClose,
    className = '',
    ...rest
  },
  ref,
) {
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    closeBtnRef.current?.focus();
    const root = dialogRef.current;
    const focusableSel = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current?.('escape'); return; }
      // focus trap — Tab/Shift+Tab 시 modal 내부 순환 (WIG: keyboard containment).
      if (e.key === 'Tab' && root) {
        const focusable = Array.from(root.querySelectorAll(focusableSel)).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (focusable.length === 0) { e.preventDefault(); return; }
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;
  const cols = gridSize.cols ?? 4;
  const rows = gridSize.rows ?? 4;
  const totalTables = cols * rows;

  return (
    <div
      ref={ref ?? dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="minimap-title"
      data-testid="booth-minimap-modal"
      className={`modal-backdrop ${className}`.trim()}
      style={{ position: 'fixed', inset: 0 }}
      {...rest}
    >
      <div
        aria-hidden="true"
        onClick={() => onClose?.('backdrop')}
        className="absolute inset-0"
        style={{ position: 'absolute', inset: 0, background: 'transparent' }}
        data-testid="modal-backdrop"
      />
      <div className="modal-head" style={{ position: 'relative', zIndex: 10 }}>
        <h2 id="minimap-title">🗺️ 부스 약도</h2>
        <button
          type="button"
          onClick={() => onClose?.('top-x')}
          aria-label="모달 닫기"
          data-testid="modal-close-top"
          className="icon-btn"
        >
          ✕
        </button>
      </div>
      <div className="modal-body" style={{ position: 'relative', zIndex: 10 }}>
        {mapImage ? (
          <div style={{ position: 'relative' }}>
            <img src={mapImage} alt="부스 위치 약도" style={{ maxWidth: '100%', height: 'auto' }} width="640" height="480" loading="lazy" />
            {myTableNo && (
              <div
                className="booth-table-pulse"
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
                aria-label={`내 테이블 ${myTableNo}번`}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'rgba(244,210,0,0.3)',
                  border: '2px solid var(--color-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--stamp-black)', fontWeight: 700,
                }}>
                  {myTableNo}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="minimap">
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)',
              letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between',
            }}>
              <span>BOOTH · A-12</span>
              <span>NORTH ↑</span>
            </div>
            <div
              role="grid"
              aria-label="부스 테이블 그리드 약도"
              className="grid"
              data-testid="map-fallback-grid"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: rows }, (_, rowIdx) => (
                <div key={`row-${rowIdx}`} role="row" className="contents">
                  {Array.from({ length: cols }, (_, colIdx) => {
                    const tableNo = rowIdx * cols + colIdx + 1;
                    const isMine = tableNo === myTableNo;
                    return (
                      <div
                        key={tableNo}
                        role="gridcell"
                        aria-label={isMine ? `내 테이블 ${tableNo}번` : `${tableNo}번 테이블`}
                        className={`table ${isMine ? 'mine booth-table-pulse' : ''}`}
                      >
                        T{tableNo}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="entrance">🚪 ENTRANCE</div>
          </div>
        )}
        <div className="minimap-legend">
          <div>내 테이블: <strong>{myTableNo ? `#${myTableNo}` : '— (포장 또는 일반)'}</strong></div>
          <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>
            {myTableNo
              ? '형광 옐로 박스가 본인 자리예요.'
              : `총 ${totalTables}개 테이블`}
          </div>
        </div>
      </div>
      <footer className="modal-foot" style={{ position: 'relative', zIndex: 10 }}>
        <button
          ref={closeBtnRef}
          type="button"
          className="btn btn-primary btn-lg btn-block"
          onClick={() => onClose?.('bottom-close')}
          data-testid="modal-close-bottom"
        >
          닫기
        </button>
      </footer>
    </div>
  );
});

export default BoothMinimapModal;
