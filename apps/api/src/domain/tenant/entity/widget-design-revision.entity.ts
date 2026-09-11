import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { WidgetDesign } from '@sharptalk/types';
import { bigintTransformer } from '../../../global/util/transformers';

/**
 * widget_design_revisions — the design as it was BEFORE each edit (PLN-260910
 * follow-up). Max+1 numbering per design (kit lesson B-1), never count+1.
 */
@Entity('widget_design_revisions')
@Index('uk_wdr_design_rev', ['designId', 'revisionNo'], { unique: true })
export class WidgetDesignRevision {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', transformer: bigintTransformer })
  tenantId: number;

  @Column({ name: 'design_id', type: 'bigint', transformer: bigintTransformer })
  designId: number;

  @Column({ name: 'revision_no', type: 'int' })
  revisionNo: number;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ name: 'design_json', type: 'json' })
  designJson: WidgetDesign;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({ name: 'actor_user_id', type: 'bigint', nullable: true, transformer: bigintTransformer })
  actorUserId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
