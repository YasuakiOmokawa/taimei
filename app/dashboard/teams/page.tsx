import { Result } from "effect";
import Link from "next/link";
import { requireCompany } from "@/app/lib/auth-guard";
import { isManager } from "@/app/services/authorization-context";
import { Input } from "@/components/ui/input";
import { NAME_MAX_LENGTH } from "@/db/drizzle/schema";
import { lusitana } from "@/lib/fonts";
import { ActionForm } from "./action-form";
import { createTeam } from "./actions";
import { runTeamService } from "./run-team-service";

export default async function Page() {
  const { role } = await requireCompany({ returnTo: "/dashboard/teams" });
  const result = await runTeamService((s) => s.listTeams());
  const canManage = isManager(role);

  return (
    <div>
      <h1 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
        チーム
      </h1>
      {canManage && (
        <div className="mb-6">
          <ActionForm action={createTeam} submitLabel="チームを作る">
            <Input
              name="name"
              aria-label="チーム名"
              required
              maxLength={NAME_MAX_LENGTH}
              className="max-w-xs"
            />
          </ActionForm>
        </div>
      )}
      {Result.isFailure(result) ? (
        <p>チームを取得できませんでした</p>
      ) : (
        <TeamList
          teams={result.success}
          emptyMessage={
            canManage
              ? "チームがありません"
              : "まだどのチームにも割り当てられていません。管理者に割り当てを頼んでください"
          }
        />
      )}
    </div>
  );
}

function TeamList({
  teams,
  emptyMessage,
}: {
  teams: readonly { id: string; name: string }[];
  emptyMessage: string;
}) {
  if (teams.length === 0) return <p>{emptyMessage}</p>;

  return (
    <ul className="space-y-2">
      {teams.map((team) => (
        <li key={team.id}>
          <Link
            href={`/dashboard/teams/${team.id}`}
            className="underline underline-offset-4"
          >
            {team.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
