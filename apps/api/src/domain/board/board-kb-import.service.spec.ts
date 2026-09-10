import { BoardKbImportService } from './board-kb-import.service';
import { KbDocument } from '../knowledge/entity/kb-document.entity';
import { BoardDocument } from '../board/entity/board-document.entity';

/**
 * KB → board import (PLN-260910-Board-Back-Editor-KB-Import). The eligibility
 * rule and the link/skip/key behaviour are the whole contract; the query
 * builder path (candidates) is covered by the staging smoke, not here.
 */
describe('BoardKbImportService', () => {
  const kb = (over: Partial<KbDocument>): KbDocument =>
    ({
      id: 1,
      tenantId: 1,
      source: 'knowledge_store',
      sourceId: null,
      externalKey: null,
      docGroup: 'counsel',
      category: 'policy',
      title: '환불 정책',
      content: '7일 이내',
      ...over,
    }) as KbDocument;

  describe('reasonFor (eligibility)', () => {
    it.each([
      ['synced_source', { sourceId: 5 }],
      ['catalog', { source: 'product_catalog' }],
      ['board_origin', { source: 'board', externalKey: 'BRD-3' }],
      ['usage_guide', { externalKey: 'usage:lashes' }],
    ])('refuses %s', (reason, over) => {
      expect(BoardKbImportService.reasonFor(kb(over))).toBe(reason);
    });

    it('accepts direct, bulk-imported and gap-approved rows — a foreign key alone is fine', () => {
      expect(BoardKbImportService.reasonFor(kb({}))).toBeNull();
      expect(BoardKbImportService.reasonFor(kb({ source: 'knowledge_gap' }))).toBeNull();
      expect(BoardKbImportService.reasonFor(kb({ externalKey: 'handle-123' }))).toBeNull();
    });
  });

  describe('import', () => {
    function build(rows: KbDocument[], linked: Array<Partial<BoardDocument>> = []) {
      const savedKb: KbDocument[] = [];
      const created: KbDocument[] = [];
      const kbRepo = {
        find: jest.fn(async () => rows),
        save: jest.fn(async (d: KbDocument) => {
          savedKb.push({ ...d });
          return d;
        }),
      };
      const boardRepo = { find: jest.fn(async () => linked) };
      let nextId = 40;
      const board = {
        createFromKb: jest.fn(async (_t: number, k: KbDocument) => {
          created.push(k);
          return { id: nextId++ } as BoardDocument;
        }),
      };
      const audit = { write: jest.fn() };
      const svc = new BoardKbImportService(kbRepo as never, boardRepo as never, board as never, audit as never);
      return { svc, savedKb, created, audit, board };
    }

    it('creates linked board rows, assigns BRD- only to keyless KB rows, audits counts', async () => {
      const h = build([kb({ id: 1 }), kb({ id: 2, externalKey: 'handle-2' })]);
      const res = await h.svc.import(1, [1, 2, 2], { userId: 7, rank: 'master' });
      expect(res).toMatchObject({ requested: 2, created: 2, skipped: 0, invalid: 0 });
      expect(h.created.map((k) => k.id)).toEqual([1, 2]);
      // Row 1 had no key → BRD-{boardId}; row 2 keeps its own key.
      expect(h.savedKb).toHaveLength(1);
      expect(h.savedKb[0]).toMatchObject({ id: 1, externalKey: 'BRD-40' });
      expect(h.audit.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'board.kb_imported', metadata: expect.objectContaining({ created: 2 }) }),
      );
    });

    it('skips rows already managed by a board document and reports ineligible ones', async () => {
      const h = build(
        [kb({ id: 1 }), kb({ id: 3, source: 'product_catalog' })],
        [{ id: 9, promotedDocumentId: 1 }],
      );
      const res = await h.svc.import(1, [1, 3, 99], { userId: 7, rank: 'master' });
      expect(res).toMatchObject({ requested: 3, created: 0, skipped: 1, invalid: 2 });
      expect(res.errors).toEqual([
        { id: 3, reason: 'catalog' },
        { id: 99, reason: 'not_found' },
      ]);
      expect(h.board.createFromKb).not.toHaveBeenCalled();
    });
  });
});
