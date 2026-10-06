import type { LevelEntry } from "@/app/services/team-service";

export const levelFieldName = (skillId: string) => `level:${skillId}`;
export const wantsToLearnFieldName = (skillId: string) => `wants:${skillId}`;

const LEVEL_PREFIX = levelFieldName("");

export const parseLevelForm = (formData: FormData): LevelEntry[] =>
  [...formData.entries()].flatMap(([name, value]) => {
    if (!name.startsWith(LEVEL_PREFIX) || typeof value !== "string") return [];
    const skillId = name.slice(LEVEL_PREFIX.length);
    return [
      {
        skillId,
        level: value,
        wantsToLearn: formData.has(wantsToLearnFieldName(skillId)),
      },
    ];
  });
