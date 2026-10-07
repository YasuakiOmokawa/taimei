-- 本番の行は開発者のテストデータだけなので、退避せずに消す。連鎖削除を付けず FK の向きに並べる (0006 と同じ)。
-- revision 列は taimei-auth の user だけが持つ。同じ database を指していたら、taimei-auth の表を消す前に止める。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'revision'
  ) THEN
    RAISE EXCEPTION 'public."user" has a revision column: this looks like the taimei-auth database';
  END IF;
END $$;--> statement-breakpoint
DROP TABLE IF EXISTS "session";--> statement-breakpoint
DROP TABLE IF EXISTS "account";--> statement-breakpoint
DROP TABLE IF EXISTS "user";--> statement-breakpoint
DROP TABLE IF EXISTS "verification";--> statement-breakpoint
DROP TABLE IF EXISTS "Session";--> statement-breakpoint
DROP TABLE IF EXISTS "Account";--> statement-breakpoint
DROP TABLE IF EXISTS "Authenticator";--> statement-breakpoint
DROP TABLE IF EXISTS "UserProfile";--> statement-breakpoint
DROP TABLE IF EXISTS "User";--> statement-breakpoint
DROP TABLE IF EXISTS "VerificationToken";--> statement-breakpoint
DROP TABLE IF EXISTS "_prisma_migrations";
