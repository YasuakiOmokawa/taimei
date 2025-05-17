"use client";

import { useState } from "react";
import type { Point } from "react-easy-crop";
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
import type { Area } from "react-easy-crop";
import { BProgress } from "@bprogress/core";

interface Props {
  image: string;
  isOpen: boolean;
  onClose: () => void;
  onCropCompleteCallback: (_: unknown, croppedAreaPixels: Area) => void;
  onCropApply: (image: string) => Promise<void>;
}

export function CropModal({
  image,
  isOpen,
  onClose,
  onCropCompleteCallback,
  onCropApply,
}: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const onCropChange = (crop: Point) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const handleClickApply = async () => {
    BProgress.start();
    await onCropApply(image);
    BProgress.done();
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
          <Button onClick={handleClickApply}>適用</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
