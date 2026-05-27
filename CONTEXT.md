# CONTEXT — app.taimei ドメイン用語集

app.taimei（taimei 本体 / consumer）のドメイン語彙。実装詳細は持たず、概念の定義と境界のみを記す。
認証・事業所・所属の語彙は taimei-auth 側で定義 (plans/taimei `ADR-009`)。ここでは本体ドメイン側の用語と、auth から借用する `company` の本体での意味を記す。

## 用語

### company（事業所）
taimei を利用する事業者そのもの。**課金単位かつデータ分離単位**（= 本体ドメインデータが帰属する境界）。実体は taimei-auth 側で管理され、本体は SDK `getSession().companyId` 経由でのみ識別子を知る（auth の identifier への論理参照。本体に company 実体テーブルは持たない）。本体の全ドメインデータ（customer / invoice / revenue / tag）は必ずいずれか 1 つの company に帰属する。

- **Avoid**: `tenant` / `organization` / `affiliation`（ADR-009 D2 / Q1 の語彙ルールと整合。データ分離の文脈でも "事業所単位の分離" と表現し "tenant 分離" とは書かない）

### customer（顧客 / 請求先）
ある company の請求先（invoice の宛先）。**company とは別概念**（company = taimei 利用者自身、customer = その利用者の取引先）。**company-private**: 同名の取引先でも company ごとに別の customer として持ち、company 間で共有・名寄せしない。

- freee も取引先/顧客マスタを事業所スコープで持ち社横断共有しない（共有は顧問 (advisor) 関係に限定）。taimei MVP は顧問概念を持たない（ADR-009 D3）ため company-private で確定。
- 社横断の顧客マスタ共有が要るのは将来の顧問機能導入時（再評価トリガー）。

### invoice（請求書）
ある company が customer に対して発行する請求。company に帰属し、customer を参照する。

- 現状 invoice は customer 情報のスナップショットを持たず参照のみ（customer 編集が過去 invoice の表示に遡及する）。freee は「請求書と取引先マスタの分離」で発行時ワンタイムコピーに変更済。taimei の invoice immutability は別 ADR 候補（`docs/adr/0002` Phase E+ 参照）。

### revenue（売上）
company 単位の月次売上集計。

### tag（タグ）
company 単位のラベル。invoice 等に付与する。company-private。
