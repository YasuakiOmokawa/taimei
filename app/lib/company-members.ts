import type { Member } from "@taimei-code/auth-client";
import { Result } from "effect";
import { runService } from "@/app/services";
import { CompanyMembers } from "@/app/services/company-members-service";
import { reportUnexpectedFailure } from "./team-failure";

export async function fetchCompanyMembers(): Promise<readonly Member[] | null> {
  const result = await runService(() =>
    CompanyMembers.use((companyMembers) => companyMembers.list),
  );
  if (Result.isSuccess(result)) return result.success;
  reportUnexpectedFailure(result.failure);
  return null;
}
