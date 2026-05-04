import { Data } from "effect";
// インフラエラー（認証サービスの通信障害）
// ドメインエラー（SessionError 等）とは区別し、呼び出し側で適切にハンドリングできるようにする
export class AuthServiceUnavailable extends Data.TaggedError("AuthServiceUnavailable") {
}
export class AuthServiceTimeout extends Data.TaggedError("AuthServiceTimeout") {
}
export class AuthServiceUnauthorized extends Data.TaggedError("AuthServiceUnauthorized") {
}
