"use client";

import { useAuthMessage } from "@/lib/auth/messages/useAuthMessage";

export function AuthMessageHandler() {
  useAuthMessage();
  return null;
}
