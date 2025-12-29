// OAuth/Magic Link の認証フローでユーザー作成→セッション作成は通常1-2秒。余裕を持たせて10秒。
const NEW_USER_THRESHOLD_MS = 10000;

export const isNewUser = (createdAt: Date): boolean =>
  Date.now() - createdAt.getTime() < NEW_USER_THRESHOLD_MS;

export const getSessionFlashMessage = (
  createdAt: Date
): { type: "success"; message: string } => ({
  type: "success",
  message: isNewUser(createdAt) ? "アカウントを作成しました" : "ログインしました",
});
