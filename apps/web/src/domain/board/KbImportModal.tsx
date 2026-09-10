import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Input, Select } from '@/components/Field';
import { Pagination } from '@/components/Pagination';
import { toast } from '@/store/toast-store';
import { useImportFromKb, useKbCandidates } from './board.hooks';
import type { KbCandidate } from './board.service';

const GROUPS = ['counsel', 'product', 'operation'] as const;
/** Server caps a page at 100 (normalizePage). */
const PAGE_SIZES = [10, 20, 50, 100] as const;

/**
 * Bring existing KB documents onto the board (PLN-260910-Board-Back-Editor-KB-Import
 * D-3/D-4). Only direct/imported rows are listed — the server decides, so a
 * synced document never shows up to be edited and silently overwritten later.
 * Rows a board document already manages stay visible, unselectable, with a
 * link: "it is on the board" is the answer to "why can't I pick it?".
 */
export function KbImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('board');
  const { t: tk } = useTranslation('knowledge');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const [group, setGroup] = useState<string>('counsel');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const candidates = useKbCandidates({ group, search: search || undefined, page, size }, open);
  const importKb = useImportFromKb();
  const rows = candidates.data?.items ?? [];
  const selectable = rows.filter((r) => !r.linkedBoardDocumentId);
  const allOnPage = selectable.length > 0 && selectable.every((r) => selected.has(r.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPage) selectable.forEach((r) => next.delete(r.id));
      else selectable.forEach((r) => next.add(r.id));
      return next;
    });

  const close = () => {
    setSelected(new Set());
    onClose();
  };

  const run = () => {
    const ids = [...selected];
    if (!ids.length) return;
    importKb.mutate(ids, {
      onSuccess: (r) => {
        const msg = t('kbImportDone', { created: r.created, skipped: r.skipped });
        if (r.invalid > 0) toast.warning(`${msg} · ${t('kbImportInvalid')} ${r.invalid}`);
        else toast.success(msg);
        close();
      },
      onError: (err: Error) => toast.error(err.message),
    });
  };

  const sourceLabel = (r: KbCandidate) =>
    tk(`sourceBadge.${r.source}`, { defaultValue: r.source });

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('kbImportTitle')}
      size="lg"
      footer={
        <>
          <span className="mr-auto text-xs text-gray-500">
            {t('kbImportSelected', { count: selected.size })}
          </span>
          <Button variant="ghost" onClick={close}>
            {tc('close')}
          </Button>
          <Button disabled={!selected.size || importKb.isPending} onClick={run}>
            {importKb.isPending ? tc('loading') : t('kbImportRun', { count: selected.size })}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-gray-500">{t('kbImportHint')}</p>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                setGroup(g);
                setPage(1);
              }}
              className={
                group === g
                  ? 'rounded-md bg-primary-600 px-2.5 py-1 text-xs font-medium text-white'
                  : 'rounded-md px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100'
              }
            >
              {tk(`group.${g}`)}
            </button>
          ))}
        </div>
        <Input
          value={searchDraft}
          placeholder={t('kbImportSearch')}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setSearch(searchDraft.trim());
              setPage(1);
            }
          }}
          className="ml-auto h-8 w-44"
        />
        <Select
          value={String(size)}
          aria-label={t('kbImportPageSizeLabel')}
          onChange={(e) => {
            setSize(Number(e.target.value));
            setPage(1);
          }}
          className="h-8 w-auto"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {t('kbImportPageSize', { n })}
            </option>
          ))}
        </Select>
      </div>

      {/* Wide titles must scroll inside the box, not clip the trailing columns. */}
      <div className="max-h-96 overflow-auto rounded-md border border-gray-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="w-8 px-2 py-2">
                <input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label={t('kbImportSelectPage')} />
              </th>
              <th className="px-2 py-2 text-left">{t('title_column')}</th>
              <th className="px-2 py-2 text-left">{tk('category')}</th>
              <th className="px-2 py-2 text-left">{tk('sourceColumn')}</th>
              <th className="px-2 py-2 text-left">{t('updated')}</th>
              <th className="px-2 py-2 text-left">{t('kbImportBoardColumn')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const linked = !!r.linkedBoardDocumentId;
              return (
                <tr key={r.id} className={linked ? 'text-gray-400' : 'hover:bg-gray-50'}>
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      disabled={linked}
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      aria-label={r.title}
                    />
                  </td>
                  <td className="max-w-xs truncate px-2 py-1.5">{r.title}</td>
                  <td className="px-2 py-1.5">{r.category ?? '—'}</td>
                  <td className="px-2 py-1.5">{sourceLabel(r)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs">{new Date(r.updatedAt).toLocaleDateString()}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs">
                    {linked && (
                      <button
                        type="button"
                        className="text-primary-600 hover:underline"
                        onClick={() => navigate(`/knowledge/board/${r.linkedBoardDocumentId}`)}
                      >
                        {t('kbImportLinked')}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!candidates.isLoading && !rows.length && (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-center text-xs text-gray-400">
                  {t('kbImportEmpty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {candidates.data && candidates.data.total > candidates.data.pageSize && (
        <Pagination
          page={page}
          pageSize={candidates.data.pageSize}
          total={candidates.data.total}
          onPageChange={setPage}
        />
      )}
    </Modal>
  );
}
