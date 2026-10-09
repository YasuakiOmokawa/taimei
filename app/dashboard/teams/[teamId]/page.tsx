import type { Member } from "@taimei-code/auth-client";
import { Result } from "effect";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LEVELS, NAME_MAX_LENGTH } from "@/db/drizzle/schema";
import type { TeamId } from "@/db/ids";
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
    <div className="max-w-5xl space-y-6">
      <div className="space-y-2">
        <Link
          href="/dashboard/teams"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          チーム
        </Link>
        <h1 className="text-2xl font-semibold">{team.name}</h1>
      </div>
      <SkillMatrixCard roster={roster} />
      <MyLevelsForm teamId={team.id} cells={myCells} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Skills team={team} canManage={canManage} />
        <Assignments teamId={team.id} roster={roster} canManage={canManage} />
      </div>
      {canManage ? <TeamNameAndDeletion team={team} /> : null}
    </div>
  );
}

function TeamNameAndDeletion({ team }: { team: TeamDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>チーム名</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-4 border-t pt-6">
        <p className="text-sm text-muted-foreground">
          チームを削除すると、スキル・割り当て・記入したレベルも消えます
        </p>
        <ActionForm
          action={deleteTeam.bind(null, team.id)}
          submitLabel="チームを削除"
          irreversibleWarning={`「${team.name}」を削除します。スキル・割り当て・記入したレベルも消え、元に戻せません。`}
        />
      </CardFooter>
    </Card>
  );
}

