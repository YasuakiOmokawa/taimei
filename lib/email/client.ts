import { Resend } from "resend";

let resendInstance: Resend | null = null;

export function isTestEnvironment(): boolean {
  return process.env.APP_ENV === "test";
}

export function getResendClient(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.AUTH_RESEND_KEY;

    if (!apiKey) {
      throw new Error(
        "AUTH_RESEND_KEY is not configured. Please set it in .env file."
      );
    }

    resendInstance = new Resend(apiKey);
  }

  return resendInstance;
}

export function getFromEmail(): string {
  return process.env.AUTH_FROM_EMAIL || "onboarding@resend.dev";
}

export function getAppName(): string {
  return process.env.APP_NAME || "taimei";
}
