import type { Member } from "@taimei-code/auth-client";
import { Result } from "effect";
import { runScopedService } from "@/app/services";
import { CompanyMembers } from "@/app/services/company-members-service";
import { reportUnexpectedFailure } from "./report-failure";

export async function fetchCompanyMembers(): Promise<readonly Member[] | null> {
  const result = await runScopedService(() =>
    CompanyMembers.use((companyMembers) => companyMembers.list),
  );
  if (Result.isSuccess(result)) return result.success;
  reportUnexpectedFailure(result.failure);
  return null;
}
