// BoothMinimapModal — organism (IMPLEMENTATION_PLAN §2.10 / G12 / UX §8.7).
// PUBG 미니맵 풀스크린 모달 + 본인 테이블 펄스 + 4가지 닫기 방식.
//
// API:
//   <BoothMinimapModal
//     open={true}
//     myTableNo={5}                   // 본인 테이블 (1~totalTables) — 강조
//     mapImage="/map/booth-map.png"   // 미수령 시 undefined → CSS 그리드 fallback
//     gridSize={{ cols: 4, rows: 4 }} // fallback 크기 (기본 4x4 = 16)
//     onClose={(reason) => ...}       // reason: 'bottom-close' | 'top-x' | 'backdrop' | 'escape'
//   />
//
// 4가지 닫기 (결정 e):
//   1) 하단 큰 닫기 버튼 (sticky bottom, Button atom size=lg → ≥ 56px hitbox) — *주* 닫기 수단
//   2) 상단 X 버튼 — 보조 (UX 관습)
//   3) backdrop 클릭 — 외부 탭
//   4) Esc 키 — 키보드
//
// 결정 h:
//   - 본인 테이블 펄스는 매번 재생 (sessionStorage 등 상태 없음).
//   - reduced motion 시 components.css 가 정적 box-shadow 로 대체.
//
// 접근성:
//   - role="dialog" + aria-modal="true" + aria-labelledby="minimap-title"
//   - 모달 open 시: 직전 활성 요소 저장 → 닫기 버튼으로 포커스 이동.
//   - 모달 close 시: 직전 활성 요소로 포커스 복귀 (cleanup).
//   - body scroll lock — open 동안 overflow=hidden, close 시 복귀.
//   - 단순 포커스 트랩: 닫기 버튼 2개 + 닫기 X 만 focusable. 명시적 트랩은
//     focusable 요소가 한정적이라 OS/브라우저 기본 Tab 순환에 위임.
//
// 자산 fallback:
//   - mapImage 가 없으면 gridSize 만큼 CSS Grid 셀 렌더.
//   - 본인 테이블 셀: bg-accent + booth-table-pulse 클래스.
//   - 다른 셀: bg-elevated, pulse 없음.
//
// 구조 (리뷰 fix I-2):
//   - root <div> = 모달 wrapper. backdrop 클릭 핸들러는 별도 absolute 레이어에.
//   - 별도 backdrop 레이어 (absolute inset-0) — 클릭 시 onClose('backdrop').
//   - 콘텐츠 컨테이너 (relative z-10) — backdrop 위. 클릭은 backdrop으로 안 새어 나감.
//
// 관련 결정: G12 / 결정 e / 결정 h / UX §8.7.
import { useEffect, useRef, forwardRef } from 'react';
import Button from '../atoms/Button.jsx';

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

  // latest ref 패턴 (리뷰 fix I-1):
  // 부모가 onClose를 매 렌더 새 함수로 전달해도 effect가 재실행되지 않도록
  // ref로 latest 값을 추적. effect 의존성에서 onClose 제거 → open 변화 시에만 동작.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // 모달 open 시 — 포커스 저장 + 닫기 버튼으로 이동 + Esc 핸들러 + scroll lock.
  // close 시 cleanup 으로 모든 부수 효과 복귀.
  // 의존성은 [open]만 — onClose는 latest ref로 안전 (리뷰 fix I-1).
  useEffect(() => {
    if (!open) return undefined;

    // 1) 직전 활성 요소 저장.
    previousFocusRef.current = document.activeElement;

    // 2) 닫기 버튼으로 포커스 이동 (모달 진입 신호 — a11y).
    closeBtnRef.current?.focus();

    // 3) Esc 키 핸들러 — document 레벨 등록 (모달이 마운트되어 있는 동안만).
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current?.('escape');
      }
    };
    document.addEventListener('keydown', onKeyDown);

    // 4) body scroll lock — 모달 뒤 페이지가 스크롤되지 않도록.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      // 포커스 복귀 — 직전 활성 요소가 여전히 DOM 에 있고 focus 메서드를 가질 때만.
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === 'function'
      ) {
        previousFocusRef.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  const cols = gridSize.cols ?? 4;
  const rows = gridSize.rows ?? 4;

  return (
    <div
      ref={ref ?? dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="minimap-title"
      data-testid="booth-minimap-modal"
      className={[
        'fixed inset-0 z-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {/* Backdrop 레이어 (리뷰 fix I-2) — 콘텐츠 뒤. 클릭 시 onClose('backdrop').
          별도 absolute 레이어로 분리해 콘텐츠 클릭이 backdrop으로 새지 않게 한다. */}
      <div
        aria-hidden="true"
        onClick={() => onClose?.('backdrop')}
        className="absolute inset-0 bg-black/80"
        data-testid="modal-backdrop"
      />

      {/* 콘텐츠 컨테이너 — backdrop 위 (relative z-10).
          pointer-events-none 으로 빈 영역(main의 padding 외)은 backdrop 클릭이 통과.
          각 자식(header/main/footer)은 pointer-events-auto 로 자체 클릭 받음. */}
      <div className="relative z-10 flex flex-col h-full pointer-events-none">
        {/* 상단 X 버튼 (보조 닫기 — UX 관습) */}
        <header className="flex items-center justify-between p-md bg-bg/90 pointer-events-auto">
          <h2
            id="minimap-title"
            className="font-display font-bold text-lg text-ink"
          >
            🗺️ 부스 약도
          </h2>
          <button
            type="button"
            onClick={() => onClose?.('top-x')}
            aria-label="모달 닫기"
            data-testid="modal-close-top"
            className="w-8 h-8 flex items-center justify-center rounded-md text-ink hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            ✕
          </button>
        </header>

        {/* 본문 — 약도 이미지 또는 CSS 그리드 fallback.
            pointer-events-auto — 본문 콘텐츠 클릭이 backdrop으로 새지 않음. */}
        <div className="flex-1 flex items-center justify-center p-md overflow-auto pointer-events-auto">
          {mapImage ? (
            <div className="relative">
              <img
                src={mapImage}
                alt="부스 위치 약도"
                className="max-w-full max-h-full object-contain"
              />
              {/* 이미지 모드 — 본인 테이블 위치는 자산 수령 후 좌표 결정.
                  현재는 펄스 동작 자체만 회귀 — 임시로 정중앙에 마커. */}
              {myTableNo && (
                <div
                  className="absolute booth-table-pulse"
                  style={{
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                  aria-label={`내 테이블 ${myTableNo}번`}
                >
                  <div className="w-12 h-12 rounded-full bg-accent/30 border-2 border-accent flex items-center justify-center text-card-ink font-bold">
                    {myTableNo}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* CSS 그리드 fallback — 자산 미수령 시 (이미지 D-1 수령 예정).
               axe aria-required-parent: gridcell 은 row 부모 필수. row 를 행 단위로 래핑. */
            <div
              role="grid"
              aria-label="부스 테이블 그리드 약도 (이미지 fallback)"
              className="grid gap-sm p-md bg-card-bg rounded-md"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
              data-testid="map-fallback-grid"
            >
              {Array.from({ length: rows }, (_, rowIdx) => (
                <div
                  key={`row-${rowIdx}`}
                  role="row"
                  className="contents"
                >
                  {Array.from({ length: cols }, (_, colIdx) => {
                    const tableNo = rowIdx * cols + colIdx + 1;
                    const isMine = tableNo === myTableNo;
                    return (
                      <div
                        key={tableNo}
                        role="gridcell"
                        aria-label={
                          isMine
                            ? `내 테이블 ${tableNo}번`
                            : `${tableNo}번 테이블`
                        }
                        className={[
                          'aspect-square flex items-center justify-center rounded-md font-display font-bold text-base',
                          isMine
                            ? 'bg-accent text-card-ink booth-table-pulse'
                            : 'bg-elevated text-ink',
                        ].join(' ')}
                      >
                        {tableNo}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 하단 큰 닫기 버튼 — 결정 e *주* 닫기 수단 (sticky bottom, ≥ 56px hitbox) */}
        <footer className="p-md bg-bg/90 border-t border-divider pointer-events-auto">
          <Button
            ref={closeBtnRef}
            variant="primary"
            size="lg"
            block
            onClick={() => onClose?.('bottom-close')}
            data-testid="modal-close-bottom"
          >
            닫기
          </Button>
        </footer>
      </div>
    </div>
  );
});

export default BoothMinimapModal;
