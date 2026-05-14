// KeyboardHelpModal — organism (Task 7.3 / 결정 D · 단축키 4종).
//
// 관리자 대시보드의 키보드 단축키 안내 모달.
//
// API:
//   <KeyboardHelpModal open={showHelp} onClose={() => setShowHelp(false)} />
//
// 단축키 (결정 D):
//   - Enter : 카드(버튼) 선택   (브라우저 기본 — 안내만)
//   - Esc   : 모달 닫기          (이 모달이 처리)
//   - Tab   : 포커스 이동        (브라우저 기본 — 안내만)
//   - ?     : 이 안내 열기/닫기 (DashboardPage가 토글)
//
// 접근성:
//   - role="dialog" + aria-modal="true" + aria-labelledby="help-title"
//   - Esc 키로 닫힘 (document keydown).
//   - backdrop 클릭으로 닫힘.
//   - reduced motion: components.css의 transition 단축 정책 따름 (별도 모션 없음).
import { useEffect, useRef } from 'react';
import Button from '../atoms/Button.jsx';

const SHORTCUTS = [
  { keys: ['Enter'], label: '카드 선택' },
  { keys: ['Esc'], label: '모달 닫기' },
  { keys: ['Tab'], label: '포커스 이동' },
  { keys: ['?'], label: '이 안내 열기/닫기' },
];

export default function KeyboardHelpModal({ open, onClose }) {
  const closeBtnRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    closeBtnRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      data-testid="keyboard-help-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-md"
    >
      <button
        type="button"
        aria-label="단축키 안내 닫기"
        className="absolute inset-0 bg-black/80"
        onClick={() => onClose?.()}
      />
      <div className="relative z-10 bg-elevated rounded-md p-md max-w-md w-full shadow-card">
        <h2 id="help-title" className="font-display font-bold text-lg mb-sm">
          키보드 단축키
        </h2>
        <ul className="text-sm flex flex-col gap-xs">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center gap-sm">
              <kbd className="font-mono text-xs px-xs py-2xs bg-bg border border-divider rounded">
                {s.keys.join(' + ')}
              </kbd>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-md flex justify-end">
          <Button ref={closeBtnRef} variant="ghost" size="md" onClick={() => onClose?.()}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}
