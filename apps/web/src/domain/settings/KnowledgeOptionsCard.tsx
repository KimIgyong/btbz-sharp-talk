import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useKnowledgeSettings, useUpdateKnowledgeSettings } from './settings.hooks';

/**
 * Knowledge-page options (PLN-260910 D-3). One switch: whether /knowledge shows
 * the product usage-guides section. It is a shop feature — a tenant without
 * product types only saw an empty table — so it defaults off and is turned on
 * here, next to the storefront it belongs with. Off hides the section only;
 * written guides and their citations survive.
 */
export function KnowledgeOptionsCard() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { data, isLoading } = useKnowledgeSettings();
  const save = useUpdateKnowledgeSettings();
  const [draft, setDraft] = useState<boolean | null>(null);
  const current = draft ?? data?.usageGuidesEnabled ?? false;
  const dirty = data != null && current !== data.usageGuidesEnabled;

  return (
    <Card title={t('knowledgeOptions.title')}>
      {isLoading ? (
        <p className="text-sm text-gray-400">{tc('loading')}</p>
      ) : (
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={current}
              onChange={(e) => setDraft(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span>
              <span className="font-medium">{t('knowledgeOptions.usageGuides')}</span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {t('knowledgeOptions.usageGuidesHint')}
              </span>
            </span>
          </label>
          <Button
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate(current, { onSuccess: () => setDraft(null) })}
          >
            {save.isPending ? tc('saving') : tc('save')}
          </Button>
        </div>
      )}
    </Card>
  );
}
