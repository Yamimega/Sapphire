"use client";

import { PhotoTile } from "@/components/photo-tile";
import type { PhotoWithUrls } from "@/types";

interface PhotoGridProps {
  photos: PhotoWithUrls[];
  onPhotoClick: (index: number) => void;
  onPhotoDelete?: (photoId: string) => void;
  onSetCover?: (photoId: string) => void;
  onEditCaption?: (photoId: string) => void;
  currentCoverId?: string | null;
  /** When true, images are rendered on canvas with protection */
  protected?: boolean;
}

export function PhotoGrid({ photos, onPhotoClick, onPhotoDelete, onSetCover, onEditCaption, currentCoverId, protected: isProtected }: PhotoGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {photos.map((photo, index) => (
        <PhotoTile
          key={photo.id}
          photo={photo}
          onClick={() => onPhotoClick(index)}
          onDelete={onPhotoDelete ? () => onPhotoDelete(photo.id) : undefined}
          onSetCover={onSetCover ? () => onSetCover(photo.id) : undefined}
          onEditCaption={onEditCaption ? () => onEditCaption(photo.id) : undefined}
          isCover={photo.contentHash === currentCoverId}
          protected={isProtected}
        />
      ))}
    </div>
  );
}
