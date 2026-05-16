// C-8 에러 페이지 — design-bundle ScreenError 정합 (.back-bar + .error-state).
// 테스트 호환 텍스트: "임무에서 사라졌어요" / "시스템 오류가 발생했어요" / "[code]" 대괄호 / Link "메뉴 화면으로".
import { Link, useNavigate } from 'react-router-dom';
import MascotState from '../../components/molecules/MascotState.jsx';

const ERROR_MESSAGES = {
  404: { title: '🪖 임무에서 사라졌어요',         description: '찾으시는 페이지가 없어요. URL을 다시 확인해 주세요.' },
  500: { title: '💥 시스템 오류가 발생했어요',     description: '잠시 후 다시 시도해 주세요. 문제가 계속되면 운영진에게 문의해 주세요.' },
};

export default function ErrorPage({ code = 404, message }) {
  const navigate = useNavigate();
  const errCode = Number(code) || 404;
  const errInfo = ERROR_MESSAGES[errCode] ?? ERROR_MESSAGES[404];

  return (
    <section data-testid="error-page" role="alert">
      <div className="back-bar">
        <button type="button" onClick={() => navigate('/menu')} aria-label="뒤로">←</button>
        <h1>오류</h1>
      </div>
      <div className="error-state">
        <MascotState state="canceled" size="lg" useFallback />
        <p className="font-mono tabular-nums text-xs text-muted">[{errCode}]</p>
        <h2 className="font-display font-black text-2xl">{errInfo.title}</h2>
        <p>{message ?? errInfo.description}</p>
        <Link to="/menu" className="btn btn-primary btn-lg" style={{ textDecoration: 'none' }}>
          🏠 메뉴 화면으로
        </Link>
      </div>
    </section>
  );
}
