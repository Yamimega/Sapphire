"use client";

import { useEffect, useState } from "react";
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

const GAP = 4;

function useRowHeight() {
  const [height, setHeight] = useState(220);
  useEffect(() => {
    const update = () => setHeight(window.innerWidth < 640 ? 140 : 220);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return height;
}

export function PhotoGrid({ photos, onPhotoClick, onPhotoDelete, onSetCover, onEditCaption, currentCoverId, protected: isProtected }: PhotoGridProps) {
  const rowHeight = useRowHeight();

  return (
    <div className="flex flex-wrap" style={{ gap: GAP }}>
      {photos.map((photo, index) => {
        const aspect = (photo.width && photo.height) ? photo.width / photo.height : 1;
        return (
          <div
            key={photo.id}
            style={{
              flexGrow: aspect,
              flexBasis: `${rowHeight * aspect}px`,
              minWidth: `${Math.min(rowHeight * aspect, 100)}px`,
              maxWidth: "100%",
            }}
          >
            <PhotoTile
              photo={photo}
              onClick={() => onPhotoClick(index)}
              onDelete={onPhotoDelete ? () => onPhotoDelete(photo.id) : undefined}
              onSetCover={onSetCover ? () => onSetCover(photo.id) : undefined}
              onEditCaption={onEditCaption ? () => onEditCaption(photo.id) : undefined}
              isCover={photo.contentHash === currentCoverId}
              protected={isProtected}
            />
          </div>
        );
      })}
      {/* Spacers prevent the last row from stretching when it has fewer photos */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={`spacer-${i}`} aria-hidden style={{ flexGrow: 100, height: 0 }} />
      ))}
    </div>
  );
}
