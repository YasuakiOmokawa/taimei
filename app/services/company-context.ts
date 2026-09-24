import { Context, Layer } from "effect";

// per-request の事業所コンテキスト。設計詳細: docs/adr/0002-company-data-scoping.md (D2)。
//
// scoping (どの company のデータか) のみを保持し、authorization (= 何ができるか) は持たない。
// companyId は認証済 session から境界の内側で導出され、呼出側は値を供給しない (IDOR 防御)。
// role 別の操作制限が要件化したら CompanyContext を拡張せず別層 (AuthorizationContext) を新設する。
interface CompanyContextShape {
  readonly companyId: string;
}

export class CompanyContext extends Context.Service<
  CompanyContext,
  CompanyContextShape
>()("services/CompanyContext") {
  static readonly layer = (ctx: CompanyContextShape) =>
    Layer.succeed(this, ctx);
}
