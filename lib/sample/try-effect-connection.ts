import { Effect, pipe } from "effect";

// 型定義
interface User {
  readonly name: string;
}
type NullableUser = Promise<User | null>;
type AuthFunc = () => NullableUser;

// 認可データの取得をシミュレートする関数
const auth1: AuthFunc = () => Promise.resolve({ name: "taro1" });
const auth2: AuthFunc = () => Promise.resolve({ name: "taro2" });
const notAuth: AuthFunc = () => Promise.resolve(null);

// 認可データから名前フィールドを取得するEffect
const fetchAuthUserName = (authFunc: AuthFunc) =>
  pipe(
    Effect.promise(() => authFunc()),
    Effect.filterOrFail(
      // 認可データがnullであればErrorとして処理する
      (user): user is User => user != null,
      () => new Error("unauthorized")
    ),
    Effect.andThen((user) => user.name)
  );
// 成功データと失敗データを両方保持するEffect。後続で表示するため
const partitionAuth = Effect.partition([auth1, auth2, notAuth], (auth) =>
  fetchAuthUserName(auth)
);

// Effectの外の世界から、Effectを実行する
async function fetchUserFromEffect() {
  const results = await Effect.runPromise(partitionAuth);
  console.log(`
############################################
error results from effect   : ${results[0]}
success results from effect : ${results[1]}
############################################
    `);
}
await fetchUserFromEffect();
