import { Effect, Layer } from "effect";

// per-request の事業所コンテキスト。設計詳細: docs/adr/0002-company-data-scoping.md (D2)。
//
// scoping (どの company のデータか) のみを保持し、authorization (= 何ができるか) は持たない。
// companyId は認証済 session から境界の内側で導出され、呼出側は値を供給しない (IDOR 防御)。
// role 別の操作制限が要件化したら CompanyContext を拡張せず別層 (AuthorizationContext) を新設する。
export interface CompanyContextShape {
  readonly companyId: string;
}

// 本番は per-request 注入・テストは固定値注入の複数バリアントが要るため Effect.Tag を使う。
// 注入 helper は `layer` とする (Effect.Tag 組み込みの `of` は Service 値を返す別物で衝突するため)。
export class CompanyContext extends Effect.Tag("services/CompanyContext")<
  CompanyContext,
  CompanyContextShape
>() {
  static layer = (ctx: CompanyContextShape): Layer.Layer<CompanyContext> =>
    Layer.succeed(this, ctx);
}
