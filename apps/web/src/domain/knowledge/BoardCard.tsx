import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useBoardStatusCounts } from '@/domain/board/board.hooks';
import { KNOWLEDGE_SECTION, StepNo } from './KnowledgeGuides';

/**
 * Step ③ of the knowledge process, placed between Categories and KB-Documents
 * (REQ-260910 R1): the board is where sourced assets and new knowledge are
 * drafted, published, simulated and then adopted. The counts say why to go in;
 * if they fail to load only the numbers disappear — the doors stay open.
 */
export function BoardCard({ group }: { group: string }) {
  const { t } = useTranslation('knowledge');
  const navigate = useNavigate();
  const counts = useBoardStatusCounts();

  return (
    <Card
      id={KNOWLEDGE_SECTION.BOARD}
      title={<span className="flex items-center gap-2"><StepNo n={3} />{t('boardCard.title')}</span>}
      action={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/knowledge/board')}>
            {t('boardCard.open')}
          </Button>
          <Button size="sm" onClick={() => navigate(`/knowledge/board/new?group=${group || 'counsel'}`)}>
            {t('boardCard.write')}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-gray-700">{t('boardCard.body')}</p>
      {counts.data && (
        <p className="mt-2 text-xs text-gray-500">
          {t('boardCard.counts', {
            pending: counts.data.pendingReview.toLocaleString(),
            promoted: counts.data.promoted.toLocaleString(),
          })}
        </p>
      )}
    </Card>
  );
}
