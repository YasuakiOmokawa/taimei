"use client";

import React from "react";
import { toast } from "sonner";
import { BProgress } from "@bprogress/core";
import { deleteAvatar } from "./actions";
import type { Area } from "react-easy-crop";
import { getCroppedImage, setFileFromCroppedImage } from "./cropUtils";

export function useAvatar(avatarUrl: string) {
  const [avatarPreview, setAvatarPreview] = React.useState<string>("");
  const [blobUrl, setBlobUrl] = React.useState<string>("");
  const [isCropModalOpen, setIsCropModalOpen] = React.useState(false);
  const [imageToEdit, setImageToEdit] = React.useState<string>("");

  const inputFileTypeRef = React.useRef("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const croppedAreaPixelsRef = React.useRef<Area>(null);

  React.useEffect(() => {
    setAvatarPreview(avatarUrl);
    setBlobUrl(avatarUrl);
  }, [avatarUrl]);

  const handleCropComplete = React.useCallback((croppedImage: string) => {
    setAvatarPreview(croppedImage);
    setIsCropModalOpen(false);
    setImageToEdit("");
  }, []);

  const onCropApply = React.useCallback(
    async (image: string) => {
      if (!croppedAreaPixelsRef.current) {
        toast.error("クロップされた結果がありません。");
        return;
      }

      if (!fileInputRef.current) {
        toast.error("アップロードされたファイルが存在しません。");
        return;
      }

      if (!inputFileTypeRef.current) {
        toast.error("アップロードされたファイルの形式が存在しません。");
        return;
      }

      try {
        const croppedImage = await getCroppedImage(
          fileInputRef.current.value,
          image,
          croppedAreaPixelsRef.current
        );
        handleCropComplete(croppedImage);
        setFileFromCroppedImage(
          croppedImage,
          fileInputRef.current,
          inputFileTypeRef.current
        );
        setIsCropModalOpen(false);
      } catch (e) {
        throw e;
      }
    },
    [handleCropComplete]
  );

  const onCropCompleteCallback = React.useCallback(
    (_: unknown, croppedAreaPixels: Area) => {
      croppedAreaPixelsRef.current = croppedAreaPixels;
    },
    []
  );

  const updatePreview = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        toast.success("ファイルが選択されていません。");
        return;
      }

      inputFileTypeRef.current = file.type;
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageDataUrl = reader.result as string;
        setImageToEdit(imageDataUrl);
        setIsCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const emptyPreview = () => {
    setAvatarPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteAvatar = React.useCallback(async () => {
    if (!blobUrl) {
      emptyPreview();
      toast.success("プレビューを削除しました");
      return;
    }

    BProgress.start();
    const result = await deleteAvatar(blobUrl);
    if (result.status === "success") {
      setBlobUrl("");
      emptyPreview();
      toast.success("アバターを削除しました");
    } else {
      toast.error(result.message);
    }
    BProgress.done();
  }, [setBlobUrl, blobUrl]);

  return {
    avatarPreview,
    updatePreview,
    fileInputRef,
    handleDeleteAvatar,
    blobUrl,
    isCropModalOpen,
    setIsCropModalOpen,
    imageToEdit,
    onCropCompleteCallback,
    onCropApply,
  };
}
