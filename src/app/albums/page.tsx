"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { BlobImage } from "@/components/blob-image";
import { FolderOpen, Plus } from "lucide-react";
import type { CategoryWithMeta } from "@/types";
import { toast } from "sonner";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth-context";

export default function AlbumsPage() {
  const { t } = useTranslation();
  const { authenticated } = useAuth();
  const [categories, setCategories] = useState<CategoryWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithMeta | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      setCategories(data.categories);
    } catch {
      toast.error(t("albums.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success(t("albums.created"));
      setCreateOpen(false);
      setNewName("");
      fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("albums.failedCreate"));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/categories/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(t("albums.deleted"));
      setDeleteTarget(null);
      fetchCategories();
    } catch {
      toast.error(t("albums.failedDelete"));
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t("albums.title")}</h1>
        {authenticated && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("albums.create")}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-[4/3]" />
              <CardContent className="p-3">
                <Skeleton className="mb-2 h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={t("albums.noAlbums")}
          description={t("albums.noAlbumsDesc")}
          action={
            authenticated ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("albums.create")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {categories.map((cat) => (
            <Link key={cat.id} href={`/albums/${cat.id}`}>
              <Card className="group overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
                <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                  {cat.coverImageUrl ? (
                    <BlobImage
                      src={cat.coverImageUrl}
                      alt={cat.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                      <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2">
                    <Badge variant="secondary" className="backdrop-blur-sm bg-background/80">
                      {t("albums.galleryCount", { count: cat.galleryCount })}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-3">
                  <h3 className="truncate font-medium">{cat.name}</h3>
                  {cat.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{cat.description}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Album Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("albums.create")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("albums.nameLabel")}</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("albums.namePlaceholder")}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("create.cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? t("create.creating") : t("create.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("albums.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("albums.deleteDesc", { name: deleteTarget?.name ?? "" })}
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
