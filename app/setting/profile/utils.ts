"use client";

import { Area } from "react-easy-crop";

export const getInitials = (name: string) => {
  return (
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2) || "??"
  );
};

export const setFileFromCroppedImage = (
  croppedImageUrl: string,
  fileInput: HTMLInputElement,
  inputFileType: string
) => {
  const dataTransfer = new DataTransfer();
  const fileExtension = inputFileType.split("/").at(1);
  const file = dataURLtoFile(croppedImageUrl, `cropped-image.${fileExtension}`);

  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
};

const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

export const generateCroppedImage = async (
  url: string
): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.crossOrigin = "anonymous";
    image.src = url;
  });

export const getCroppedImage = async (
  fileType: string,
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
  return canvas.toDataURL(fileType);
};
