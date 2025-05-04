"use client";

import React from "react";
import { toast } from "sonner";
import { BProgress } from "@bprogress/core";
import { deleteAvatar } from "@/app/lib/actions";

export function useAvatar(avatarUrl: string) {
  const [avatarPreview, setAvatarPreview] = React.useState<string | undefined>(
    avatarUrl
  );
  const [blobUrl, setBlobUrl] = React.useState<string>(avatarUrl);
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
    BProgress.start();
    const result = await deleteAvatar(blobUrl);
    if (result.status === "success") {
      setAvatarPreview(undefined);
      setBlobUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("アバターを削除しました");
    }
    BProgress.done();
  }, [avatarUrl, setAvatarPreview, deleteAvatar, setBlobUrl]);

  return {
    avatarPreview,
    updatePreview,
    fileInputRef,
    handleDeleteAvatar,
    blobUrl,
  };
}
