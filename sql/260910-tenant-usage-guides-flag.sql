-- 260910-tenant-usage-guides-flag.sql — per-tenant switch for the product usage
-- guides section on /knowledge (PLN-260910). Default OFF: the feature only means
-- something to a shop with product types; a tenant turns it on in Settings > Basic.
-- Idempotence: guard with `SHOW COLUMNS FROM tenants LIKE 'usage_guides_enabled'`.

ALTER TABLE `tenants`
  ADD COLUMN `usage_guides_enabled` tinyint(1) NOT NULL DEFAULT 0 AFTER `workflow_mode`;

-- Nobody loses a section they already use: ivyusa (the only tenant with real
-- product types) and any tenant that has written a guide start ON.
UPDATE `tenants`
   SET `usage_guides_enabled` = 1
 WHERE `slug` = 'ivyusa'
    OR `id` IN (SELECT DISTINCT `tenant_id` FROM `kb_documents` WHERE `external_key` LIKE 'usage:%');
