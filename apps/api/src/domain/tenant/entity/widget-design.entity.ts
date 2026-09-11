import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { WidgetDesign } from '@sharptalk/types';
import { bigintTransformer } from '../../../global/util/transformers';

export const WIDGET_DESIGN_STATUS = { READY: 'ready', ARCHIVED: 'archived' } as const;
export type WidgetDesignStatus = (typeof WIDGET_DESIGN_STATUS)[keyof typeof WIDGET_DESIGN_STATUS];

/**
 * widget_designs — a tenant's custom widget library (PLN-260910 P3 D-12′).
 * Which row is live is `tenants.active_widget_design_id`; NULL means the basic
 * widget from the theme card. Applying copies `designJson` into
 * `tenants.widget_theme.design`, so session/ensure and the widget are unchanged.
 */
@Entity('widget_designs')
@Index('uk_widget_designs_tenant_name', ['tenantId', 'name'], { unique: true })
export class WidgetDesignRow {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', transformer: bigintTransformer })
  tenantId: number;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  /** Normalized design profile (same shape as widget_theme.design). */
  @Column({ name: 'design_json', type: 'json' })
  designJson: WidgetDesign;

  @Column({ type: 'varchar', length: 16, default: WIDGET_DESIGN_STATUS.READY })
  status: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({ name: 'created_by', type: 'bigint', transformer: bigintTransformer })
  createdBy: number;

  @Column({ name: 'updated_by', type: 'bigint', nullable: true, transformer: bigintTransformer })
  updatedBy: number | null;

  @Column({ name: 'applied_at', type: 'datetime', precision: 6, nullable: true })
  appliedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
