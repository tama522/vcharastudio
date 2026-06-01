CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT,
  "email" TEXT UNIQUE,
  "emailVerified" TEXT,
  "image" TEXT,
  "isAnonymous" INTEGER NOT NULL DEFAULT 0,
  "lastLoginAt" TEXT
);

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionToken" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL,
  "expires" TEXT NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "AnonymousIdentity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL UNIQUE,
  "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TEXT,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "AnonymousGenerationUsage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dateKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "builderStartedAt" TEXT,
  "studioStartedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TEXT NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Character" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tagline" TEXT NOT NULL,
  "story" TEXT NOT NULL,
  "negativePrompt" TEXT NOT NULL,
  "style" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "parts" TEXT NOT NULL,
  "normalizedPrompt" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "referencePackId" TEXT,
  "consistencyAssetIds" TEXT NOT NULL,
  "isDefaultTemplate" INTEGER NOT NULL DEFAULT 0,
  "templateKey" TEXT,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "ReferencePack" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "prompt" TEXT NOT NULL,
  "fixedPrompt" TEXT NOT NULL,
  "variationPrompt" TEXT NOT NULL,
  "negativePrompt" TEXT NOT NULL,
  "seed" INTEGER NOT NULL,
  "createdAt" TEXT NOT NULL,
  "images" TEXT NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Asset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "orientation" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "createdAt" TEXT NOT NULL,
  "sceneAnalysis" TEXT,
  "storagePath" TEXT,
  "sourceJobId" TEXT,
  "sourceAssetId" TEXT,
  "trashedAt" TEXT,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "GenerationJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "characterIds" TEXT NOT NULL,
  "referencePackId" TEXT NOT NULL,
  "referencePackIds" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "sceneTemplateId" TEXT,
  "sceneTemplateCustomText" TEXT,
  "assetId" TEXT,
  "pose" TEXT NOT NULL,
  "poseCustomText" TEXT,
  "bodyPosture" TEXT NOT NULL DEFAULT 'unspecified',
  "bodyPostureCustomText" TEXT,
  "expression" TEXT NOT NULL,
  "expressionCustomText" TEXT,
  "cameraDistance" TEXT NOT NULL,
  "aspectRatio" TEXT NOT NULL,
  "placement" TEXT NOT NULL,
  "placementCustomText" TEXT,
  "outfitOverride" TEXT NOT NULL,
  "outfitOverrideCustomText" TEXT,
  "consistencyMode" TEXT NOT NULL,
  "backgroundCrop" TEXT NOT NULL,
  "subjectAnchor" TEXT NOT NULL,
  "subjectScale" INTEGER NOT NULL,
  "depthLayer" TEXT NOT NULL,
  "lightingMode" TEXT NOT NULL,
  "occlusionMode" TEXT NOT NULL,
  "styleStrength" INTEGER NOT NULL,
  "fitToPhotoContent" INTEGER NOT NULL,
  "preserveBackgroundPhoto" INTEGER NOT NULL,
  "characterRenderStyle" TEXT NOT NULL,
  "characterRenderStyleCustomText" TEXT,
  "backgroundRenderStyle" TEXT NOT NULL,
  "backgroundRenderStyleCustomText" TEXT,
  "variationOfJobId" TEXT,
  "batchGroupId" TEXT,
  "prompt" TEXT NOT NULL,
  "promptBreakdown" TEXT NOT NULL,
  "negativePrompt" TEXT NOT NULL,
  "backgroundAnalysis" TEXT,
  "referenceAssetIds" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "resultAssetId" TEXT,
  "albumItemId" TEXT,
  "failureReason" TEXT,
  "codexWorkerId" TEXT,
  "codexWorkerClaimedAt" TEXT,
  "codexWorkerLeaseUntil" TEXT,
  "trashedAt" TEXT,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "CodexWorker" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TEXT,
  "expiresAt" TEXT,
  "revokedAt" TEXT,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "AlbumItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "generationJobId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "promptExcerpt" TEXT NOT NULL,
  "sourceMode" TEXT NOT NULL,
  "favorite" INTEGER NOT NULL,
  "createdAt" TEXT NOT NULL,
  "trashedAt" TEXT,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "ApiUsageLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "generationJobId" TEXT,
  "characterId" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT,
  "operationType" TEXT NOT NULL,
  "requestKind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "failureReason" TEXT,
  "promptChars" INTEGER NOT NULL,
  "promptTokens" INTEGER,
  "candidateTokens" INTEGER,
  "totalTokens" INTEGER,
  "sourceImageCount" INTEGER NOT NULL,
  "sourceImageBytes" INTEGER NOT NULL,
  "responseImageCount" INTEGER NOT NULL DEFAULT 0,
  "latencyMs" INTEGER NOT NULL,
  "estimatedCostMicros" INTEGER,
  "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AnonymousGenerationUsage_dateKey_userId_key" ON "AnonymousGenerationUsage" ("dateKey", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Character_userId_templateKey_key" ON "Character" ("userId", "templateKey");

CREATE INDEX IF NOT EXISTS "Character_userId_idx" ON "Character" ("userId");
CREATE INDEX IF NOT EXISTS "ReferencePack_userId_idx" ON "ReferencePack" ("userId");
CREATE INDEX IF NOT EXISTS "ReferencePack_characterId_idx" ON "ReferencePack" ("characterId");
CREATE INDEX IF NOT EXISTS "Asset_userId_idx" ON "Asset" ("userId");
CREATE INDEX IF NOT EXISTS "GenerationJob_userId_idx" ON "GenerationJob" ("userId");
CREATE INDEX IF NOT EXISTS "GenerationJob_userId_batchGroupId_idx" ON "GenerationJob" ("userId", "batchGroupId");
CREATE INDEX IF NOT EXISTS "GenerationJob_userId_provider_status_idx" ON "GenerationJob" ("userId", "provider", "status");
CREATE INDEX IF NOT EXISTS "GenerationJob_codexWorkerId_idx" ON "GenerationJob" ("codexWorkerId");
CREATE INDEX IF NOT EXISTS "CodexWorker_userId_idx" ON "CodexWorker" ("userId");
CREATE INDEX IF NOT EXISTS "CodexWorker_userId_revokedAt_expiresAt_lastSeenAt_idx" ON "CodexWorker" ("userId", "revokedAt", "expiresAt", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "AlbumItem_userId_idx" ON "AlbumItem" ("userId");
CREATE INDEX IF NOT EXISTS "ApiUsageLog_userId_createdAt_idx" ON "ApiUsageLog" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ApiUsageLog_createdAt_idx" ON "ApiUsageLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "ApiUsageLog_generationJobId_idx" ON "ApiUsageLog" ("generationJobId");
