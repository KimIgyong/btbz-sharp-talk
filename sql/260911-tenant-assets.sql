-- 260911-tenant-assets.sql — per-tenant asset registry (PLN-260910 Tenant Asset Store P1).
-- Files live under UPLOAD_DIR/tenants/{tenant_id}/{area}/{uuid}.{ext}; this table is the
-- registry the console lists, the quota counts, and the public asset route resolves.
-- Idempotence: guard with `SHOW TABLES LIKE 'tenant_assets'` before running.

CREATE TABLE IF NOT EXISTS `tenant_assets` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `area` VARCHAR(16) NOT NULL,
  `kind` VARCHAR(24) NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `mime` VARCHAR(128) NOT NULL,
  `ext` VARCHAR(8) NOT NULL,
  `size` BIGINT NOT NULL,
  `sha256` CHAR(64) NOT NULL,
  `width` INT NULL,
  `height` INT NULL,
  `storage_path` VARCHAR(512) NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `label` VARCHAR(128) NULL,
  `created_by` BIGINT NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_assets_uuid` (`uuid`),
  KEY `idx_tenant_assets_tenant_area` (`tenant_id`, `area`, `deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
