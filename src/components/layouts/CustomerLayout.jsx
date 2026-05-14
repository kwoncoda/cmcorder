// CustomerLayout — Task 4.1.
//
// 사용자 페이지 공통 레이아웃:
//  - 헤더 (로고 + 🗺️ 지도 아이콘)
//  - 본문은 React Router 6 <Outlet/> 로 자식 라우트 렌더
//  - 423 BusinessClosedError 글로벌 catch → /closed redirect (결정 i, G13)
//
// 영업 가드 — 폴링 X, 단일 reactive 진입점 (USER_FLOW §3.5 3조):
//  - 60초 폴링은 비효율 — 200명 동시 접속 시 분당 200req 의미 없는 트래픽.
//  - Task 6.8 middleware 가 모든 POST 를 423 으로 거부 → 어떤 API 호출이든 423 = CLOSED 즉시 감지.
//  - useGlobalErrorHandler 가 unhandledrejection 에서 BusinessClosedError 를 catch → navigate('/closed').
//  - 진행 중 주문 페이지(/orders/:id/{complete,transfer,status}) 에서는 redirect X.
//    이미 PAID/READY/DONE 등 정산 가드 통과 상태 — 영업 종료와 무관하게 사용자가 자기 주문은 봐야 함.
import { useNavigate, useLocation, Outlet, Link } from 'react-router-dom';
import { useCallback } from 'react';
import { Map } from 'lucide-react';
import { useGlobalErrorHandler } from '../../hooks/useGlobalErrorHandler.js';
import Icon from '../atoms/Icon.jsx';

// 진행 중 주문 페이지인지 (redirect 보호 대상).
// 경로 패턴: /orders/<숫자>/{complete|transfer|status}.
function isOrderInProgressPath(pathname) {
  return /^\/orders\/\d+\/(complete|transfer|status)$/.test(pathname);
}

export default function CustomerLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // useGlobalErrorHandler 의 useEffect 의존성에 안정적인 함수를 넘기기 위해 useCallback.
  // location.pathname 이 바뀔 때만 새 핸들러 생성 → 리스너 재등록.
  const handleBusinessClosed = useCallback(() => {
    if (isOrderInProgressPath(location.pathname)) {
      // 진행 중 주문 페이지는 redirect X — 정산 가드 통과한 주문 보호.
      return;
    }
    navigate('/closed', { replace: true });
  }, [navigate, location.pathname]);

  useGlobalErrorHandler({ onBusinessClosed: handleBusinessClosed });

  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink">
      <header className="flex items-center justify-between p-md bg-elevated">
        <Link to="/menu" className="font-display font-bold text-lg">
          🍗 치킨이닭
        </Link>
        <Link
          to="/map"
          aria-label="부스 약도 열기"
          className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-divider focus-visible:outline-2 focus-visible:outline-accent"
          data-testid="header-map-link"
        >
          <Icon decorative>
            <Map size={20} />
          </Icon>
        </Link>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
