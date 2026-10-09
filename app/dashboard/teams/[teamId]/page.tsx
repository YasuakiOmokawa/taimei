import type { Member } from "@taimei-code/auth-client";
import { Result } from "effect";
import { notFound } from "next/navigation";
import { requireCompany } from "@/app/lib/auth-guard";
import { fetchCompanyMembers } from "@/app/lib/company-members";
import {
  BIAS_RULE,
  type Cell,
  type Roster,
  teamSkillMatrix,
} from "@/app/lib/skill-matrix";
import { isManager } from "@/app/services/authorization-context";
import { levelLabels, levelSymbols } from "@/app/services/level";
import type { TeamDetail } from "@/app/services/team-service";
import { Input } from "@/components/ui/input";
import { LEVELS, NAME_MAX_LENGTH } from "@/db/drizzle/schema";
import type { TeamId } from "@/db/ids";
import { lusitana } from "@/lib/fonts";
import { memberLabel } from "@/lib/member-label";
import { ActionForm } from "../action-form";
import {
  addSkill,
  assign,
  deleteTeam,
  removeSkill,
  renameTeam,
  saveMyLevels,
  unassign,
} from "../actions";
import { levelFieldName, wantsToLearnFieldName } from "../level-form";
import { runTeamService } from "../run-team-service";

export default async function Page({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { role, user } = await requireCompany({
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
  const { myCells, roster } = teamSkillMatrix(team, members, user.id);

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
        <h2 className="text-lg font-medium">星取表</h2>
        <SkillMatrix roster={roster} />
      </section>
      <MyLevelsForm teamId={team.id} cells={myCells} />
      <section className="space-y-2">
        <h2 className="text-lg font-medium">割り当てたメンバー</h2>
        <Assignments teamId={team.id} roster={roster} canManage={canManage} />
      </section>
    </div>
  );
}

function TeamSettingsForms({ team }: { team: TeamDetail }) {
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
        irreversibleWarning={`「${team.name}」を削除します。スキル・割り当て・記入したレベルも消え、元に戻せません。`}
      />
    </div>
  );
}

function Skills({ team, canManage }: { team: TeamDetail; canManage: boolean }) {
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
                  irreversibleWarning={`スキル「${skill.name}」を削除します。このスキルに記入したレベルも消え、元に戻せません。`}
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
  teamId,
  roster,
  canManage,
}: {
  teamId: TeamId;
  roster: Roster;
  canManage: boolean;
}) {
  if (roster._tag === "MembersUnavailable")
    return <p>メンバー一覧を取得できませんでした</p>;
  return (
    <>
      <AssignedMemberList
        teamId={teamId}
        assigned={roster.assigned}
        canManage={canManage}
      />
      {canManage ? (
        <ManagerAssignmentForms
          teamId={teamId}
          candidates={roster.candidates}
          departedUserIds={roster.departedUserIds}
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
              irreversibleWarning={unassignWarning(userId)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

const unassignWarning = (who: string) =>
  `${who} をこのチームから外します。このチームに記入したレベルも消え、元に戻せません。`;

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
              irreversibleWarning={unassignWarning(memberLabel(member))}
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

function SkillMatrix({ roster }: { roster: Roster }) {
  if (roster._tag === "MembersUnavailable")
    return <p>メンバー一覧を取得できませんでした</p>;
  if (roster._tag === "MatrixIncomplete")
    return <p>スキルと割り当てたメンバーがそろうと星取表が出ます</p>;
  const { rows, summaries } = roster;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th scope="col" className="px-2 py-1 text-left">
                メンバー
              </th>
              {summaries.map(({ skill }) => (
                <th key={skill.id} scope="col" className="px-2 py-1">
                  {skill.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, cells }) => (
              <tr key={member.userId} className="border-t">
                <th scope="row" className="px-2 py-1 text-left font-normal">
                  {memberLabel(member)}
                </th>
                {cells.map((cell) => (
                  <td key={cell.skill.id} className="px-2 py-1 text-center">
                    <CellContent cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t">
              <th scope="row" className="px-2 py-1 text-left">
                偏り
              </th>
              {summaries.map((summary) => (
                <td key={summary.skill.id} className="px-2 py-1 text-center">
                  {summary.isBiased ? "偏り" : ""}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-2 py-1 text-left">
                学びたい
              </th>
              {summaries.map((summary) => (
                <td key={summary.skill.id} className="px-2 py-1 text-center">
                  {summary.wantsToLearnCount}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        {LEVELS.map(levelOptionLabel).join(" / ")} / {UNRECORDED_MARK}: 未記入 /
        学: 学びたい。偏り: {levelLabels[BIAS_RULE.atOrAboveLevel]}以上の人が{" "}
        {BIAS_RULE.atMostPeople} 人以下
      </p>
    </>
  );
}

const UNRECORDED_MARK = "—";

function CellContent({ cell }: { cell: Cell }) {
  if (!cell.recorded)
    return (
      <>
        <span aria-hidden="true">{UNRECORDED_MARK}</span>
        <span className="sr-only">未記入</span>
      </>
    );
  return (
    <>
      <span aria-hidden="true">
        {levelSymbols[cell.level]}
        {cell.wantsToLearn ? "学" : ""}
      </span>
      <span className="sr-only">
        {levelLabels[cell.level]}
        {cell.wantsToLearn ? "、学びたい" : ""}
      </span>
    </>
  );
}

const levelOptionLabel = (level: (typeof LEVELS)[number]) =>
  `${levelSymbols[level] || "空欄"}: ${levelLabels[level]}`;

function MyLevelsForm({
  teamId,
  cells,
}: {
  teamId: TeamId;
  cells: readonly Cell[];
}) {
  if (cells.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">自分のレベル</h2>
      <ActionForm action={saveMyLevels.bind(null, teamId)} submitLabel="保存">
        <div className="space-y-2">
          {cells.map((cell) => (
            <div key={cell.skill.id} className="flex items-center gap-4">
              <span className="min-w-24">{cell.skill.name}</span>
              <select
                // defaultValue は mount の時にだけ初期値になるので、保存後の form の reset が古い値に戻さないよう保存値で作り直す
                key={cell.level}
                name={levelFieldName(cell.skill.id)}
                aria-label={`${cell.skill.name} のレベル`}
                defaultValue={cell.level}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {levelOptionLabel(level)}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  name={wantsToLearnFieldName(cell.skill.id)}
                  aria-label={`${cell.skill.name} を学びたい`}
                  defaultChecked={cell.wantsToLearn}
                />
                学びたい
              </label>
            </div>
          ))}
        </div>
      </ActionForm>
    </section>
  );
}
