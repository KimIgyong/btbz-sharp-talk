-- 260913-tenant-default-language.sql — explicit default widget language per tenant
-- (REQ/PLN-260913-VN-Prerequisite-Gaps G1/G2). NULL = derive from `timezone` as
-- before; a value (e.g. 'vi') outranks the timezone but never an explicit non-English
-- browser/shopper choice. Values are language codes from packages/types language.ts.
-- Idempotence: guard with `SHOW COLUMNS FROM tenants LIKE 'default_language'`.

ALTER TABLE `tenants`
  ADD COLUMN `default_language` varchar(5) DEFAULT NULL AFTER `timezone`;
