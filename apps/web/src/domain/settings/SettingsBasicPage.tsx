import { useTranslation } from 'react-i18next';
import { AiEngineCard } from './AiEngineCard';
import { AiUsageCard } from './AiUsageCard';
import { StorefrontCard } from './SettingsPage';
import { KnowledgeOptionsCard } from './KnowledgeOptionsCard';
import { HandoffSection } from '../ai-settings/HandoffSection';

/** Tenant settings — basic (PLN-260824 B). Composition only; every card moved here unchanged. */
export function SettingsBasicPage() {
  const { t } = useTranslation('settings');

  return (
    <div className="space-y-6">
      {/* The tab already names the section; this says what it is for. */}
      <p className="text-sm text-gray-500">{t('groups.basic.subtitle')}</p>
      <AiEngineCard />
      <AiUsageCard />
      <StorefrontCard />
      {/* Shop-only knowledge features live next to the storefront they serve (PLN-260910). */}
      <KnowledgeOptionsCard />
      {/* Live-support routing: business hours, break, off-hours mailbox. */}
      <HandoffSection />
    </div>
  );
}
