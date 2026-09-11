import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/Field';
import { apiBaseUrl } from '@/lib/api-client';
import { toast } from '@/store/toast-store';
import { useSettingsSnapshotAction, useSettingsSnapshots } from './settings.hooks';
import { settingsService } from './settings.service';
import type { SnapshotDiff } from './settings.service';

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * Settings snapshots (PLN-260910 P4 D-8): a JSON of the whitelisted settings
 * and the custom-widget library, kept in the tenant's own folder. Restore
 * always shows the field diff first — a backup you cannot inspect is a
 * surprise waiting to happen.
 */
export function SettingsSnapshotsCard() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const snapshots = useSettingsSnapshots();
  const act = useSettingsSnapshotAction();
  const [label, setLabel] = useState('');
  const [diff, setDiff] = useState<{ uuid: string; name: string; data: SnapshotDiff } | null>(null);

  const openDiff = async (uuid: string, name: string) => {
    try {
      setDiff({ uuid, name, data: await settingsService.settingsSnapshotDiff(uuid) });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const show = (v: unknown) => {
    if (v === null || v === undefined) return '—';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > 60 ? `${s.slice(0, 60)}…` : s;
  };

  return (
    <Card
      title={t('settingsSnapshots.title')}
      action={
        <div className="flex items-center gap-2">
          <Input value={label} placeholder={t('settingsSnapshots.labelPlaceholder')} maxLength={128} onChange={(e) => setLabel(e.target.value)} className="h-8 w-56" />
          <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ kind: 'create', label: label.trim() || undefined }, { onSuccess: () => setLabel('') })}>
            {t('settingsSnapshots.create')}
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-gray-500">{t('settingsSnapshots.hint')}</p>
      <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {(snapshots.data ?? []).map((s) => (
          <li key={s.uuid} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-gray-800">{s.label || s.filename}</span>
              <span className="block text-xs text-gray-400">
                {new Date(s.createdAt).toLocaleString()} · {kb(s.size)} · {s.filename}
              </span>
            </span>
            <a href={`${apiBaseUrl()}${s.url.slice('/api/v1'.length)}`} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline">
              {t('settingsSnapshots.download')}
            </a>
            <Button variant="ghost" size="sm" onClick={() => void openDiff(s.uuid, s.label || s.filename)}>
              {t('settingsSnapshots.restore')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={act.isPending}
              onClick={() => {
                if (window.confirm(t('settingsSnapshots.deleteConfirm'))) act.mutate({ kind: 'delete', uuid: s.uuid });
              }}
            >
              {tc('delete')}
            </Button>
          </li>
        ))}
        {!snapshots.isLoading && !snapshots.data?.length && (
          <li className="px-3 py-6 text-center text-xs text-gray-400">{t('settingsSnapshots.empty')}</li>
        )}
      </ul>
      <p className="mt-2 text-[11px] text-gray-400">{t('settingsSnapshots.noSecrets')}</p>

      <Modal
        open={!!diff}
        onClose={() => setDiff(null)}
        title={t('settingsSnapshots.diffTitle', { name: diff?.name ?? '' })}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDiff(null)}>{tc('cancel')}</Button>
            <Button
              variant="danger"
              disabled={act.isPending}
              onClick={() => diff && act.mutate({ kind: 'restore', uuid: diff.uuid }, { onSuccess: () => setDiff(null) })}
            >
              {t('settingsSnapshots.apply')}
            </Button>
          </>
        }
      >
        {diff && (
          <div className="max-h-[60vh] overflow-auto text-sm">
            <p className="mb-2 text-xs text-gray-500">{t('settingsSnapshots.diffHint', { at: new Date(diff.data.createdAt).toLocaleString() })}</p>
            <table className="w-full table-fixed text-xs">
              <colgroup><col className="w-40" /><col /><col /><col className="w-16" /></colgroup>
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-2 py-1 text-left">{t('settingsSnapshots.field')}</th>
                  <th className="px-2 py-1 text-left">{t('settingsSnapshots.current')}</th>
                  <th className="px-2 py-1 text-left">{t('settingsSnapshots.snapshot')}</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {diff.data.fields.map((f) => (
                  <tr key={f.field} className={f.changed ? 'bg-amber-50' : ''}>
                    <td className="truncate px-2 py-1 font-mono">{f.field}</td>
                    <td className="truncate px-2 py-1" title={show(f.current)}>{show(f.current)}</td>
                    <td className="truncate px-2 py-1" title={show(f.snapshot)}>{show(f.snapshot)}</td>
                    <td className="px-2 py-1">{f.changed && <Badge tone="warning">{t('settingsSnapshots.changed')}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {diff.data.designs.length > 0 && (
              <p className="mt-3 text-xs text-gray-600">
                {t('settingsSnapshots.designsLine', {
                  create: diff.data.designs.filter((d) => d.action === 'create').length,
                  update: diff.data.designs.filter((d) => d.action === 'update').length,
                  active: diff.data.designs.find((d) => d.active)?.name ?? '—',
                })}
              </p>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}
