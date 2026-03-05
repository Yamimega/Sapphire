"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { GalleryCardSkeleton } from "@/components/gallery-card";
import { GalleryGrid } from "@/components/gallery-grid";
import { EmptyState } from "@/components/empty-state";
import { ImageIcon, Plus, Search, Trash2, CheckSquare, X } from "lucide-react";
import type { GalleryWithMeta } from "@/types";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const { t } = useTranslation();
  const { authenticated } = useAuth();
  const [galleries, setGalleries] = useState<GalleryWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GalleryWithMeta | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  const fetchGalleries = useCallback(async () => {
    try {
      const res = await fetch("/api/gallery");
      const data = await res.json();
      setGalleries(data.galleries);
    } catch {
      toast.error(t("home.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchGalleries();
  }, [fetchGalleries]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          date: newDate || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success(t("home.galleryCreated"));
      setCreateOpen(false);
      setNewTitle("");
      setNewDate(new Date().toISOString().split("T")[0]);
      fetchGalleries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("home.failedCreate"));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/gallery/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(t("home.galleryDeleted"));
      setDeleteTarget(null);
      fetchGalleries();
    } catch {
      toast.error(t("home.failedDelete"));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch("/api/gallery", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ galleryIds: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(t("home.batchDeleted", { count: selectedIds.size }));
      setSelectedIds(new Set());
      setSelectMode(false);
      setBatchDeleteOpen(false);
      fetchGalleries();
    } catch {
      toast.error(t("home.failedDelete"));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredGalleries = useMemo(() => {
    if (!searchQuery.trim()) return galleries;
    const q = searchQuery.toLowerCase();
    return galleries.filter(
      (a) => a.title.toLowerCase().includes(q) || a.date.includes(q)
    );
  }, [galleries, searchQuery]);

  const handleReorder = async (galleryIds: string[]) => {
    const reordered = galleryIds.map((id, i) => {
      const g = galleries.find((a) => a.id === id)!;
      return { ...g, displayOrder: i };
    });
    setGalleries(reordered);

    try {
      const res = await fetch("/api/gallery/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ galleryIds }),
      });
      if (!res.ok) throw new Error("Reorder failed");
    } catch {
      toast.error(t("home.failedOrder"));
      fetchGalleries();
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t("home.title")}</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("home.search")}
              className="w-48 pl-8 sm:w-56"
            />
          </div>
          {authenticated && !selectMode && (
            <>
              {galleries.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectMode(true)}
                >
                  <CheckSquare className="mr-2 h-4 w-4" />
                  {t("home.select")}
                </Button>
              )}
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("home.createGallery")}
              </Button>
            </>
          )}
          {selectMode && (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size > 0 && `${selectedIds.size} selected`}
              </span>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => setBatchDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("home.deleteSelected", { count: selectedIds.size })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectMode(false);
                  setSelectedIds(new Set());
                }}
              >
                <X className="mr-2 h-4 w-4" />
                {t("home.cancelSelect")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <GalleryCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredGalleries.length === 0 ? (
        <EmptyState
          icon={searchQuery ? Search : ImageIcon}
          title={searchQuery ? t("home.noResults") : t("home.noGalleries")}
          description={searchQuery ? t("home.noResultsDesc") : t("home.noGalleriesDesc")}
          action={
            !searchQuery && authenticated ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("home.createGallery")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <GalleryGrid
          galleries={filteredGalleries}
          onReorder={authenticated && !searchQuery && !selectMode ? handleReorder : undefined}
          onDeleteRequest={authenticated && !selectMode ? (g) => setDeleteTarget(g) : undefined}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      )}

      {/* Create Gallery Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("create.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("create.nameLabel")}</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("create.namePlaceholder")}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("create.dateLabel")}{" "}
                <span className="text-muted-foreground">{t("create.dateOptional")}</span>
              </label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("create.cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              {creating ? t("create.creating") : t("create.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.galleryTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete.galleryDesc", { title: deleteTarget?.title ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white">
              {t("delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Confirmation */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.batchTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete.batchDesc", { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} className="bg-destructive text-white">
              {t("delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
