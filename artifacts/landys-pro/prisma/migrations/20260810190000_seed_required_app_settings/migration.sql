-- Required runtime settings for fresh databases. Preserve any admin-configured
-- values in existing environments.
INSERT INTO "AppSetting" ("key", "value", "updatedAt")
VALUES
  ('maxLeadRecipients', '3', CURRENT_TIMESTAMP),
  ('leadExpiryHours', '48', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
