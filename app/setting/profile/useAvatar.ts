"use client";

import React from "react";
import { toast } from "sonner";
import { BProgress } from "@bprogress/core";
import { deleteAvatar } from "./actions";
import type { Area } from "react-easy-crop";
import { dataURLtoFile, getCroppedImage } from "./utils";

export function useAvatar(avatarUrl: string) {
  const [avatarPreview, setAvatarPreview] = React.useState<string>("");
  const [blobUrl, setBlobUrl] = React.useState<string>("");
  const [isCropModalOpen, setIsCropModalOpen] = React.useState(false);
  const [imageToEdit, setImageToEdit] = React.useState<string>("");
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(
    null
  );

  const inputFileTypeRef = React.useRef<string>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const croppedAreaPixelsRef = React.useRef(croppedAreaPixels);

  React.useEffect(() => {
    setAvatarPreview(avatarUrl);
    setBlobUrl(avatarUrl);
  }, [avatarUrl]);

  const onCropApply = async (image: string) => {
    if (!croppedAreaPixelsRef.current) {
      toast.error("クロップされた結果がありません。");
      return;
    }

    if (!fileInputRef.current) {
      toast.error("変換する画像形式がされていません。");
      return;
    }

    try {
      const croppedImage = await getCroppedImage(
        fileInputRef.current.value,
        image,
        croppedAreaPixelsRef.current
      );
      handleCropComplete(croppedImage);
      setFileFromCroppedImage(croppedImage);
      setIsCropModalOpen(false);
    } catch (e) {
      throw e;
    }
  };

  const onCropCompleteCallback = React.useCallback(
    (_: unknown, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
      croppedAreaPixelsRef.current = croppedAreaPixels;
    },
    [croppedAreaPixelsRef, setCroppedAreaPixels]
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

  const handleCropComplete = React.useCallback((croppedImage: string) => {
    setAvatarPreview(croppedImage);
    setIsCropModalOpen(false);
    setImageToEdit("");
  }, []);

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

  const setFileFromCroppedImage = React.useCallback(
    (croppedImageUrl: string) => {
      if (!fileInputRef.current) return;
      if (!inputFileTypeRef.current) return;

      const dataTransfer = new DataTransfer();
      const fileExtension = inputFileTypeRef.current.split("/").at(1);
      const file = dataURLtoFile(
        croppedImageUrl,
        `cropped-image.${fileExtension}`
      );

      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
    },
    []
  );

  return {
    avatarPreview,
    updatePreview,
    fileInputRef,
    handleDeleteAvatar,
    blobUrl,
    isCropModalOpen,
    setIsCropModalOpen,
    imageToEdit,
    inputFileTypeRef,
    onCropApply,
    onCropCompleteCallback,
  };
}
