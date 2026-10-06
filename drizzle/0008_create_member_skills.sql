ALTER TABLE "skills" ADD CONSTRAINT "skills_id_team_id_company_id_unique" UNIQUE("id","team_id","company_id");--> statement-breakpoint
CREATE TABLE "member_skills" (
	"company_id" varchar(32) NOT NULL,
	"team_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"level" smallint NOT NULL,
	"wants_to_learn" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_skills_skill_id_user_id_pk" PRIMARY KEY("skill_id","user_id"),
	CONSTRAINT "member_skills_level_range" CHECK ("member_skills"."level" BETWEEN 0 AND 3)
);
--> statement-breakpoint
ALTER TABLE "member_skills" ADD CONSTRAINT "member_skills_assignment_fk" FOREIGN KEY ("team_id","user_id") REFERENCES "public"."team_assignments"("team_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_skills" ADD CONSTRAINT "member_skills_skill_fk" FOREIGN KEY ("skill_id","team_id","company_id") REFERENCES "public"."skills"("id","team_id","company_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_skills_team_id_user_id_idx" ON "member_skills" USING btree ("team_id","user_id");