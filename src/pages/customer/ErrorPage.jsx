// C-8 에러 페이지 — Task 4.9.
//
// 404 (라우트 catch-all) + 500 (ErrorBoundary fallback) 양쪽에서 재사용.
// MascotState canceled 변형(😢) + 메시지 + 홈 CTA (§3.5 1조 — 페이지 ≤120줄).
//
// props:
//   - code: 404 (기본) 또는 500. 미지정 시 404.
//   - message: 커스텀 description. 미지정 시 기본 카피.
import { Link } from 'react-router-dom';
import MascotState from '../../components/molecules/MascotState.jsx';
import Button from '../../components/atoms/Button.jsx';

// 모듈 최상위 SoT — §3.5 6조.
const ERROR_MESSAGES = {
  404: {
    title: '🪖 임무에서 사라졌어요',
    description: '찾으시는 페이지가 없어요. URL을 다시 확인해 주세요.',
  },
  500: {
    title: '💥 시스템 오류가 발생했어요',
    description: '잠시 후 다시 시도해 주세요. 문제가 계속되면 운영진에게 문의해 주세요.',
  },
};

export default function ErrorPage({ code = 404, message }) {
  // 알 수 없는 code → 404 fallback.
  const errCode = Number(code) || 404;
  const errInfo = ERROR_MESSAGES[errCode] ?? ERROR_MESSAGES[404];

  return (
    <section
      data-testid="error-page"
      role="alert"
      className="min-h-screen flex flex-col items-center justify-center gap-md p-lg bg-bg text-ink text-center"
    >
      <MascotState state="canceled" size="lg" useFallback />
      <p className="font-mono tabular-nums text-xs text-muted">[{errCode}]</p>
      <h1 className="font-display font-black text-2xl">{errInfo.title}</h1>
      <p className="text-sm text-muted max-w-prose">{message ?? errInfo.description}</p>
      <Link to="/menu">
        <Button variant="primary" size="lg">🏠 메뉴 화면으로</Button>
      </Link>
    </section>
  );
}
