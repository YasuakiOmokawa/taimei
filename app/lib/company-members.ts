import type { Member } from "@taimei-code/auth-client";
import { Result } from "effect";
import { runService } from "@/app/services";
import { CompanyMembers } from "@/app/services/company-members-service";

export function fetchCompanyMembers(): Promise<readonly Member[] | null> {
  return runService(() =>
    CompanyMembers.use((companyMembers) => companyMembers.list),
  ).then(Result.getOrNull);
}
