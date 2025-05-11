"use client";

import { useState, useCallback, useRef } from "react";
import type { Area, Point } from "react-easy-crop";
import Cropper from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface Props {
  image: string;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedImage: string) => void;
}

export function CropModal({ image, isOpen, onClose, onCropComplete }: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const croppedAreaPixelsRef = useRef(croppedAreaPixels);

  const onCropCompleteCallback = useCallback(
    (_: unknown, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
      croppedAreaPixelsRef.current = croppedAreaPixels;
    },
    []
  );

  const onCropChange = (crop: Point) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const createCroppedImage = async () => {
    if (!croppedAreaPixelsRef.current) return;

    try {
      const croppedImage = await getCroppedImg(
        image,
        croppedAreaPixelsRef.current
      );
      onCropComplete(croppedImage);
      onClose();
    } catch (e) {
      throw e;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>プロフィール画像の調整</DialogTitle>
        </DialogHeader>
        <div className="relative w-full h-[300px] my-4">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteCallback}
            onZoomChange={onZoomChange}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zoom">拡大・縮小</Label>
          <Slider
            id="zoom"
            min={1}
            max={3}
            step={0.1}
            value={[zoom]}
            onValueChange={(value) => setZoom(value[0])}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={createCroppedImage}>適用</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 画像のクロップ処理を行う関数
const createImage = async (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.crossOrigin = "anonymous";
    image.src = url;
  });

const getRadianAngle = (degreeValue: number) => {
  return (degreeValue * Math.PI) / 180;
};

const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0
): Promise<string> => {
  const image = await createImage(imageSrc);
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
  ctx.rotate(getRadianAngle(rotation));
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
