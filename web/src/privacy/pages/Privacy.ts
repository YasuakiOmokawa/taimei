import { Array } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { privacyFacts } from "../facts";

export const title = "プライバシーポリシー";

const STORAGE_LOCATIONS: ReadonlyArray<string> = [
  `データベース (taimei): Neon (${privacyFacts.databaseRegion})`,
  `データベース (認証): Neon (${privacyFacts.authDatabaseRegion})`,
  "アプリ: Cloudflare",
  "認証: Cloudflare",
  "メールの送信: Resend",
  "エラーの記録: Sentry (米国)。入力した内容は送らない",
];

const sectionView = <Message>(
  heading: string,
  content: Html,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [h.Class("space-y-2")],
    [h.h2([h.Class("text-lg font-medium")], [heading]), content],
  );

export const view = <Message>(h: HtmlBuilder<Message>): Html =>
  h.main(
    [h.Class("mx-auto max-w-3xl space-y-8 px-4 py-12")],
    [
      h.h1([h.Class("font-lusitana text-2xl md:text-3xl")], [title]),
      sectionView(
        "預かる情報",
        h.p(
          [],
          [
            "認証 (taimei-auth) は、名前・メールアドレスと、所属する事業所での役割を預かります。taimei は事業所ごとに、チーム・スキル・チームへの割り当てと、各メンバーが自分について記入したレベルと学びたいを預かります。",
          ],
        ),
        h,
      ),
      sectionView(
        "使い道",
        h.p(
          [],
          [
            "星取表と、チームとしての集計 (偏り、スキルごとの学びたいの人数) の表示だけに使います。レベルと学びたいを、人の評価・ランキング・エクスポートに使いません。人ごとの合計も作りません。",
          ],
        ),
        h,
      ),
      sectionView(
        "見える人",
        h.p(
          [],
          [
            "星取表を見られるのは、同じ事業所の管理者 (OWNER・ADMIN) と、そのチームに割り当てられたメンバーです。レベルと学びたいを書けるのは本人だけで、管理者も他人の行を書き換えられません。ほかの事業所からは見えません。",
          ],
        ),
        h,
      ),
      sectionView(
        "保存場所",
        h.ul(
          [h.Class("list-disc space-y-1 pl-6")],
          Array.map(STORAGE_LOCATIONS, (location) => h.li([], [location])),
        ),
        h,
      ),
      sectionView(
        "消す時期",
        h.p(
          [],
          [
            `除名・退会・事業所の削除の後、1 時間ごとの処理で、taimei にあるその人・その事業所のデータを物理削除します (通常は数時間以内)。データベースの復元用の履歴には、消した後も ${privacyFacts.backupRetention}残ります。チーム・スキル・割り当てを消した時は、そこに記入したレベルと学びたいもすぐに消えます。`,
          ],
        ),
        h,
      ),
      sectionView("問い合わせ先", h.p([], [privacyFacts.contact]), h),
    ],
  );
