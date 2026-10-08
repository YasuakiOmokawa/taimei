import { Context } from "effect";

// companyId は呼び手から受けず session から導出する (docs/adr/0002-company-data-scoping.md の D2)
export class CompanyContext extends Context.Service<
  CompanyContext,
  { readonly companyId: string }
>()("taimei/app/services/CompanyContext") {}
