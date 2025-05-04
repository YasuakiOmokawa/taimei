"use client";

import React from "react";
import { toast } from "sonner";
import { BProgress } from "@bprogress/core";
import { deleteAvatar } from "@/app/lib/actions";

export function useAvatar(avatarUrl: string) {
  const [avatarPreview, setAvatarPreview] = React.useState<string | undefined>(
    avatarUrl || undefined
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const updatePreview = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    [setAvatarPreview]
  );

  const handleDeleteAvatar = React.useCallback(async () => {
    if (!avatarUrl) {
      setAvatarPreview(undefined);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    BProgress.start();
    const result = await deleteAvatar(avatarUrl);
    if (result.status === "success") {
      setAvatarPreview(undefined);
      if (fileInputRef.current) fileInputRef.current.value = "";
      avatarUrl = "";
      toast.success("アバターを削除しました");
    } else {
      toast.error(result.message ?? "予期せぬエラーが発生しました");
    }
    BProgress.done();
  }, [avatarUrl, setAvatarPreview, deleteAvatar]);

  return {
    avatarPreview,
    updatePreview,
    fileInputRef,
    handlDeleteAvatar,
  };
}
