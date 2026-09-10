import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/Card';
import { HelpModal, HelpSection } from '@/components/HelpModal';

const COLLAPSE_KEY = 'ivy:knowledge:guide-collapsed';

/** Section anchors on /knowledge that the process guide jumps to (PLN-260910 D-6). */
export const KNOWLEDGE_SECTION = {
  SOURCES: 'sec-sources',
  GUIDES: 'sec-guides',
  CATEGORIES: 'sec-categories',
  BOARD: 'sec-board',
  DOCUMENTS: 'sec-documents',
} as const;

/** Step number badge — circled-digit glyphs render as tiny icons in the UI font. */
export function StepNo({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-700 ${className}`}
    >
      {n}
    </span>
  );
}

/**
 * How knowledge gets here — Source → Sync → Board → KB-Document — on the page
 * whose sections follow that order (REQ-260910). Every box is a link to its
 * section; Sync has no section of its own (it is a row action on a source), so
 * it lands on the sources card and its text says where the button is.
 *
 * Collapsible and remembered, because it is scaffolding — useful the first
 * week, clutter the tenth.
 */
export function ProcessGuide({ optionalGuides }: { optionalGuides: boolean }) {
  const { t } = useTranslation('knowledge');
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  );

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
  };

  // Instant, not smooth: a smooth scroll is silently dropped when anything else
  // scrolls in the same frame (observed under browser automation), and the
  // cards carry scroll-mt so the header is not glued to the viewport edge.
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'start' });

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="mb-4 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
      >
        <ChevronDown className="h-3 w-3" /> {t('guide.title')}
      </button>
    );
  }

  const step = (n: number, title: string, body: string, target: string) => (
    <li className="flex-1">
      <button
        type="button"
        onClick={() => jump(target)}
        className="h-full w-full rounded-lg border border-gray-100 p-3 text-left hover:border-primary-300 hover:bg-primary-50"
      >
        <p className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <StepNo n={n} />
          {title}
        </p>
        <p className="mt-1 text-xs text-gray-500">{body}</p>
      </button>
    </li>
  );

  return (
    <Card
      title={t('guide.title')}
      action={
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <ChevronUp className="h-3 w-3" /> {t('guide.collapse')}
        </button>
      }
    >
      <p className="mb-3 text-sm text-gray-700">{t('guide.intro')}</p>
      <ol className="flex flex-col gap-2 sm:flex-row">
        {step(1, t('guide.step1Title'), t('guide.step1Body'), KNOWLEDGE_SECTION.SOURCES)}
        {step(2, t('guide.step2Title'), t('guide.step2Body'), KNOWLEDGE_SECTION.SOURCES)}
        {step(3, t('guide.step3Title'), t('guide.step3Body'), KNOWLEDGE_SECTION.BOARD)}
        {step(4, t('guide.step4Title'), t('guide.step4Body'), KNOWLEDGE_SECTION.DOCUMENTS)}
      </ol>
      <p className="mt-1 text-xs text-gray-400">{t('guide.jumpHint')}</p>
      <ul className="mt-3 space-y-1 text-xs text-gray-500">
        <li>· {t('guide.noteSource')}</li>
        <li>· {t('guide.noteCategory')}</li>
        {optionalGuides && <li>· {t('guide.noteOptionalGuides')}</li>}
      </ul>
    </Card>
  );
}

/** What "Sync from catalog" turns into documents, and what it will not. */
export function CatalogSyncHelp() {
  const { t } = useTranslation('knowledge');
  return (
    <HelpModal title={t('help.catalogTitle')} label={t('syncCatalog')}>
      <HelpSection heading={t('help.whatItDoes')}>
        <p>{t('help.catalogWhat')}</p>
      </HelpSection>
      <HelpSection heading={t('help.goodToKnow')}>
        <ul className="list-disc space-y-1 pl-4">
          <li>{t('help.catalogPreview')}</li>
          <li>{t('help.catalogCategory')}</li>
          <li>{t('help.catalogVariants')}</li>
          <li>{t('help.catalogRerun')}</li>
        </ul>
      </HelpSection>
    </HelpModal>
  );
}

/** The CSV contract, with a file that satisfies it. */
export function ProductCsvHelp() {
  const { t } = useTranslation('knowledge');
  return (
    <HelpModal title={t('help.csvTitle')} label={t('importProducts')}>
      <HelpSection heading={t('help.whatItDoes')}>
        <p>{t('help.csvWhat')}</p>
      </HelpSection>
      <HelpSection heading={t('help.csvRequired')}>
        <code className="text-xs">Product Name · Handle · Detail</code>
      </HelpSection>
      <HelpSection heading={t('help.csvOptional')}>
        <code className="text-xs">Brand · Category · Product URL · Price(USD) · Image URL</code>
      </HelpSection>
      <HelpSection heading={t('help.goodToKnow')}>
        <ul className="list-disc space-y-1 pl-4">
          <li>{t('help.csvUpsert')}</li>
          <li>{t('help.csvPrice')}</li>
          <li>{t('help.csvCategory')}</li>
        </ul>
      </HelpSection>
      {/* A described format is still guesswork until you see one. */}
      <a
        className="inline-block text-sm font-medium text-primary hover:underline"
        href="/samples/kb-product-import-sample.csv"
        download
      >
        {t('help.csvSample')}
      </a>
    </HelpModal>
  );
}

/** What makes a hand-written document get cited. */
export function AddDocumentHelp() {
  const { t } = useTranslation('knowledge');
  return (
    <HelpModal title={t('help.addDocTitle')} label={t('addDocument')}>
      <HelpSection heading={t('help.whatItDoes')}>
        <p>{t('help.addDocWhat')}</p>
      </HelpSection>
      <HelpSection heading={t('help.addDocWriting')}>
        <ul className="list-disc space-y-1 pl-4">
          <li>{t('help.addDocOneTopic')}</li>
          <li>{t('help.addDocWords')}</li>
          <li>{t('help.addDocCategory')}</li>
        </ul>
      </HelpSection>
      <HelpSection heading={t('help.goodToKnow')}>
        <p>{t('help.addDocPending')}</p>
      </HelpSection>
    </HelpModal>
  );
}
