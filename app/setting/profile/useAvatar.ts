"use client";

import React from "react";
import { toast } from "sonner";
import { BProgress } from "@bprogress/core";
import { deleteAvatar } from "./actions";

export function useAvatar(avatarUrl: string) {
  const [avatarPreview, setAvatarPreview] = React.useState<string | undefined>(
    avatarUrl
  );
  const [blobUrl, setBlobUrl] = React.useState<string>(avatarUrl);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isCropModalOpen, setIsCropModalOpen] = React.useState(false);
  const [imageToEdit, setImageToEdit] = React.useState<string | null>(null);
  const fileMimeRefToCreateCroppedImage = React.useRef<string>(null);

  const updatePreview = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      fileMimeRefToCreateCroppedImage.current = file.type;

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
    setImageToEdit(null);
  }, []);

  const emptyPreview = () => {
    setAvatarPreview(undefined);
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

  // Base64文字列をFileオブジェクトに変換する関数の型を明示的に定義
  const dataURLtoFile = React.useCallback(
    (dataurl: string, filename: string): File => {
      const arr = dataurl.split(",");
      const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    },
    []
  );

  // クロップした画像をFileInputに設定する
  const setFileFromCroppedImage = React.useCallback(
    (croppedImageUrl: string) => {
      if (!fileInputRef.current) return;

      // 既存のDataTransferオブジェクトを作成
      const dataTransfer = new DataTransfer();

      // クロップした画像をFileオブジェクトに変換
      const file = dataURLtoFile(croppedImageUrl, "cropped-image.jpg");

      // DataTransferオブジェクトにファイルを追加
      dataTransfer.items.add(file);

      // input要素のfilesプロパティを更新
      fileInputRef.current.files = dataTransfer.files;
    },
    [dataURLtoFile]
  );

  // クロップ完了時の処理を拡張
  const onCropComplete = React.useCallback(
    (croppedImage: string) => {
      handleCropComplete(croppedImage);
      setFileFromCroppedImage(croppedImage);
    },
    [handleCropComplete, setFileFromCroppedImage]
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
    onCropComplete,
    fileMimeRefToCreateCroppedImage,
  };
}
