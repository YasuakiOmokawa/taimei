-- Base tables (excluding Auth tables which are handled in 0001)

CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"image_url" varchar(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS "tags2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"amount" integer NOT NULL,
	"status" varchar(255) NOT NULL,
	"date" date DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"customer_id" uuid NOT NULL,
	"created_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "revenue" (
	"month" varchar(4) NOT NULL,
	"revenue" integer NOT NULL,
	"created_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "_invoicesTotags" (
	"A" uuid NOT NULL,
	"B" uuid NOT NULL,
	CONSTRAINT "_invoicesTotags_AB_pkey" PRIMARY KEY("A","B")
);

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_customer_id_fkey') THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_invoicesTotags_A_fkey') THEN
    ALTER TABLE "_invoicesTotags" ADD CONSTRAINT "_invoicesTotags_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_invoicesTotags_B_fkey') THEN
    ALTER TABLE "_invoicesTotags" ADD CONSTRAINT "_invoicesTotags_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "revenue_month_key" ON "revenue" USING btree ("month" text_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "_invoicesTotags_B_index" ON "_invoicesTotags" USING btree ("B" uuid_ops);
