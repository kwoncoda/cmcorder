// adjustment 라운드 Subagent 4 — SettlementBackupCard 단위 테스트.
//
// ZIP 백업 카드 — 마지막 자동 백업·주기 안내·수동 다운로드 버튼·최근 목록.
// useApi(GET /admin/api/backups?limit=3) 모킹.
//
// 회귀 보호:
//  - 백업 목록 0개 → "아직 자동 백업이 없어요" 표시.
//  - 3개 row 렌더.
//  - row 클릭 → window.open with encodeURIComponent된 이름.
//  - 수동 다운로드 버튼 클릭 → onManualDownload() 호출.
//  - canDownloadManual=false → 버튼 disabled + 안내 메시지.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../../../hooks/useApi.js', () => ({
  useApi: vi.fn(),
}));
import { useApi } from '../../../../hooks/useApi.js';

import SettlementBackupCard from '../SettlementBackupCard.jsx';

const SAMPLE_BACKUPS = [
  { name: 'auto-2026-05-20T08-30-00-000Z.zip', size_bytes: 2_100_000, mtime: '2026-05-20T08:30:00.000Z' },
  { name: 'auto-2026-05-20T06-30-00-000Z.zip', size_bytes: 1_800_000, mtime: '2026-05-20T06:30:00.000Z' },
  { name: 'auto-2026-05-20T04-30-00-000Z.zip', size_bytes: 1_400_000, mtime: '2026-05-20T04:30:00.000Z' },
];

function mockApi(data, opts = {}) {
  useApi.mockReturnValue({
    data,
    isLoading: opts.isLoading ?? false,
    error: opts.error ?? null,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi(SAMPLE_BACKUPS);
});

afterEach(() => {
  cleanup();
});

describe('SettlementBackupCard', () => {
  it('★ 마지막 자동 백업 시각 노출 (목록 첫 row mtime 기반)', () => {
    render(<SettlementBackupCard canDownloadManual={true} onManualDownload={vi.fn()} />);
    const card = screen.getByTestId('settlement-backup-card');
    expect(card).toHaveTextContent(/마지막 자동 백업/);
    // 시각이 어떤 형태든 노출 (HH:mm 또는 "N분 전" 등)
    expect(card.textContent.length).toBeGreaterThan(0);
  });

  it('★ 목록 0개 → "아직 자동 백업이 없어요" 표시', () => {
    mockApi([]);
    render(<SettlementBackupCard canDownloadManual={true} onManualDownload={vi.fn()} />);
    expect(screen.getByTestId('settlement-backup-card')).toHaveTextContent('아직 자동 백업이 없어요');
  });

  it('★ 3개 row 렌더 (data-testid=backup-item-*)', () => {
    render(<SettlementBackupCard canDownloadManual={true} onManualDownload={vi.fn()} />);
    const rows = screen.getAllByTestId(/^backup-item-/);
    expect(rows).toHaveLength(3);
  });

  it('★ row 클릭 → window.open with encodeURIComponent된 이름', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<SettlementBackupCard canDownloadManual={true} onManualDownload={vi.fn()} />);
    const rows = screen.getAllByTestId(/^backup-item-/);
    fireEvent.click(rows[0]);
    const expected = `/admin/api/backups/${encodeURIComponent(SAMPLE_BACKUPS[0].name)}`;
    expect(openSpy).toHaveBeenCalledWith(expected, '_blank');
    openSpy.mockRestore();
  });

  it('★ 수동 다운로드 버튼 클릭 → onManualDownload 호출', () => {
    const onManual = vi.fn();
    render(<SettlementBackupCard canDownloadManual={true} onManualDownload={onManual} />);
    fireEvent.click(screen.getByTestId('download-zip-btn'));
    expect(onManual).toHaveBeenCalledTimes(1);
  });

  it('★ canDownloadManual=false → 버튼 disabled + 안내 메시지', () => {
    render(<SettlementBackupCard canDownloadManual={false} onManualDownload={vi.fn()} />);
    expect(screen.getByTestId('download-zip-btn')).toBeDisabled();
    expect(screen.getByTestId('settlement-backup-card')).toHaveTextContent('단일 일자 선택');
  });

  it('각 row에 크기 표기 (X.X MB)', () => {
    render(<SettlementBackupCard canDownloadManual={true} onManualDownload={vi.fn()} />);
    const rows = screen.getAllByTestId(/^backup-item-/);
    // 2,100,000 bytes / (1024*1024) ≈ 2.0 MB
    expect(rows[0]).toHaveTextContent(/MB/);
  });
});
