-- 260911-widget-designs.sql — custom widget library (PLN-260910 P3, D-12′).
-- A tenant keeps N named designs; `tenants.active_widget_design_id` says which one
-- is live (NULL = the basic widget from the theme card). Applying copies the design
-- into tenants.widget_theme.design so the widget/session contract is unchanged.
-- Idempotence: guard with `SHOW TABLES LIKE 'widget_designs'` / `SHOW COLUMNS FROM tenants LIKE 'active_widget_design_id'`.

CREATE TABLE IF NOT EXISTS `widget_designs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `design_json` JSON NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ready',
  `note` VARCHAR(255) NULL,
  `created_by` BIGINT NOT NULL,
  `updated_by` BIGINT NULL,
  `applied_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_widget_designs_tenant_name` (`tenant_id`, `name`),
  KEY `idx_widget_designs_tenant` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `tenants`
  ADD COLUMN `active_widget_design_id` BIGINT NULL AFTER `usage_guides_enabled`;
