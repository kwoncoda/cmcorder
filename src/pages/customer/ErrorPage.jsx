// C-8 에러 페이지 placeholder.
// - 404 (라우트 catch-all) 와 500 (ErrorBoundary fallback) 양쪽에서 재사용.
// - props: { code?: number, message?: string } — 미지정 시 404 기본.
// 실제 에러 UI(이미지·재시도·홈 이동)는 Phase 4.8에서 채운다.
export default function ErrorPage({ code, message }) {
  const displayCode = code ?? 404;
  return (
    <div data-testid="error-page">
      <p>오류 — {displayCode}</p>
      {message ? <p data-testid="error-message">{message}</p> : null}
    </div>
  );
}
