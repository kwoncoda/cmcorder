// A-1 관리자 PIN 로그인 — design-bundle .login-shell + .login-box + 6-cell .pin-row + .pin-pad keypad.
//   * backend 6자리 PIN 호환 (design-bundle 4-cell → 6-cell 확장).
//   * shake state — 401 시 350ms.
//   * 테스트 회귀: testid="pin-input" hidden input + 로그인 button.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../../api/client.js';
import { API } from '../../api/routes.js';

const PIN_LENGTH = 6;
const KEYS = ['1','2','3','4','5','6','7','8','9','empty','0','back'];

export default function LoginPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [shake, setShake] = useState(false);

  const press = (d) => { if (pin.length >= PIN_LENGTH) return; setPin(pin + d); setError(null); };
  const back = () => { setPin((p) => p.slice(0, -1)); setError(null); };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (pin.length !== PIN_LENGTH) { setError(`PIN은 숫자 ${PIN_LENGTH}자리입니다.`); return; }
    setSubmitting(true); setError(null);
    try {
      await apiFetch(API.ADMIN_LOGIN, { method: 'POST', body: { pin } });
      navigate('/admin/dashboard');
    } catch (err) {
      setShake(true); setTimeout(() => setShake(false), 350); setPin('');
      if (err instanceof ApiError && err.status === 401) setError('PIN이 일치하지 않습니다');
      else setError(err instanceof ApiError ? err.message : '로그인에 실패했어요.');
    } finally { setSubmitting(false); }
  };

  return (
    <section data-testid="admin-login-page" className="login-shell">
      <form onSubmit={handleSubmit} className="login-box" noValidate>
        <div className="login-mark"><div className="brand-mark" aria-hidden="true" /></div>
        <div className="login-title">관리자 로그인</div>
        <div className="login-sub">PIN {PIN_LENGTH}자리를 입력하세요</div>

        <div role="group" className={`pin-row${shake ? ' shake' : ''}${submitting ? ' busy' : ''}`} aria-label="PIN 입력 상태">
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <div key={i} className={`pin-cell${pin.length > i ? ' filled' : ''}${error ? ' error' : ''}`}>
              {pin.length > i ? '●' : ''}
            </div>
          ))}
        </div>

        {error ? <div className="login-err" role="alert">{error}</div> : <div className="login-hint">PIN을 입력하고 로그인을 눌러주세요</div>}

        <div className="pin-pad" role="group" aria-label="PIN 키패드">
          {KEYS.map((k) => {
            if (k === 'empty') return <button key="empty" type="button" className="pin-key empty" disabled aria-hidden>·</button>;
            if (k === 'back') return <button key="back" type="button" className="pin-key" onClick={back} disabled={submitting} aria-label="지우기">⌫</button>;
            return <button key={k} type="button" className="pin-key" onClick={() => press(k)} disabled={submitting} aria-label={`숫자 ${k}`}>{k}</button>;
          })}
        </div>

        {/* 테스트 호환 hidden input — testid="pin-input" 으로 fireEvent.change 가능. */}
        <label htmlFor="pin-hidden" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' }}>PIN (6자리)</label>
        <input
          id="pin-hidden" data-testid="pin-input" type="text" inputMode="numeric" pattern="\d{6}" maxLength={PIN_LENGTH}
          autoComplete="off" value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)); setError(null); }}
          style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}
        />

        <button type="submit" className="btn btn-primary btn-lg btn-block" style={{ marginTop: 16 }}
          disabled={submitting || pin.length !== PIN_LENGTH} aria-label="로그인">
          {submitting ? '확인 중…' : '로그인'}
        </button>
      </form>
    </section>
  );
}
