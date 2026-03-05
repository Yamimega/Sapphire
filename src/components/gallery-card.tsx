"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EyeOff, ImageIcon, Lock } from "lucide-react";
import type { GalleryWithMeta } from "@/types";
import { useTranslation } from "@/lib/i18n/context";
import { BlobImage } from "@/components/blob-image";

interface GalleryCardProps {
  gallery: GalleryWithMeta;
  disableLink?: boolean;
}

export function GalleryCard({ gallery, disableLink }: GalleryCardProps) {
  const { t } = useTranslation();

  const content = (
    <Card className="group overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {gallery.coverThumbnailUrl ? (
          <BlobImage
            src={gallery.coverThumbnailUrl}
            alt={gallery.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        <div className="absolute bottom-2 right-2 flex gap-1">
          {!!gallery.isPrivate && (
            <Badge variant="secondary" className="gap-1 backdrop-blur-sm bg-background/80">
              <EyeOff className="h-3 w-3" />
            </Badge>
          )}
          {!!gallery.isProtected && (
            <Badge variant="secondary" className="gap-1 backdrop-blur-sm bg-background/80">
              <Lock className="h-3 w-3" />
            </Badge>
          )}
          <Badge variant="secondary" className="backdrop-blur-sm bg-background/80">
            {t("photo.countSimple", { count: gallery.photoCount })}
          </Badge>
        </div>
      </div>
      <CardContent className="p-3">
        <h3 className="truncate font-medium">{gallery.title}</h3>
        <p className="text-sm text-muted-foreground">{gallery.date}</p>
      </CardContent>
    </Card>
  );

  if (disableLink) return content;

  return <Link href={`/gallery/${gallery.id}`}>{content}</Link>;
}

export function GalleryCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-[4/3]" />
      <CardContent className="p-3">
        <Skeleton className="mb-2 h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
}
