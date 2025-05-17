"use client";

import React from "react";
import { toast } from "sonner";
import { BProgress } from "@bprogress/core";
import { deleteAvatar } from "./actions";
import type { Area } from "react-easy-crop";
import { generateCroppedImage } from "./utils";

export function useAvatar(avatarUrl: string) {
  const [avatarPreview, setAvatarPreview] = React.useState<string | undefined>(
    avatarUrl
  );
  const [blobUrl, setBlobUrl] = React.useState<string>(avatarUrl);
  const [isCropModalOpen, setIsCropModalOpen] = React.useState(false);
  const [imageToEdit, setImageToEdit] = React.useState<string | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(
    null
  );

  const inputFileTypeRef = React.useRef<string>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const croppedAreaPixelsRef = React.useRef(croppedAreaPixels);

  const onCropApply = async (image: string) => {
    if (!croppedAreaPixelsRef.current) {
      toast.success("クロップされた結果がありません。");
      return;
    }

    try {
      const croppedImage = await getCroppedImage(
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

  const getCroppedImage = async (
    imageSrc: string,
    pixelCrop: Area
  ): Promise<string> => {
    const image = await generateCroppedImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      toast.error("canvasの2Dコンテキストがありません");
      return "";
    }

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    // キャンバスの寸法を設定
    canvas.width = safeArea;
    canvas.height = safeArea;

    // キャンバスの中央に画像を描画
    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.translate(-safeArea / 2, -safeArea / 2);

    // 画像を描画
    ctx.drawImage(
      image,
      safeArea / 2 - image.width * 0.5,
      safeArea / 2 - image.height * 0.5
    );

    // クロップした領域のデータを取得
    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    // キャンバスのサイズをクロップ領域に合わせる
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // クロップした画像を描画
    ctx.putImageData(
      data,
      Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
      Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
    );

    if (!inputFileTypeRef.current) {
      toast.error("アップロードされたファイルに画像形式がありません");
      return "";
    }

    // キャンバスをBase64文字列に変換
    return canvas.toDataURL(inputFileTypeRef.current);
  };

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

  // Base64文字列をFileオブジェクトに変換
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

  const setFileFromCroppedImage = React.useCallback(
    (croppedImageUrl: string) => {
      if (!fileInputRef.current) return;

      const dataTransfer = new DataTransfer();
      const file = dataURLtoFile(croppedImageUrl, "cropped-image.jpg");

      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
    },
    [dataURLtoFile]
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
