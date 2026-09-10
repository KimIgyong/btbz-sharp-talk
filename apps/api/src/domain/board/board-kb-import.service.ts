import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { buildPagination, normalizePage } from '@sharptalk/common';
import { BoardDocument } from './entity/board-document.entity';
import { KbDocument } from '../knowledge/entity/kb-document.entity';
import { BoardActor, BoardService } from './board.service';
import { AuditService } from '../audit/audit.service';
import { Paginated } from '../../global/interceptor/transform.interceptor';

export interface KbCandidate {
  id: string;
  title: string;
  category: string | null;
  source: string;
  docGroup: string;
  updatedAt: Date;
  /** Board document already managing this KB row, if any. */
  linkedBoardDocumentId: string | null;
}

export interface KbImportResult {
  requested: number;
  created: number;
  skipped: number;
  invalid: number;
  errors: Array<{ id: number; reason: string }>;
}

/**
 * KB → Smart Knowledge Board (PLN-260910-Board-Back-Editor-KB-Import).
 *
 * The board only ever flowed one way — write here, adopt into the KB. Knowledge
 * that was added directly or bulk-imported never got the board's revision /
 * comment / simulation / re-adopt loop. This pulls such documents onto the
 * board as PROMOTED rows linked by `promoted_document_id`, so a board edit
 * re-adopts into the same KB row.
 *
 * Eligibility is one rule in one place (`eligibilityWhere` + `reasonFor`): a
 * synced document (Drive/Notion `source_id`, catalogue, usage guide) is owned
 * by its sync, which would silently overwrite a board edit at the next run.
 */
@Injectable()
export class BoardKbImportService {
  private readonly logger = new Logger(BoardKbImportService.name);

  constructor(
    @InjectRepository(KbDocument) private readonly kbRepo: Repository<KbDocument>,
    @InjectRepository(BoardDocument) private readonly boardRepo: Repository<BoardDocument>,
    private readonly board: BoardService,
    private readonly audit: AuditService,
  ) {}

  /** Why a KB row cannot come onto the board — null when it can. */
  static reasonFor(kb: KbDocument): string | null {
    if (kb.sourceId != null) return 'synced_source';
    if (kb.source === 'product_catalog') return 'catalog';
    if (kb.source === 'board') return 'board_origin';
    if (kb.externalKey?.startsWith('usage:')) return 'usage_guide';
    return null;
  }

  async candidates(
    tenantId: number,
    q: { group?: string; search?: string; page?: string; size?: string },
  ): Promise<Paginated<KbCandidate>> {
    const { page, size } = normalizePage(q.page, q.size);
    const qb = this.kbRepo
      .createQueryBuilder('k')
      .where('k.tenant_id = :tenantId', { tenantId })
      .andWhere('k.source_id IS NULL')
      .andWhere("k.source NOT IN ('product_catalog', 'board')")
      .andWhere("(k.external_key IS NULL OR k.external_key NOT LIKE 'usage:%')");
    if (q.group) qb.andWhere('k.doc_group = :group', { group: q.group });
    if (q.search?.trim()) {
      qb.andWhere('(k.title LIKE :like OR k.category LIKE :like)', { like: `%${q.search.trim()}%` });
    }
    const [entities, total] = await qb
      .orderBy('k.updated_at', 'DESC')
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();
    // Link lookup as a second query, not a join: promoted_document_id is not
    // unique, and a join would duplicate rows and misalign raw/entity indexes.
    const linkedByKb = await this.linkedBoardIds(
      tenantId,
      entities.map((k) => Number(k.id)),
    );
    const items: KbCandidate[] = entities.map((k) => ({
      id: String(k.id),
      title: k.title,
      category: k.category ?? null,
      source: k.source,
      docGroup: k.docGroup,
      updatedAt: k.updatedAt,
      linkedBoardDocumentId: linkedByKb.get(Number(k.id)) ?? null,
    }));
    return new Paginated(items, buildPagination(page, size, total));
  }

  /** kb id → the (first) board document managing it. */
  private async linkedBoardIds(tenantId: number, kbIds: number[]): Promise<Map<number, string>> {
    if (!kbIds.length) return new Map();
    const linked = await this.boardRepo.find({
      where: { tenantId, promotedDocumentId: In(kbIds) },
      select: ['id', 'promotedDocumentId'],
      order: { id: 'ASC' },
    });
    const map = new Map<number, string>();
    for (const b of linked) {
      const kbId = Number(b.promotedDocumentId);
      if (!map.has(kbId)) map.set(kbId, String(b.id));
    }
    return map;
  }

  async import(tenantId: number, ids: number[], actor: BoardActor): Promise<KbImportResult> {
    const unique = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    const result: KbImportResult = { requested: unique.length, created: 0, skipped: 0, invalid: 0, errors: [] };
    if (!unique.length) return result;

    const rows = await this.kbRepo.find({ where: { tenantId, id: In(unique) } });
    const byId = new Map(rows.map((r) => [Number(r.id), r]));
    const linkedByKb = await this.linkedBoardIds(tenantId, unique);

    for (const id of unique) {
      const kb = byId.get(id);
      if (!kb) {
        result.invalid += 1;
        result.errors.push({ id, reason: 'not_found' });
        continue;
      }
      const reason = BoardKbImportService.reasonFor(kb);
      if (reason) {
        result.invalid += 1;
        result.errors.push({ id, reason });
        continue;
      }
      if (linkedByKb.has(id)) {
        result.skipped += 1;
        continue;
      }
      try {
        const doc = await this.board.createFromKb(tenantId, kb, actor);
        // The BRD- key is what the KB screen's "board origin" note and re-adopt
        // key on; a key that already belongs to someone else stays theirs
        // (REQ D-2) — the promoted_document_id link is enough.
        if (!kb.externalKey) {
          kb.externalKey = `BRD-${doc.id}`;
          await this.kbRepo.save(kb);
        }
        result.created += 1;
      } catch (e) {
        // One bad row must not abandon the rest or the audit trail (same
        // stance as the FAQ import): report it and carry on.
        this.logger.warn(`kb import: document ${id} failed — ${(e as Error).message}`);
        result.invalid += 1;
        result.errors.push({ id, reason: 'failed' });
      }
    }

    await this.audit.write({
      tenantId,
      actorType: 'user',
      actorId: actor.userId,
      action: 'board.kb_imported',
      metadata: { ...result, errors: result.errors.slice(0, 50) },
    });
    this.logger.log(
      `kb import (tenant ${tenantId}): requested=${result.requested} created=${result.created} ` +
        `skipped=${result.skipped} invalid=${result.invalid}`,
    );
    return result;
  }
}
