# ADR-0012: 画面を Foldkit の 2 つの application で書き、web の domain の境界を型にする

- **Status**: Accepted
- **Date**: 2026-11-14
- **References**: ADR-0006 (Static Assets の SPA と Worker)、ADR-0007 (SPA の API 契約)、taimei-auth の ADR-0023 (https://github.com/taimei-code/taimei-auth/blob/main/docs/adr/0023-web-foldkit.md)、taimei-auth の ADR-0025 (https://github.com/taimei-code/taimei-auth/blob/main/docs/adr/0025-web-domain-project-references.md)。移行は #666 とその子 issue (#667〜#688)

この ADR は ADR-0006 の router と prerender の決定と、ADR-0007 の「画面のデータ取得は Effect Atom」「router は TanStack Router」の決定を置き換える。ADR-0007 の API の契約の決定は残る。

## Context

画面は React・TanStack Router・Effect Atom で書いていた。taimei-auth は、web の規則のうち型か構造が止める割合を比べて Foldkit に移した (taimei-auth の ADR-0023。React は 7%、Foldkit は 20%)。taimei は「taimei-auth と揃えられるものは揃える」に従い、同じく Foldkit に移した。Foldkit を選んだ理由は taimei-auth の ADR-0023 にあり、ここでは繰り返さない。

この ADR には taimei だけの判断を書く。

## Decision

### application を 2 つに分ける

- application `public` は `/`・`/privacy`・知らない path を受け、application `dashboard` は `/dashboard` の下を受ける
- 入口 (`web/src/main.ts`) が path で 1 つだけを dynamic import して起動する。公開ページは dashboard の JS を読まない
- 2 つの application の間は document を読み直して移る。link の扱い (自分の route は画面の中で移り、ほかは document を読み直す) は `web/src/app/document-navigation.ts` の 1 か所が決める

### prerender の形

- build の時に、application `public` の起動の Command を済ませた Model を `renderToString` (`isHydratable: false`) で描き、`index.html` と `privacy.html` に書く (`web/prerender.ts`)。footer の年も HTML に入る
- client は hydrate せず、`Runtime.run` が描画済みの `#root` を置き換える。起動の描画には年が無いが、Command の結果が次の frame で入るので、年の無い footer は paint されない (e2e の `public.spec.ts` が見る)
- prerender していない path では、`web/index.html` の script が `#root` を空にしてから JS が描く。ランディングページは見えない

### cache の持ち方

- dashboard の cache は application `dashboard` の Model に 4 つ (自分・チームの一覧・チーム・メンバーの一覧) を持つ。browser には永続しない
- route に入る時、値が無ければ取得を待ち、在れば先に出して裏で取り直す。更新で cache を古くした後は、前の値を出さずに取り直しを待つ
- 取得の Command は要求の番号を結果に載せ、cache の番号と違う応答は捨てる (後から始めた取得の値が残る)
- link に hover すると、値が無い時だけ先読みする。先読みした cache は、次に入る 1 回は取り直さない
- 更新は、何を変えたか (`ChangedByMutation`) を省けない形で宣言し、application がそれを cache に反映する
- `web/index.html` が JS を待たずに始めた fetch は、client が GET の同じ path に 1 回だけ使う
- ADR-0007 の Consequences の 3 つ (focus と再接続での取り直し、失敗した読み取りの再試行、値が同じ取り直しで描き直さないこと) は、今もしない

### `web/` だけ oxlint

- `web/` の lint は oxlint (Foldkit の plugin と `lint/oxlint-plugin.mts` の `taimei/*` の rule) だけにし、それ以外は Biome にする。format はどちらも Biome
- Foldkit は規則を oxlint の plugin で配り、server の規則は Biome の plugin (`biome-plugins/`) に既に在る。両方で同じ file を lint しない

### domain の境界

- web の domain の境界は taimei-auth の ADR-0025 と同じ形で型にする。`web/domain-projects/` の project references を `bun run typecheck` が `tsc -b` で build し、参照していない project の file の import は TS6307 で落ちる
- 今の層は core・`shared`・domain (`landing`・`privacy`・`dashboard`)。`shared` は core だけ、domain は `shared` と core だけを参照する。page と試験と `app` の層は #688 で足す
- taimei の core は、契約 (`src/spa-contract.ts`) が型で辿る server の file をすべて `files` に並べる。契約が `RequestSession` の型を `src/services/` から import するので、`src/services/` と `db/` の file も入る。契約の module は変えない

## JS の大きさ

本番の web の JS の大きさは、vite の manifest から、入口と各 application から import を辿って読み込む chunk の大きさを足して測った。移行の後は `main` `156eb696a` の build で、本番の入口 (`assets/index-D6S96pGd.js`) と同じ hash である。gzip は node の `zlib.gzipSync` の既定。

| | 圧縮前 (byte) | gzip (byte) |
| :-- | --: | --: |
| 移行の前 (#667。公開ページが読む JS も合計も同じ) | 588,978 | 190,766 |
| 移行の後、公開ページが読む JS | 380,079 | 125,888 |
| 移行の後、dashboard が読む JS | 472,306 | 152,171 |
| 移行の後、合計 | 483,995 | 156,984 |

- どの値も移行の前を下回る
- 移行の前の値の gzip の測り方は記録が無く、確かめられない。移行の後の値との差は約 17% で、測り方の違いで上下が入れ替わる大きさではない
- #699 の本文の値 (dashboard が読む JS の gzip 196,895 など) は `gzip -9` で測っており、上の表と測り方が違う

## Consequences

- 画面の規則のうち型と lint が止めるものが増え、書き方は taimei-auth と揃う。Foldkit の書き方は `.claude/skills/` の skill が配る
- 境界の TS6307 は参照していない project の file を import したことを示す。意図しない依存 (別の domain や、`shared` から domain) なら import を直し、file を project の `include` や `files` に足して通さない。domain の新しい依存を意図するなら `references` を足す。契約が新しい server の file を import した時は、core の `files` に足す
- 参照される project は declaration を出す。export する推論の型が declaration に書けない時 (TS2742 など)、`-p web` は通り `tsc -b` だけが落ちる。export の型を書いて直す
- `landing` の project は今 page と試験しか持たず、include が何にも当たらない。include が何にも当たらない project は TS18003 で落ちるが、`references` を持つ project は落ちない (tsgo 7.0.2 で確かめた)。`landing` の `references` を外すか、TypeScript の版を上げて `landing` の project が TS18003 で落ちたら、原因はここである
- `bun run typecheck` は `tsc -b` の分だけ遅くなる (手元で全体 1.1 秒)
- 移行の後に残った点 (保存の Command の timeout、契約の外の失敗の記録、bfcache の復元、招待の行き先の 2 か所、font の差し替えで `/privacy` の見出しが動くこと、core が列挙する server の file を減らすこと) は #708 で扱う
