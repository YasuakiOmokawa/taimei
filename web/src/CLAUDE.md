# web/src

コンポーネントの表示・スナップショット・DOM のテストは書かない。テストしたいロジックは `web/src/api-internal.ts` の atom・hook か、描画から切り離した module (`web/src/dashboard/level.ts` など) に移し、そちらを Vitest で検証する。例外は、公開する文面を検査する `web/src/privacy/__tests__/privacy-page.test.ts` だけ。
