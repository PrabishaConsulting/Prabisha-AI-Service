-- CreateEnum
CREATE TYPE "ProviderName" AS ENUM ('OPENAI', 'ANTHROPIC', 'GEMINI', 'MISTRAL', 'COHERE');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RATE_LIMITED', 'ERROR');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApiKeyScope" AS ENUM ('CHAT', 'IMAGE', 'VIDEO', 'EMBEDDINGS', 'ALL');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('SUCCESS', 'FAILED', 'FALLBACK_USED', 'CACHED');

-- CreateEnum
CREATE TYPE "Modality" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'EMBEDDING');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" UUID NOT NULL,
    "name" "ProviderName" NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "keyIv" VARCHAR(64) NOT NULL,
    "keyTag" VARCHAR(64) NOT NULL,
    "baseUrl" VARCHAR(500),
    "status" "ProviderStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "requestsThisMinute" INTEGER NOT NULL DEFAULT 0,
    "requestsThisDay" INTEGER NOT NULL DEFAULT 0,
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supportedModalities" "Modality"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_models" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "modelId" VARCHAR(150) NOT NULL,
    "displayName" VARCHAR(150) NOT NULL,
    "modality" "Modality" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inputPricePer1k" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outputPricePer1k" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contextWindow" INTEGER,
    "maxOutputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "keyHash" VARCHAR(255) NOT NULL,
    "keyPrefix" VARCHAR(12) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "scopes" "ApiKeyScope"[],
    "rpmLimit" INTEGER,
    "rpdLimit" INTEGER,
    "monthlyTokenLimit" BIGINT,
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "apiKeyId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "providerModelId" UUID NOT NULL,
    "modality" "Modality" NOT NULL,
    "status" "RequestStatus" NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "embeddingDimensions" INTEGER,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "requestId" VARCHAR(100) NOT NULL,
    "endpointPath" VARCHAR(100) NOT NULL,
    "isCached" BOOLEAN NOT NULL DEFAULT false,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "fallbackChain" TEXT[],
    "errorMessage" TEXT,
    "ipAddress" VARCHAR(45),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "id" UUID NOT NULL,
    "apiKeyId" UUID NOT NULL,
    "minuteCount" INTEGER NOT NULL DEFAULT 0,
    "dayCount" INTEGER NOT NULL DEFAULT 0,
    "minuteResetsAt" TIMESTAMP(3) NOT NULL,
    "dayResetsAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "providers_name_key" ON "providers"("name");

-- CreateIndex
CREATE INDEX "providers_status_isEnabled_idx" ON "providers"("status", "isEnabled");

-- CreateIndex
CREATE INDEX "providers_priority_idx" ON "providers"("priority");

-- CreateIndex
CREATE INDEX "provider_models_providerId_modality_idx" ON "provider_models"("providerId", "modality");

-- CreateIndex
CREATE UNIQUE INDEX "provider_models_providerId_modelId_key" ON "provider_models"("providerId", "modelId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_userId_status_idx" ON "api_keys"("userId", "status");

-- CreateIndex
CREATE INDEX "api_keys_status_expiresAt_idx" ON "api_keys"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "usage_logs_requestId_key" ON "usage_logs"("requestId");

-- CreateIndex
CREATE INDEX "usage_logs_userId_createdAt_idx" ON "usage_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "usage_logs_apiKeyId_createdAt_idx" ON "usage_logs"("apiKeyId", "createdAt");

-- CreateIndex
CREATE INDEX "usage_logs_providerId_createdAt_idx" ON "usage_logs"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "usage_logs_modality_status_idx" ON "usage_logs"("modality", "status");

-- CreateIndex
CREATE INDEX "usage_logs_requestId_idx" ON "usage_logs"("requestId");

-- CreateIndex
CREATE INDEX "usage_logs_createdAt_idx" ON "usage_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_buckets_apiKeyId_key" ON "rate_limit_buckets"("apiKeyId");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_apiKeyId_idx" ON "rate_limit_buckets"("apiKeyId");

-- AddForeignKey
ALTER TABLE "provider_models" ADD CONSTRAINT "provider_models_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_providerModelId_fkey" FOREIGN KEY ("providerModelId") REFERENCES "provider_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
