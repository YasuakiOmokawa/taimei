-- Better Auth Migration: Auth.js → Better Auth
-- このマイグレーションは既存のAuth.jsテーブルをBetter Auth形式に変換します
-- E2E等の新規DBでは、Better Authテーブルのみを作成します

-- 1. 新しいテーブルを作成（Better Auth 形式）

-- user テーブル（新規作成）
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_key" ON "user" USING btree ("email");

-- session テーブル（新規作成）
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("user_id");

-- account テーブル（新規作成）
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("user_id");

-- verification テーブル（新規作成）
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

-- user_profile テーブル（新規作成）
CREATE TABLE IF NOT EXISTS "user_profile" (
  "id" text PRIMARY KEY NOT NULL,
  "bio" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_profile_userId_key" ON "user_profile" ("user_id");

-- 2. 既存データの移行（Auth.jsテーブルが存在する場合のみ実行）

-- User → user
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'User') THEN
    INSERT INTO "user" ("id", "name", "email", "email_verified", "image", "created_at", "updated_at")
    SELECT
      "id",
      COALESCE("name", ''),
      "email",
      CASE WHEN "emailVerified" IS NOT NULL THEN true ELSE false END,
      "image",
      "createdAt",
      "updatedAt"
    FROM "User"
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

-- Account → account
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Account') THEN
    INSERT INTO "account" ("id", "account_id", "provider_id", "user_id", "access_token", "refresh_token", "id_token", "scope", "created_at", "updated_at")
    SELECT
      gen_random_uuid()::text,
      "providerAccountId",
      "provider",
      "userId",
      "access_token",
      "refresh_token",
      "id_token",
      "scope",
      "createdAt",
      "updatedAt"
    FROM "Account"
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- UserProfile → user_profile
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'UserProfile') THEN
    INSERT INTO "user_profile" ("id", "bio", "user_id", "created_at", "updated_at")
    SELECT
      "id",
      "bio",
      "userId",
      "createdAt",
      "updatedAt"
    FROM "UserProfile"
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

-- VerificationToken → verification
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'VerificationToken') THEN
    INSERT INTO "verification" ("id", "identifier", "value", "expires_at", "created_at", "updated_at")
    SELECT
      gen_random_uuid()::text,
      "identifier",
      "token",
      "expires",
      NOW(),
      NOW()
    FROM "VerificationToken"
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 3. 旧テーブルの削除（移行後に実行）
-- 注意: データ移行が完了したことを確認してから実行すること

-- DROP TABLE IF EXISTS "Session" CASCADE;
-- DROP TABLE IF EXISTS "Account" CASCADE;
-- DROP TABLE IF EXISTS "UserProfile" CASCADE;
-- DROP TABLE IF EXISTS "VerificationToken" CASCADE;
-- DROP TABLE IF EXISTS "Authenticator" CASCADE;
-- DROP TABLE IF EXISTS "User" CASCADE;
