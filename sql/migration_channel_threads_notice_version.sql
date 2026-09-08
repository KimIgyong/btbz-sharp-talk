-- PLN-260909: the consent notice is sent once per thread (room), right before the
-- first AI processing, and re-sent only when the notice version changes.
-- NULL = never sent (existing rows). Apply BEFORE deploying the code.
ALTER TABLE channel_threads
  ADD COLUMN notice_version VARCHAR(32) NULL AFTER reply_enabled;

-- Rollback:
-- ALTER TABLE channel_threads DROP COLUMN notice_version;
