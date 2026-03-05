"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TimelineEntry } from "@/types";
import { useTranslation } from "@/lib/i18n/context";
import { BlobImage } from "@/components/blob-image";

interface TimelineViewProps {
  entries: TimelineEntry[];
}

export function TimelineView({ entries }: TimelineViewProps) {
  const { t } = useTranslation();

  return (
    <div className="relative ml-4 border-l-2 border-muted pl-6 md:pl-8">
      {entries.map((entry) => (
        <div key={entry.date} className="relative mb-8">
          <div className="absolute -left-[2.35rem] top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-background md:-left-[2.85rem]">
            <div className="h-2 w-2 rounded-full bg-primary" />
          </div>
          <h3 className="mb-3 text-lg font-semibold">{entry.date}</h3>
          <div className="space-y-3">
            {entry.galleries.map((g) => (
              <Link key={g.id} href={`/gallery/${g.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-4 p-3 md:p-4">
                    <div className="flex -space-x-2">
                      {g.thumbnails.length > 0 ? (
                        g.thumbnails.map((thumb, i) => (
                          <BlobImage
                            key={i}
                            src={thumb}
                            alt=""
                            className="h-10 w-10 rounded-md border-2 border-background object-cover md:h-12 md:w-12"
                          />
                        ))
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground md:h-12 md:w-12">
                          {t("timeline.noPhotos")}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="truncate font-medium">{g.title}</h4>
                      <Badge variant="outline" className="mt-1">
                        {t("photo.countSimple", { count: g.photoCount })}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
