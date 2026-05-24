-- First, drop foreign key constraints
ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "api_keys_userId_fkey";
ALTER TABLE "usage_logs" DROP CONSTRAINT IF EXISTS "usage_logs_userId_fkey";
ALTER TABLE "usage_logs" DROP CONSTRAINT IF EXISTS "usage_logs_apiKeyId_fkey";
ALTER TABLE "usage_logs" DROP CONSTRAINT IF EXISTS "usage_logs_providerId_fkey";
ALTER TABLE "usage_logs" DROP CONSTRAINT IF EXISTS "usage_logs_providerModelId_fkey";
ALTER TABLE "provider_models" DROP CONSTRAINT IF EXISTS "provider_models_providerId_fkey";

-- Convert UUID columns to TEXT
ALTER TABLE "users" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "api_keys" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "api_keys" ALTER COLUMN "userId" TYPE TEXT;
ALTER TABLE "usage_logs" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "usage_logs" ALTER COLUMN "userId" TYPE TEXT;
ALTER TABLE "usage_logs" ALTER COLUMN "apiKeyId" TYPE TEXT;
ALTER TABLE "usage_logs" ALTER COLUMN "providerId" TYPE TEXT;
ALTER TABLE "usage_logs" ALTER COLUMN "providerModelId" TYPE TEXT;
ALTER TABLE "providers" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "provider_models" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "provider_models" ALTER COLUMN "providerId" TYPE TEXT;
ALTER TABLE "rate_limit_buckets" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "rate_limit_buckets" ALTER COLUMN "apiKeyId" TYPE TEXT;

-- Re-add foreign key constraints
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_providerModelId_fkey" FOREIGN KEY ("providerModelId") REFERENCES "provider_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_models" ADD CONSTRAINT "provider_models_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop and recreate default values for ID columns
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "api_keys" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "usage_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "providers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "provider_models" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "rate_limit_buckets" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();