function ListMessage({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-muted-foreground">{children}</p>;
}

function Skills({ team, canManage }: { team: TeamDetail; canManage: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>スキル</CardTitle>
        <CardDescription>星取表の列になります</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {team.skills.length === 0 ? (
          <ListMessage>スキルがありません</ListMessage>
        ) : (
          <ul className="divide-y border-y">
            {team.skills.map((skill) => (
              <li
                key={skill.id}
                className="flex min-h-12 items-center justify-between gap-4 text-sm"
              >
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
              placeholder="スキル名"
              required
              maxLength={NAME_MAX_LENGTH}
              className="max-w-xs"
            />
          </ActionForm>
        )}
      </CardContent>
    </Card>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>割り当てたメンバー</CardTitle>
        <CardDescription>星取表の行になります</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {roster._tag === "MembersUnavailable" ? (
          <ListMessage>メンバー一覧を取得できませんでした</ListMessage>
        ) : (
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
        )}
      </CardContent>
    </Card>
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
      <ul className="divide-y border-y">
        {userIds.map((userId) => (
          <li
            key={userId}
            className="flex min-h-12 items-center justify-between gap-4"
          >
            <span className="truncate font-mono text-xs text-muted-foreground">
              {userId}
            </span>
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
  if (assigned.length === 0)
    return <ListMessage>割り当てたメンバーがいません</ListMessage>;
  return (
    <ul className="divide-y border-y">
      {assigned.map((member) => (
        <li
          key={member.userId}
          className="flex min-h-12 items-center justify-between gap-4 text-sm"
        >
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
      <NativeSelect
        name="userId"
        aria-label="割り当てるメンバー"
        required
        className="max-w-xs flex-1"
      >
        {candidates.map((member) => (
          <option key={member.userId} value={member.userId}>
            {memberLabel(member)}
          </option>
        ))}
      </NativeSelect>
    </ActionForm>
  );
}

function SkillMatrixCard({ roster }: { roster: Roster }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>星取表</CardTitle>
      </CardHeader>
      <SkillMatrix roster={roster} />
    </Card>
  );
}

function SkillMatrix({ roster }: { roster: Roster }) {
  if (roster._tag === "MembersUnavailable")
    return (
      <CardContent>
        <ListMessage>メンバー一覧を取得できませんでした</ListMessage>
      </CardContent>
    );
  if (roster._tag === "MatrixIncomplete")
    return (
      <CardContent>
        <ListMessage>
          下のスキルを足してメンバーを割り当てると、ここに星取表が出ます
        </ListMessage>
      </CardContent>
    );
  const { rows, summaries } = roster;

  return (
    <>
      <div className="border-y">
        <Table className="w-auto">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="min-w-48 pl-6">
                メンバー
              </TableHead>
              {summaries.map(({ skill }) => (
                <TableHead
                  key={skill.id}
                  scope="col"
                  className="min-w-28 whitespace-nowrap text-center"
                >
                  {skill.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ member, cells }) => (
              <TableRow key={member.userId}>
                <TableHead
                  scope="row"
                  className="whitespace-nowrap pl-6 font-normal text-foreground"
                >
                  {memberLabel(member)}
                </TableHead>
                {cells.map((cell) => (
                  <TableCell key={cell.skill.id} className="py-3 text-center">
                    <CellContent cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-transparent">
            <TableRow className="hover:bg-transparent">
              <TableHead scope="row" className="pl-6">
                偏り
              </TableHead>
              {summaries.map((summary) => (
                <TableCell key={summary.skill.id} className="py-3 text-center">
                  {summary.isBiased ? (
                    <Badge className="border-transparent bg-destructive/10 text-destructive hover:bg-destructive/10">
                      偏り
                    </Badge>
                  ) : null}
                </TableCell>
              ))}
            </TableRow>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="row" className="pl-6">
                学びたい
              </TableHead>
              {summaries.map((summary) => (
                <TableCell
                  key={summary.skill.id}
                  className="py-3 text-center tabular-nums"
                >
                  {summary.wantsToLearnCount}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <Legend />
    </>
  );
}

const UNRECORDED_MARK = "—";

function Legend() {
  return (
    <CardFooter className="flex-wrap gap-x-4 gap-y-1 pt-4 text-xs text-muted-foreground">
      {[...LEVELS].reverse().map((level) => (
        <span key={level}>
          <span className="font-symbol font-semibold text-foreground">
            {levelSymbols[level] || "空欄"}
          </span>{" "}
          {levelLabels[level]}
        </span>
      ))}
      <span>
        <span className="font-semibold text-foreground">{UNRECORDED_MARK}</span>{" "}
        未記入
      </span>
      <span>
        <span className="font-semibold text-foreground">学</span> 学びたい
      </span>
      <span>
        <span className="font-semibold text-foreground">偏り</span>{" "}
        {levelLabels[BIAS_RULE.atOrAboveLevel]}以上の人が{" "}
        {BIAS_RULE.atMostPeople} 人以下
      </span>
    </CardFooter>
  );
}

function CellContent({ cell }: { cell: Cell }) {
  if (!cell.recorded)
    return (
      <>
        <span aria-hidden="true" className="text-muted-foreground">
          {UNRECORDED_MARK}
        </span>
        <span className="sr-only">未記入</span>
      </>
    );
  return (
    <>
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        <span className="font-symbol text-lg leading-none">
          {levelSymbols[cell.level]}
        </span>
        {cell.wantsToLearn ? (
          <Badge variant="secondary" className="px-1.5">
            学
          </Badge>
        ) : null}
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
    <Card>
      <CardHeader>
        <CardTitle>自分のレベル</CardTitle>
        <CardDescription>記入すると星取表の自分の行に出ます</CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={saveMyLevels.bind(null, teamId)} submitLabel="保存">
          <ul className="w-full divide-y border-y">
            {cells.map((cell) => (
              <li
                key={cell.skill.id}
                className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-2 py-2 text-sm"
              >
                <span className="min-w-32 font-medium">{cell.skill.name}</span>
                <NativeSelect
                  // defaultValue は mount の時にだけ初期値になるので、保存後の form の reset が古い値に戻さないよう保存値で作り直す
                  key={cell.level}
                  name={levelFieldName(cell.skill.id)}
                  aria-label={`${cell.skill.name} のレベル`}
                  defaultValue={cell.level}
                  className="font-symbol"
                >
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {levelOptionLabel(level)}
                    </option>
                  ))}
                </NativeSelect>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name={wantsToLearnFieldName(cell.skill.id)}
                    aria-label={`${cell.skill.name} を学びたい`}
                    defaultChecked={cell.wantsToLearn}
                    className="size-4 rounded border-input text-primary focus:ring-ring"
                  />
                  学びたい
                </label>
              </li>
            ))}
          </ul>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
