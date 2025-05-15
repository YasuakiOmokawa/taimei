"use client";

import React from "react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2 } from "lucide-react";
import { FieldMetadata } from "@conform-to/react";
import { useAvatar } from "./useAvatar";
import { getInitials } from "./utils";
import { CropModal } from "./crop-modal";

interface Props {
  avatarUrl: string;
  userName: string;
  avatarField: FieldMetadata<File | undefined>;
  avatarUrlField: FieldMetadata<string | undefined>;
}

export function AvatarUpload({
  avatarUrl,
  userName,
  avatarField,
  avatarUrlField,
}: Props) {
  const {
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
  } = useAvatar(avatarUrl);

  return (
    <div className="flex flex-col items-center gap-4 p-4 rounded-lg bg-muted/10">
      <div className="relative">
        <Avatar className="w-28 h-28 border-2 border-muted">
          <AvatarImage src={avatarPreview} alt="プロフィール画像" />
          <AvatarFallback>{getInitials(userName)}</AvatarFallback>
        </Avatar>
        {avatarPreview && (
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-8 w-8 rounded-full"
            onClick={() => {
              handleDeleteAvatar();
            }}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">アバターを削除</span>
          </Button>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 w-full">
        <p className="text-sm font-medium">プロフィール画像</p>
        <input
          type="file"
          id="avatar"
          name={avatarField.name}
          key={avatarField.key}
          accept="image/png, image/jpeg, image/jpg, image/webp"
          className="hidden"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            updatePreview(e);
          }}
          ref={fileInputRef}
        />
        <input type="hidden" name={avatarUrlField.name} value={blobUrl} />

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
        >
          画像を選択
        </Button>

        {avatarField.errors &&
          avatarField.errors.map((error, index) => (
            <p key={`${error}-${index}`} className="text-xs text-red-500">
              {error}
            </p>
          ))}
        <p className="text-xs text-muted-foreground">
          JPG、PNG、WEBP形式（最大5MB）
        </p>
      </div>

      {imageToEdit && (
        <CropModal
          image={imageToEdit}
          isOpen={isCropModalOpen}
          onClose={() => setIsCropModalOpen(false)}
          onCropCompleteCallback={onCropCompleteCallback}
          onCropApply={onCropApply}
        />
      )}
    </div>
  );
}
