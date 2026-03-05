"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GalleryCard } from "@/components/gallery-card";
import { Checkbox } from "@/components/ui/checkbox";
import type { GalleryWithMeta } from "@/types";

interface SortableGalleryProps {
  gallery: GalleryWithMeta;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function SortableGallery({ gallery, onContextMenu }: SortableGalleryProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: gallery.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onContextMenu={onContextMenu}>
      <GalleryCard gallery={gallery} />
    </div>
  );
}

interface GalleryGridProps {
  galleries: GalleryWithMeta[];
  onReorder?: (galleryIds: string[]) => void;
  onDeleteRequest?: (gallery: GalleryWithMeta) => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export function GalleryGrid({
  galleries,
  onReorder,
  onDeleteRequest,
  selectMode,
  selectedIds,
  onToggleSelect,
}: GalleryGridProps) {
  const [activeGallery, setActiveGallery] = useState<GalleryWithMeta | null>(null);
  const canEdit = !!onReorder;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const g = galleries.find((a) => a.id === event.active.id);
    setActiveGallery(g ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveGallery(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = galleries.findIndex((a) => a.id === active.id);
    const newIndex = galleries.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...galleries];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    onReorder?.(reordered.map((a) => a.id));
  };

  // Select mode grid
  if (selectMode && onToggleSelect && selectedIds) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {galleries.map((g) => {
          const selected = selectedIds.has(g.id);
          return (
            <div
              key={g.id}
              className="relative cursor-pointer select-none"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSelect(g.id);
              }}
            >
              <div className={`rounded-lg transition-all duration-200 ${selected ? "ring-2 ring-primary ring-offset-2 scale-[0.97]" : "hover:ring-1 hover:ring-muted-foreground/30"}`}>
                <GalleryCard gallery={g} disableLink />
              </div>
              <div className="absolute top-2 left-2 z-10">
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onToggleSelect(g.id)}
                  className={`h-5 w-5 border-2 transition-all ${selected ? "bg-primary border-primary text-primary-foreground shadow-md" : "bg-background/90 backdrop-blur-sm shadow-sm"}`}
                />
              </div>
              {selected && (
                <div className="absolute inset-0 rounded-lg bg-primary/5 pointer-events-none" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Read-only grid (no DnD)
  if (!canEdit) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {galleries.map((g) => (
          <GalleryCard key={g.id} gallery={g} />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={galleries.map((a) => a.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {galleries.map((g) => (
            <SortableGallery
              key={g.id}
              gallery={g}
              onContextMenu={
                onDeleteRequest
                  ? (e) => {
                      e.preventDefault();
                      onDeleteRequest(g);
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>{activeGallery && <GalleryCard gallery={activeGallery} />}</DragOverlay>
    </DndContext>
  );
}
