import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTransformer } from '../../../global/util/transformers';

/** Where a file lives under the tenant root — one folder per purpose (PLN-260910 D-1). */
export const TENANT_ASSET_AREA = {
  DESIGN: 'design',
  SETTINGS: 'settings',
} as const;
export type TenantAssetArea = (typeof TENANT_ASSET_AREA)[keyof typeof TENANT_ASSET_AREA];

/** What the file is, which decides validation and whether it is served publicly (D-3/D-4). */
export const TENANT_ASSET_KIND = {
  FONT: 'font',
  ICON: 'icon',
  IMAGE: 'image',
  DOC: 'doc',
  SETTINGS_SNAPSHOT: 'settings_snapshot',
} as const;
export type TenantAssetKind = (typeof TENANT_ASSET_KIND)[keyof typeof TENANT_ASSET_KIND];

/**
 * tenant_assets — the registry behind `UPLOAD_DIR/tenants/{tenantId}/{area}/…`
 * (PLN-260910 Tenant Asset Store P1). Existing files (chat attachments, the
 * widget logo, board files) keep their own paths and tables; only new areas
 * follow the tenant-root convention.
 */
@Entity('tenant_assets')
export class TenantAsset {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'char', length: 36 })
  @Index('uk_tenant_assets_uuid', { unique: true })
  uuid: string;

  @Column({ name: 'tenant_id', type: 'bigint', transformer: bigintTransformer })
  tenantId: number;

  @Column({ type: 'varchar', length: 16 })
  area: string;

  @Column({ type: 'varchar', length: 24 })
  kind: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'varchar', length: 128 })
  mime: string;

  @Column({ type: 'varchar', length: 8 })
  ext: string;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  size: number;

  @Column({ type: 'char', length: 64 })
  sha256: string;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column({ name: 'storage_path', type: 'varchar', length: 512 })
  storagePath: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  label: string | null;

  @Column({ name: 'created_by', type: 'bigint', transformer: bigintTransformer })
  createdBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'deleted_at', type: 'datetime', precision: 6, nullable: true })
  deletedAt: Date | null;
}
