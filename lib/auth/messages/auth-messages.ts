export const AuthErrorCode = {
  USER_NOT_FOUND: "user_not_found",
  USER_ALREADY_EXISTS: "user_already_exists",
  MAGIC_LINK_FAILED: "magic_link_failed",
  LOGIN_UNREGISTERED: "login_unregistered",
  ACCOUNT_NOT_LINKED: "account_not_linked",
  SIGNIN_FAILED: "signin_failed",
  SIGNOUT_FAILED: "signout_failed",
  SIGNUP_FAILED: "signup_failed",
  SYSTEM_ERROR: "system_error",
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  user_not_found: "アカウントが存在しません。",
  user_already_exists: "アカウントがすでに存在します。",
  magic_link_failed: "メール送信に失敗しました。",
  login_unregistered: "アカウントが存在しません。新規登録してください。",
  account_not_linked:
    "このメールアドレスのアカウントは既に存在します。ログイン後、設定画面からGitHubを連携できます。",
  signin_failed: "ログインに失敗しました。",
  signout_failed: "ログアウトに失敗しました。",
  signup_failed: "登録に失敗しました。",
  system_error: "システムエラーが発生しました。しばらく時間をおいて再度お試しください。",
};

export const AuthSuccessCode = {
  ACCOUNT_CREATED: "account_created",
  LOGGED_IN: "logged_in",
  MAGIC_LINK_SENT: "magic_link_sent",
  LOGGED_OUT: "logged_out",
} as const;

export type AuthSuccessCode =
  (typeof AuthSuccessCode)[keyof typeof AuthSuccessCode];

export const AUTH_SUCCESS_MESSAGES: Record<AuthSuccessCode, string> = {
  account_created: "アカウントを作成しました",
  logged_in: "ログインしました",
  magic_link_sent: "認証リンクをメールで送信しました。",
  logged_out: "ログアウトしました",
};

export function getAuthErrorMessage(code: string): string | undefined {
  if (code in AUTH_ERROR_MESSAGES) {
    return AUTH_ERROR_MESSAGES[code as AuthErrorCode];
  }
  return undefined;
}

export function getAuthSuccessMessage(code: string): string | undefined {
  if (code in AUTH_SUCCESS_MESSAGES) {
    return AUTH_SUCCESS_MESSAGES[code as AuthSuccessCode];
  }
  return undefined;
}
