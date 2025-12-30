import {
  AuthSuccessCode,
  AUTH_SUCCESS_MESSAGES,
} from "@/lib/auth/messages/auth-messages";

// OAuth/Magic Link の認証フローでユーザー作成→セッション作成は通常1-2秒。
// 余裕を持たせて10秒とし、この期間内に作成されたユーザーは新規登録成功メッセージを表示
const NEW_USER_THRESHOLD_MS = 10000;

export const isJustSignedUp = (createdAt: Date): boolean =>
  Date.now() - createdAt.getTime() < NEW_USER_THRESHOLD_MS;

export const getAuthSuccessMessage = (
  createdAt: Date
): { type: "success"; message: string } => ({
  type: "success",
  message: isJustSignedUp(createdAt)
    ? AUTH_SUCCESS_MESSAGES[AuthSuccessCode.ACCOUNT_CREATED]
    : AUTH_SUCCESS_MESSAGES[AuthSuccessCode.LOGGED_IN],
});
