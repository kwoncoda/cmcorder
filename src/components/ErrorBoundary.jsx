// 전역 에러 경계 (React 18 class component — error boundary는 함수형 hook 미지원).
// - fallback: ReactNode 또는 함수형 `({ error }) => ReactNode`.
//   함수형으로 넘기면 에러를 props 로 전달 받아 표시할 수 있다.
// - children 내부의 렌더링/생명주기/생성자 에러를 잡아 fallback 으로 대체.
// - 이벤트 핸들러·비동기 콜백 안의 에러는 잡지 못한다 (React 공식 한계).
// - 로깅은 일단 console.error. Phase 3.4 에서 pino 가 도입되면 갈음한다.
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Phase 3.4 pino 로깅으로 대체 예정.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    const { hasError, error } = this.state;
    const { fallback, children } = this.props;
    if (!hasError) return children;
    return typeof fallback === 'function' ? fallback({ error }) : fallback;
  }
}
