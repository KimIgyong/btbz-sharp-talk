import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { apiBaseUrl } from '@/lib/api-client';
import { toast } from '@/store/toast-store';
import { useDeleteTenantAsset, useTenantAssets, useUploadTenantAsset } from './settings.hooks';
import type { TenantAsset } from './settings.service';

const KINDS = ['font', 'icon', 'image', 'doc'] as const;
type Kind = (typeof KINDS)[number];

/** What the file picker offers per kind — the server still judges by content. */
const ACCEPT: Record<Kind, string> = {
  font: '.woff2,.ttf,.otf',
  icon: '.png,.webp',
  image: '.png,.jpg,.jpeg,.webp',
  doc: '.pdf,.png,.jpg,.jpeg',
};

const mb = (n: number) => (n / 1024 / 1024).toFixed(n >= 1024 * 1024 ? 1 : 2);
const kb = (n: number) => (n >= 1024 * 1024 ? `${mb(n)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Public URLs are origin-relative on the API; the console lives elsewhere in dev. */
function absoluteUrl(url: string): string {
  return url.startsWith('/api/v1') ? `${apiBaseUrl()}${url.slice('/api/v1'.length)}` : url;
}

/**
 * Tenant design files (PLN-260910 P1): fonts, icons, images and reference docs
 * under the tenant's own folder. Fonts and icons are what the widget design
 * profile (P2) will point at; docs are for people. Listed per kind, with the
 * quota gauge so a full folder is a visible state, not a mysterious error.
 */
export function DesignAssetsCard() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const [kind, setKind] = useState<Kind>('font');
  const assets = useTenantAssets(kind);
  const usageQ = useTenantAssets();
  const upload = useUploadTenantAsset();
  const remove = useDeleteTenantAsset();
  const fileInput = useRef<HTMLInputElement>(null);

  const usage = usageQ.data?.usage;
  const pct = usage && usage.quota > 0 ? Math.min(100, Math.round((usage.used / usage.quota) * 100)) : 0;

  const onFiles = (files: FileList | null) => {
    const list = [...(files ?? [])];
    if (!list.length) return;
    // Sequential so one bad file reports on its own instead of a burst of toasts.
    (async () => {
      for (const file of list) {
        try {
          await upload.mutateAsync({ file, kind });
        } catch {
          /* the mutation already toasted */
        }
      }
    })();
  };

  const copyUrl = async (a: TenantAsset) => {
    try {
      await navigator.clipboard.writeText(absoluteUrl(a.url));
      toast.success(t('designAssets.urlCopied'));
    } catch {
      toast.error(t('designAssets.urlCopyFailed'));
    }
  };

  return (
    <Card
      title={t('designAssets.title')}
      action={
        <div className="flex items-center gap-3">
          {usage && (
            <div className="flex items-center gap-2 text-xs text-gray-500" title={t('designAssets.quotaHint')}>
              <span className="tabular-nums">
                {kb(usage.used)} / {mb(usage.quota)} MB
              </span>
              <span className="h-1.5 w-24 overflow-hidden rounded bg-gray-200">
                <span
                  className={`block h-full ${pct >= 90 ? 'bg-red-500' : 'bg-primary-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </span>
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT[kind]}
            className="hidden"
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Button size="sm" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
            {upload.isPending ? tc('loading') : t('designAssets.add')}
          </Button>
        </div>
      }
    >
      <p className="mb-2 text-xs text-gray-500">{t('designAssets.hint')}</p>
      <div className="mb-3 flex flex-wrap gap-1">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={
              kind === k
                ? 'rounded-md bg-primary-600 px-2.5 py-1 text-xs font-medium text-white'
                : 'rounded-md px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100'
            }
          >
            {t(`designAssets.kind.${k}`)}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-gray-400">{t(`designAssets.rule.${kind}`)}</span>
      </div>

      <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {(assets.data?.items ?? []).map((a) => (
          <li key={a.uuid} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-50 text-gray-500">
              {a.kind === 'font' ? (
                <span className="text-base font-semibold">Aa</span>
              ) : a.mime.startsWith('image/') && a.public ? (
                <img src={absoluteUrl(a.url)} alt="" className="max-h-10 max-w-10 object-contain" />
              ) : (
                <span className="text-[10px] uppercase">{a.ext}</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-gray-800" title={a.filename}>
                {a.label || a.filename}
              </span>
              <span className="block text-xs text-gray-400">
                {a.filename} · {kb(a.size)}
                {a.width && a.height ? ` · ${a.width}×${a.height}` : ''} · v{a.version} ·{' '}
                {new Date(a.createdAt).toLocaleDateString()}
              </span>
            </span>
            {a.public ? <Badge tone="info">{t('designAssets.public')}</Badge> : <Badge tone="gray">{t('designAssets.private')}</Badge>}
            {a.public ? (
              <Button variant="ghost" size="sm" onClick={() => copyUrl(a)}>
                {t('designAssets.copyUrl')}
              </Button>
            ) : (
              <a
                href={absoluteUrl(a.url)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary-600 hover:underline"
              >
                {t('designAssets.download')}
              </a>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(t('designAssets.deleteConfirm', { name: a.label || a.filename })))
                  remove.mutate(a.uuid);
              }}
            >
              {tc('delete')}
            </Button>
          </li>
        ))}
        {!assets.isLoading && !assets.data?.items.length && (
          <li className="px-3 py-6 text-center text-xs text-gray-400">{t('designAssets.empty')}</li>
        )}
      </ul>
      {kind === 'font' && <p className="mt-2 text-[11px] text-gray-400">{t('designAssets.fontLicense')}</p>}
    </Card>
  );
}
