UPDATE "GenerationJob"
SET "provider" = 'user-codex'
WHERE "provider" <> 'user-codex';

UPDATE "ReferencePack"
SET "provider" = 'user-codex'
WHERE "provider" <> 'user-codex';

UPDATE "ApiUsageLog"
SET "provider" = 'user-codex'
WHERE "provider" IN ('mock', 'nanobanana2', 'local-codex');
