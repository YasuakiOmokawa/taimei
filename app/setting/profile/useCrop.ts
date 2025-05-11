"use client";

import { useCallback, useRef, useState } from "react";
import type { Area } from "react-easy-crop";

export function useCrop() {
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const croppedAreaPixelsRef = useRef(croppedAreaPixels);

  const onCropCompleteCallback = useCallback(
    (_: unknown, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
      croppedAreaPixelsRef.current = croppedAreaPixels;
    },
    [croppedAreaPixelsRef, setCroppedAreaPixels]
  );

  const generateCroppedImage = useCallback(
    async (url: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener("load", () => resolve(image));
        image.addEventListener("error", (error) => reject(error));
        image.crossOrigin = "anonymous";
        image.src = url;
      }),
    []
  );

  const getCroppedImage = async (
    imageSrc: string,
    pixelCrop: Area
  ): Promise<string> => {
    const image = await generateCroppedImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
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

    // キャンバスをBase64文字列に変換
    return canvas.toDataURL("image/jpeg");
  };

  return {
    getCroppedImage,
    croppedAreaPixelsRef,
    onCropCompleteCallback,
  };
}
