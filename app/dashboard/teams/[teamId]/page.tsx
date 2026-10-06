import type { Member } from "@taimei-code/auth-client";
import { type Effect, Result } from "effect";
import { notFound } from "next/navigation";
import { requireCompany } from "@/app/lib/auth-guard";
import { fetchCompanyMembers } from "@/app/lib/company-members";
import { splitByAssignment } from "@/app/lib/team-members";
import { isManager } from "@/app/services/authorization-context";
import type { TeamService } from "@/app/services/team-service";
import { Input } from "@/components/ui/input";
import { NAME_MAX_LENGTH } from "@/db/drizzle/schema";
import { lusitana } from "@/lib/fonts";
import { memberLabel } from "@/lib/member-label";
import { ActionForm } from "../action-form";
import {
  addSkill,
  assign,
  deleteTeam,
  removeSkill,
  renameTeam,
  unassign,
} from "../actions";
import { runTeamService } from "../run-team-service";

export default async function Page({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { role } = await requireCompany({
    returnTo: `/dashboard/teams/${teamId}`,
  });
  const result = await runTeamService((s) => s.getTeam(teamId));
  if (Result.isFailure(result)) {
    if (result.failure._tag === "TeamNotFound") notFound();
    return <p>チームを取得できませんでした</p>;
  }
  const team = result.success;
  const canManage = isManager(role);
  const members = await fetchCompanyMembers();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>
          {team.name}
        </h1>
        {canManage ? <TeamSettingsForms team={team} /> : null}
      </div>
      <Skills team={team} canManage={canManage} />
      <section className="space-y-2">
        <h2 className="text-lg font-medium">割り当てたメンバー</h2>
        <Assignments team={team} members={members} canManage={canManage} />
      </section>
    </div>
  );
}

type Team = Effect.Success<ReturnType<TeamService["Service"]["getTeam"]>>;

function TeamSettingsForms({ team }: { team: Team }) {
  return (
    <div className="flex flex-wrap gap-4">
      <ActionForm
        action={renameTeam.bind(null, team.id)}
        submitLabel="名前を変える"
      >
        <Input
          name="name"
          aria-label="チーム名"
          defaultValue={team.name}
          required
          maxLength={NAME_MAX_LENGTH}
          className="max-w-xs"
        />
      </ActionForm>
      <ActionForm
        action={deleteTeam.bind(null, team.id)}
        submitLabel="チームを削除"
        irreversibleWarning={`「${team.name}」を削除します。スキルと割り当ても消え、元に戻せません。`}
      />
    </div>
  );
}

function Skills({ team, canManage }: { team: Team; canManage: boolean }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">スキル</h2>
      {team.skills.length === 0 ? (
        <p>スキルがありません</p>
      ) : (
        <ul className="space-y-2">
          {team.skills.map((skill) => (
            <li key={skill.id} className="flex items-center gap-4">
              <span>{skill.name}</span>
              {canManage && (
                <ActionForm
                  action={removeSkill.bind(null, skill.id)}
                  submitLabel="削除"
                  irreversibleWarning={`スキル「${skill.name}」を削除します。元に戻せません。`}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <ActionForm
          action={addSkill.bind(null, team.id)}
          submitLabel="スキルを足す"
        >
          <Input
            name="name"
            aria-label="スキル名"
            required
            maxLength={NAME_MAX_LENGTH}
            className="max-w-xs"
          />
        </ActionForm>
      )}
    </section>
  );
}

function Assignments({
  team,
  members,
  canManage,
}: {
  team: Team;
  members: readonly Member[] | null;
  canManage: boolean;
}) {
  if (!members) return <p>メンバー一覧を取得できませんでした</p>;
  const { assigned, candidates, departedUserIds } = splitByAssignment(
    members,
    team.assignedUserIds,
  );
  return (
    <>
      <AssignedMemberList
        teamId={team.id}
        assigned={assigned}
        canManage={canManage}
      />
      {canManage ? (
        <ManagerAssignmentForms
          teamId={team.id}
          candidates={candidates}
          departedUserIds={departedUserIds}
        />
      ) : null}
    </>
  );
}

function ManagerAssignmentForms({
  teamId,
  candidates,
  departedUserIds,
}: {
  teamId: string;
  candidates: readonly Member[];
  departedUserIds: readonly string[];
}) {
  return (
    <>
      {candidates.length > 0 ? (
        <AssignForm teamId={teamId} candidates={candidates} />
      ) : null}
      {departedUserIds.length > 0 ? (
        <DepartedAssignmentList teamId={teamId} userIds={departedUserIds} />
      ) : null}
    </>
  );
}

function DepartedAssignmentList({
  teamId,
  userIds,
}: {
  teamId: string;
  userIds: readonly string[];
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">事業所にいない人の割り当て</h3>
      <ul className="space-y-2">
        {userIds.map((userId) => (
          <li key={userId} className="flex items-center gap-4">
            <span className="font-mono text-sm">{userId}</span>
            <ActionForm
              action={unassign.bind(null, teamId, userId)}
              submitLabel="外す"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssignedMemberList({
  teamId,
  assigned,
  canManage,
}: {
  teamId: string;
  assigned: readonly Member[];
  canManage: boolean;
}) {
  if (assigned.length === 0) return <p>割り当てたメンバーがいません</p>;
  return (
    <ul className="space-y-2">
      {assigned.map((member) => (
        <li key={member.userId} className="flex items-center gap-4">
          <span>{memberLabel(member)}</span>
          {canManage ? (
            <ActionForm
              action={unassign.bind(null, teamId, member.userId)}
              submitLabel="外す"
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function AssignForm({
  teamId,
  candidates,
}: {
  teamId: string;
  candidates: readonly Member[];
}) {
  return (
    <ActionForm action={assign.bind(null, teamId)} submitLabel="割り当てる">
      <select
        name="userId"
        aria-label="割り当てるメンバー"
        required
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        {candidates.map((member) => (
          <option key={member.userId} value={member.userId}>
            {memberLabel(member)}
          </option>
        ))}
      </select>
    </ActionForm>
  );
}
