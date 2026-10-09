"use server";

import { Result } from "effect";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type FailureMessage, failureMessage } from "@/app/lib/team-failure";
import type { TeamFailure } from "@/app/services/team-errors";
import { parseLevelForm } from "./level-form";
import { runTeamManagement, runTeamService } from "./run-team-service";

const formText = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

const submit = async <A>(
  pendingResult: Promise<Result.Result<A, TeamFailure>>,
  onSuccess: (value: A) => void,
): Promise<FailureMessage> => {
  const result = await pendingResult;
  if (Result.isFailure(result)) return failureMessage(result.failure);
  onSuccess(result.success);
  return null;
};

const refreshTeamPage = () =>
  revalidatePath("/dashboard/teams/[teamId]", "page");

export async function createTeam(
  _state: FailureMessage,
  formData: FormData,
): Promise<FailureMessage> {
  return submit(
    runTeamManagement((s) => s.createTeam(formText(formData, "name"))),
    (team) => redirect(`/dashboard/teams/${team.id}`),
  );
}

export async function renameTeam(
  teamId: string,
  _state: FailureMessage,
  formData: FormData,
): Promise<FailureMessage> {
  return submit(
    runTeamManagement((s) => s.renameTeam(teamId, formText(formData, "name"))),
    refreshTeamPage,
  );
}

export async function deleteTeam(teamId: string): Promise<FailureMessage> {
  return submit(
    runTeamManagement((s) => s.deleteTeam(teamId)),
    () => redirect("/dashboard/teams"),
  );
}

export async function addSkill(
  teamId: string,
  _state: FailureMessage,
  formData: FormData,
): Promise<FailureMessage> {
  return submit(
    runTeamManagement((s) => s.addSkill(teamId, formText(formData, "name"))),
    refreshTeamPage,
  );
}

export async function removeSkill(skillId: string): Promise<FailureMessage> {
  return submit(
    runTeamManagement((s) => s.removeSkill(skillId)),
    refreshTeamPage,
  );
}

export async function saveMyLevels(
  teamId: string,
  _state: FailureMessage,
  formData: FormData,
): Promise<FailureMessage> {
  return submit(
    runTeamService((s) => s.saveMyLevels(teamId, parseLevelForm(formData))),
    refreshTeamPage,
  );
}

export async function assign(
  teamId: string,
  _state: FailureMessage,
  formData: FormData,
): Promise<FailureMessage> {
  return submit(
    runTeamManagement((s) => s.assign(teamId, formText(formData, "userId"))),
    refreshTeamPage,
  );
}

export async function unassign(
  teamId: string,
  userId: string,
): Promise<FailureMessage> {
  return submit(
    runTeamManagement((s) => s.unassign(teamId, userId)),
    refreshTeamPage,
  );
}
