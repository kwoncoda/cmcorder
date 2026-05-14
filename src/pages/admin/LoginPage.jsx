// A-1 관리자 PIN 로그인.
// - POST /admin/login → 세션 쿠키 (서버가 Set-Cookie)
// - 실패 시 인라인 메시지 (토스트 X — UX-1)
// - 정상 시 /admin/dashboard 이동
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../../api/client.js';
import { API } from '../../api/routes.js';
import Label from '../../components/atoms/Label.jsx';
import Input from '../../components/atoms/Input.jsx';
import Button from '../../components/atoms/Button.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      setError('PIN은 숫자 6자리입니다.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(API.ADMIN_LOGIN, { method: 'POST', body: { pin } });
      navigate('/admin/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('PIN이 일치하지 않습니다');
      } else {
        setError(err instanceof ApiError ? err.message : '로그인에 실패했어요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      data-testid="admin-login-page"
      className="min-h-screen flex flex-col items-center justify-center gap-md p-lg bg-bg text-ink"
    >
      <header className="text-center">
        <h1 className="font-display font-black text-3xl">🔐 본부 로그인</h1>
        <p className="text-sm text-muted mt-2xs">관리자 PIN을 입력해 주세요.</p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-md w-full max-w-sm" noValidate>
        <div>
          <Label htmlFor="pin" required>PIN (6자리)</Label>
          <Input
            id="pin"
            type="password"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="off"
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(null); }}
            invalid={!!error}
            errorMessage={error ?? ''}
            data-testid="pin-input"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          loading={submitting}
          disabled={pin.length !== 6}
        >
          로그인
        </Button>
      </form>
    </section>
  );
}
