CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(32) NOT NULL,
	"team_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_team_id_name_unique" UNIQUE("team_id","name")
);
--> statement-breakpoint
CREATE TABLE "team_assignments" (
	"company_id" varchar(32) NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_assignments_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(32) NOT NULL,
	"name" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_id_company_id_unique" UNIQUE("id","company_id"),
	CONSTRAINT "teams_company_id_name_unique" UNIQUE("company_id","name")
);
--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_team_id_company_id_teams_id_company_id_fk" FOREIGN KEY ("team_id","company_id") REFERENCES "public"."teams"("id","company_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_assignments" ADD CONSTRAINT "team_assignments_team_id_company_id_teams_id_company_id_fk" FOREIGN KEY ("team_id","company_id") REFERENCES "public"."teams"("id","company_id") ON DELETE cascade ON UPDATE no action;