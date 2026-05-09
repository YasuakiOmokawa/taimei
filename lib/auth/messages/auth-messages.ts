export const AuthErrorCode = {
  MAGIC_LINK_FAILED: "magic_link_failed",
  SIGNIN_FAILED: "signin_failed",
  SIGNOUT_FAILED: "signout_failed",
  SYSTEM_ERROR: "system_error",
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  magic_link_failed: "メール送信に失敗しました。",
  signin_failed: "ログインに失敗しました。",
  signout_failed: "ログアウトに失敗しました。",
  system_error:
    "システムエラーが発生しました。しばらく時間をおいて再度お試しください。",
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
