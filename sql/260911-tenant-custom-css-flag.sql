-- 260911-tenant-custom-css-flag.sql — platform add-on switch for tenant custom widget
-- CSS (PLN-260910 P5, C′). Default OFF: custom CSS is only delivered to the widget
-- when this is 1, and only after the server-side allowlist sanitizer.
-- Idempotence: guard with `SHOW COLUMNS FROM tenants LIKE 'custom_css_enabled'`.

ALTER TABLE `tenants`
  ADD COLUMN `custom_css_enabled` tinyint(1) NOT NULL DEFAULT 0 AFTER `active_widget_design_id`;
