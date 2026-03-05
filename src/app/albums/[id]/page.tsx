"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { BlobImage } from "@/components/blob-image";
import { GalleryCard } from "@/components/gallery-card";
import { RichTextViewer } from "@/components/rich-text-viewer";
import {
  ArrowLeft,
  FolderOpen,
  ImageIcon,
  Plus,
  Pencil,
  Check,
  Trash2,
  Upload,
  FileText,
  X,
} from "lucide-react";
import type { CategoryWithMeta, GalleryWithMeta } from "@/types";
import { toast } from "sonner";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { Checkbox } from "@/components/ui/checkbox";

export default function AlbumDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { authenticated } = useAuth();
  const categoryId = params.id as string;

  const [category, setCategory] = useState<CategoryWithMeta | null>(null);
  const [galleries, setGalleries] = useState<GalleryWithMeta[]>([]);
  const [allGalleries, setAllGalleries] = useState<GalleryWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addGalleriesOpen, setAddGalleriesOpen] = useState(false);
  const [selectedGalleryIds, setSelectedGalleryIds] = useState<Set<string>>(new Set());
  const coverInputRef = useRef<HTMLInputElement>(null);
  const descDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchCategory = useCallback(async () => {
    try {
      const res = await fetch(`/api/categories/${categoryId}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setCategory(data.category);
      setNameValue(data.category.name);
      setDescValue(data.category.description);
    } catch {
      toast.error(t("albums.notFound"));
      router.push("/albums");
    }
  }, [categoryId, router, t]);

  const fetchGalleries = useCallback(async () => {
    try {
      const res = await fetch("/api/gallery");
      const data = await res.json();
      const all: GalleryWithMeta[] = data.galleries;
      setAllGalleries(all);
      setGalleries(all.filter((g) => g.categoryId === categoryId));
    } catch {
      toast.error(t("home.failedLoad"));
    }
  }, [categoryId, t]);

  useEffect(() => {
    Promise.all([fetchCategory(), fetchGalleries()]).finally(() => setLoading(false));
  }, [fetchCategory, fetchGalleries]);

  const updateCategory = async (updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Update failed");
      const data = await res.json();
      setCategory(data.category);
    } catch {
      toast.error(t("gallery.updateFailed"));
    }
  };

  const handleNameSubmit = () => {
    setEditingName(false);
    if (nameValue.trim() && nameValue.trim() !== category?.name) {
      updateCategory({ name: nameValue.trim() });
    }
  };

  const handleDescChange = (value: string) => {
    setDescValue(value);
    clearTimeout(descDebounceRef.current);
    descDebounceRef.current = setTimeout(() => {
      updateCategory({ description: value });
    }, 800);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/categories/${categoryId}/cover`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      toast.success(t("albums.coverUploaded"));
      fetchCategory();
    } catch {
      toast.error(t("albums.failedCreate"));
    }
    e.target.value = "";
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/categories/${categoryId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(t("albums.deleted"));
      router.push("/albums");
    } catch {
      toast.error(t("albums.failedDelete"));
    }
  };

  const handleAddGalleries = async () => {
    if (selectedGalleryIds.size === 0) return;
    try {
      const res = await fetch(`/api/categories/${categoryId}/galleries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ galleryIds: Array.from(selectedGalleryIds) }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("albums.galleriesAdded"));
      setAddGalleriesOpen(false);
      setSelectedGalleryIds(new Set());
      fetchGalleries();
      fetchCategory();
    } catch {
      toast.error(t("gallery.updateFailed"));
    }
  };

  const handleRemoveGallery = async (galleryId: string) => {
    try {
      const res = await fetch(`/api/categories/${categoryId}/galleries`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ galleryId }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("albums.galleryRemoved"));
      fetchGalleries();
      fetchCategory();
    } catch {
      toast.error(t("gallery.updateFailed"));
    }
  };

  const availableGalleries = allGalleries.filter((g) => g.categoryId !== categoryId);

  if (loading) {
    return (
      <div>
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-6 h-5 w-96" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!category) return null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/albums"
          className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("albums.backToAlbums")}
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          {/* Cover image */}
          <div className="relative w-full shrink-0 overflow-hidden rounded-lg bg-muted lg:w-64 xl:w-72">
            <div className="aspect-[4/3]">
              {category.coverImageUrl ? (
                <BlobImage
                  src={category.coverImageUrl}
                  alt={category.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <FolderOpen className="h-16 w-16 text-muted-foreground/30" />
                </div>
              )}
            </div>
            {authenticated && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-2 right-2 backdrop-blur-sm bg-background/80"
                  onClick={() => coverInputRef.current?.click()}
                >
                  <Upload className="mr-1 h-3 w-3" />
                  {t("albums.uploadCover")}
                </Button>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverUpload}
                />
              </>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {authenticated && editingName ? (
              <Input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
                className="mb-2 text-2xl font-bold"
                autoFocus
              />
            ) : (
              <h1
                className={`mb-2 text-2xl font-bold ${authenticated ? "cursor-pointer hover:text-muted-foreground" : ""}`}
                onClick={() => authenticated && setEditingName(true)}
              >
                {category.name}
              </h1>
            )}

            {/* Description */}
            <div className="mb-4">
              {authenticated && editingDesc ? (
                <div>
                  <Textarea
                    value={descValue}
                    onChange={(e) => handleDescChange(e.target.value)}
                    placeholder={t("albums.descPlaceholder")}
                    className="min-h-[120px] resize-y text-sm font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-7 px-2 text-xs"
                    onClick={() => setEditingDesc(false)}
                  >
                    <Check className="mr-1 h-3 w-3" />
                    {t("notes.done")}
                  </Button>
                </div>
              ) : category.description ? (
                <div>
                  <RichTextViewer content={category.description} />
                  {authenticated && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-7 px-2 text-xs"
                      onClick={() => setEditingDesc(true)}
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      {t("notes.edit")}
                    </Button>
                  )}
                </div>
              ) : authenticated ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => setEditingDesc(true)}
                >
                  <FileText className="mr-1 h-3 w-3" />
                  {t("albums.addDescription")}
                </Button>
              ) : null}
            </div>

            {/* Actions */}
            {authenticated && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setAddGalleriesOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" />
                  {t("albums.addGalleries")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  {t("albums.deleteAlbum")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Galleries in this album */}
      {galleries.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={t("albums.noGalleries")}
          description={t("albums.noGalleriesDesc")}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {galleries.map((gallery) => (
            <div key={gallery.id} className="group relative">
              <GalleryCard gallery={gallery} />
              {authenticated && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 right-2 z-10 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-sm bg-background/80"
                  onClick={() => handleRemoveGallery(gallery.id)}
                  title={t("albums.removeGallery")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Galleries Dialog */}
      <Dialog open={addGalleriesOpen} onOpenChange={setAddGalleriesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("albums.addGalleries")}</DialogTitle>
          </DialogHeader>
          {availableGalleries.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{t("albums.noAvailableGalleries")}</p>
          ) : (
            <div className="max-h-[400px] space-y-2 overflow-y-auto py-2">
              {availableGalleries.map((g) => (
                <label
                  key={g.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedGalleryIds.has(g.id)}
                    onCheckedChange={(checked) => {
                      setSelectedGalleryIds((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(g.id);
                        else next.delete(g.id);
                        return next;
                      });
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{g.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.date} · {t("photo.countSimple", { count: g.photoCount })}
                    </p>
                  </div>
                  {g.coverThumbnailUrl && (
                    <BlobImage
                      src={g.coverThumbnailUrl}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                    />
                  )}
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddGalleriesOpen(false)}>
              {t("create.cancel")}
            </Button>
            <Button onClick={handleAddGalleries} disabled={selectedGalleryIds.size === 0}>
              {t("albums.addSelected", { count: selectedGalleryIds.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("albums.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("albums.deleteDesc", { name: category.name })}
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
    </div>
  );
}
