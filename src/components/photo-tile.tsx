"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Trash2, ImageIcon, MessageSquare } from "lucide-react";
import type { PhotoWithUrls } from "@/types";
import { useTranslation } from "@/lib/i18n/context";
import { BlobImage } from "@/components/blob-image";
import { ProtectedImage } from "@/components/protected-image";

interface PhotoTileProps {
  photo: PhotoWithUrls;
  onClick: () => void;
  onDelete?: () => void;
  onSetCover?: () => void;
  onEditCaption?: () => void;
  isCover?: boolean;
  /** When true, render on canvas with protection (non-downloadable gallery for guests) */
  protected?: boolean;
}

export function PhotoTile({ photo, onClick, onDelete, onSetCover, onEditCaption, isCover, protected: isProtected }: PhotoTileProps) {
  const { t } = useTranslation();
  const aspect = (photo.width && photo.height) ? photo.width / photo.height : 1;

  return (
    <div className="group relative overflow-hidden rounded-lg shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div style={{ paddingBottom: `${100 / aspect}%` }} className="relative">
        <button
          onClick={onClick}
          className="absolute inset-0 cursor-pointer touch-manipulation"
          aria-label={`View ${photo.filename}`}
        >
          {isProtected ? (
            <ProtectedImage
              src={photo.thumbnailUrl}
              alt={photo.caption || photo.filename}
              className="h-full w-full"
            />
          ) : (
            <BlobImage
              src={photo.thumbnailUrl}
              alt={photo.caption || photo.filename}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              style={{
                backgroundImage: `url(${photo.blurDataUrl})`,
                backgroundSize: "cover",
              }}
            />
          )}
          <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/10" />
        </button>
      </div>
      {/* Badges */}
      <div className="absolute bottom-1 left-1 flex gap-1">
        {isCover && (
          <Badge variant="secondary" className="gap-1 text-[10px] backdrop-blur-sm bg-background/80">
            <ImageIcon className="h-3 w-3" />
            {t("gallery.cover")}
          </Badge>
        )}
        {photo.caption && (
          <Badge variant="secondary" className="gap-1 text-[10px] backdrop-blur-sm bg-background/80">
            <MessageSquare className="h-3 w-3" />
          </Badge>
        )}
      </div>
      {(onDelete || onSetCover || onEditCaption) && (
        <div className="absolute top-1 right-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 md:group-hover:opacity-100 max-md:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="h-8 w-8 md:h-7 md:w-7 backdrop-blur-sm bg-background/80">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onSetCover && !isCover && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetCover();
                  }}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  {t("gallery.setCover")}
                </DropdownMenuItem>
              )}
              {onEditCaption && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditCaption();
                  }}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {t("photo.editCaption")}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("delete.confirm")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
