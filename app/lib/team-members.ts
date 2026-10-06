import type { Member } from "@taimei-code/auth-client";

export const splitByAssignment = (
  members: readonly Member[],
  assignedUserIds: readonly string[],
) => {
  const assignedIds = new Set(assignedUserIds);
  const memberIds = new Set(members.map((m) => m.userId));
  return {
    assigned: members.filter((m) => assignedIds.has(m.userId)),
    candidates: members.filter((m) => !assignedIds.has(m.userId)),
    departedUserIds: assignedUserIds.filter((id) => !memberIds.has(id)),
  };
};
