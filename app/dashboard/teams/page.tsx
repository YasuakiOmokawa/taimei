import { Result } from "effect";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { requireCompany } from "@/app/lib/auth-guard";
import { isManager } from "@/app/services/authorization-context";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NAME_MAX_LENGTH } from "@/db/drizzle/schema";
import { ActionForm } from "./action-form";
import { createTeam } from "./actions";
import { runTeamService } from "./run-team-service";

export default async function Page() {
  const { role } = await requireCompany({ returnTo: "/dashboard/teams" });
  const result = await runTeamService((s) => s.listTeams);
  const canManage = isManager(role);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">チーム</h1>
        <p className="text-sm text-muted-foreground">
          チームを開くと、星取表を見て自分のレベルを記入できます
        </p>
      </div>
      <Card className="overflow-hidden">
        {canManage && (
          <CardHeader className="border-b">
            <ActionForm action={createTeam} submitLabel="チームを作る">
              <Input
                name="name"
                aria-label="チーム名"
                placeholder="チーム名"
                required
                maxLength={NAME_MAX_LENGTH}
                className="max-w-xs"
              />
            </ActionForm>
          </CardHeader>
        )}
        {Result.isFailure(result) ? (
          <CardMessage>チームを取得できませんでした</CardMessage>
        ) : (
          <TeamList
            teams={result.success}
            emptyMessage={
              canManage
                ? "まだチームがありません。チームを作ると、スキルを足してメンバーを割り当てられます"
                : "まだどのチームにも割り当てられていません。管理者に割り当てを頼んでください"
            }
          />
        )}
      </Card>
    </div>
  );
}

function CardMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-6 py-10 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function TeamList({
  teams,
  emptyMessage,
}: {
  teams: readonly { id: string; name: string }[];
  emptyMessage: string;
}) {
  if (teams.length === 0) return <CardMessage>{emptyMessage}</CardMessage>;

  return (
    <ul className="divide-y">
      {teams.map((team) => (
        <li key={team.id}>
          <Link
            href={`/dashboard/teams/${team.id}`}
            className="flex items-center justify-between gap-4 px-6 py-4 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            {team.name}
            <ChevronRight
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
