-- 260911-widget-design-revisions.sql — change history per custom widget design
-- (PLN-260910 follow-up "디자인별 변경 이력"). A snapshot of the design BEFORE each
-- edit; restore copies a snapshot back (and re-syncs the live copy when in use).
-- Idempotence: guard with `SHOW TABLES LIKE 'widget_design_revisions'`.

CREATE TABLE IF NOT EXISTS `widget_design_revisions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `design_id` BIGINT NOT NULL,
  `revision_no` INT NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `design_json` JSON NOT NULL,
  `note` VARCHAR(255) NULL,
  `actor_user_id` BIGINT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wdr_design_rev` (`design_id`, `revision_no`),
  KEY `idx_wdr_tenant_design` (`tenant_id`, `design_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
