// SettlementBackupCard — organism (adjustment 라운드 Subagent 4).
//
// ZIP 백업 카드 — design-bundle .settle-card (screens-admin.jsx:703-722).
//
// 책임:
//   - GET /admin/api/backups?limit=3 호출 → 최근 자동 백업 목록.
//   - 마지막 자동 백업 시각 + 상대 시간 표시.
//   - 수동 다운로드 버튼 → onManualDownload() 호출 (페이지가 ZIP URL 구성).
//   - 백업 row 클릭 → window.open `/admin/api/backups/${encodeURIComponent(name)}`.
//   - canDownloadManual=false (합산 모드) → 버튼 disabled + 안내 메시지.
//
// 회귀:
//   - data-testid="settlement-backup-card" / "download-zip-btn" / "backup-item-N".
import { forwardRef } from 'react';
import { useApi } from '../../../hooks/useApi.js';
import { apiFetch } from '../../../api/client.js';
import { API } from '../../../api/routes.js';
import Button from '../../atoms/Button.jsx';

const MB = 1024 * 1024;

// 상대 시간 — "방금" / "N분 전" / "N시간 전" / "MM/DD HH:mm" 폴백.
function relativeTime(mtimeIso, now = new Date()) {
  const t = new Date(mtimeIso).getTime();
  if (!Number.isFinite(t)) return '—';
  const deltaSec = Math.max(0, Math.floor((now.getTime() - t) / 1000));
  if (deltaSec < 60) return '방금';
  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}분 전`;
  const deltaHr = Math.floor(deltaMin / 60);
  if (deltaHr < 24) return `${deltaHr}시간 전`;
  const d = new Date(mtimeIso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

function shortTimeLabel(mtimeIso, now = new Date()) {
  const d = new Date(mtimeIso);
  if (!Number.isFinite(d.getTime())) return '—';
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `${hh}:${mi}`;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

function formatSizeMB(bytes) {
  if (!bytes || bytes <= 0) return '0.0 MB';
  return `${(bytes / MB).toFixed(1)} MB`;
}

const SettlementBackupCard = forwardRef(function SettlementBackupCard(
  { canDownloadManual = true, onManualDownload },
  ref,
) {
  const { data: backups } = useApi(
    ({ signal }) => apiFetch(`${API.ADMIN_BACKUPS}?limit=3`, { signal }),
    [],
  );
  const list = Array.isArray(backups) ? backups : [];
  const latest = list[0] ?? null;
  const now = new Date();

  return (
    <section
      ref={ref}
      data-testid="settlement-backup-card"
      className="settle-card bg-elevated rounded-md p-md flex flex-col gap-sm"
      aria-label="ZIP 백업"
    >
      <div className="text-xs text-accent font-semibold uppercase tracking-wide">ZIP 백업</div>
      <p className="text-sm text-muted">
        마지막 자동 백업:{' '}
        {latest ? (
          <b className="text-ink">
            {shortTimeLabel(latest.mtime, now)} ({relativeTime(latest.mtime, now)})
          </b>
        ) : (
          <b className="text-ink">아직 자동 백업이 없어요</b>
        )}
      </p>

      <Button
        variant="primary"
        size="md"
        block
        disabled={!canDownloadManual}
        onClick={() => canDownloadManual && onManualDownload?.()}
        data-testid="download-zip-btn"
      >
        수동 백업 다운로드
      </Button>
      {!canDownloadManual && (
        <p className="text-xs text-muted">
          단일 일자 선택 후 다운로드할 수 있어요.
        </p>
      )}

      {list.length > 0 && (
        <ul className="flex flex-col gap-xs mt-sm" aria-label="최근 자동 백업">
          {list.map((b) => (
            <li key={b.name} className="border-t border-dashed border-divider pt-xs text-xs">
              <button
                type="button"
                data-testid={`backup-item-${b.name}`}
                className="w-full flex justify-between hover:bg-bg/40 px-1"
                onClick={() => window.open(`/admin/api/backups/${encodeURIComponent(b.name)}`, '_blank')}
              >
                <span className="font-mono tabular-nums text-muted">{shortTimeLabel(b.mtime, now)} auto</span>
                <span className="text-muted">{formatSizeMB(b.size_bytes)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});

export default SettlementBackupCard;
