"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PhotoGrid } from "@/components/photo-grid";
import { PhotoUpload } from "@/components/photo-upload";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { RichTextEditor } from "@/components/rich-text-editor";
import { RichTextViewer } from "@/components/rich-text-viewer";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  ImageIcon,
  Trash2,
  Settings,
  Lock,
  Eye,
  Download,
  Upload,
  Pencil,
  Check,
  FileText,
} from "lucide-react";
import type { Gallery, PhotoWithUrls } from "@/types";
import { toast } from "sonner";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth-context";


export default function GalleryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { authenticated } = useAuth();
  const galleryId = params.id as string;

  const [gallery, setGallery] = useState<(Gallery & { hasPassword?: boolean; photoCount?: number }) | null>(null);
  const [photos, setPhotos] = useState<PhotoWithUrls[]>([]);
  const [allowDownload, setAllowDownloadState] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);
  const [deleteGalleryOpen, setDeleteGalleryOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordAttempt, setPasswordAttempt] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [captionDialog, setCaptionDialog] = useState<{ photoId: string; value: string } | null>(null);

  const fetchGallery = useCallback(async () => {
    try {
      const res = await fetch(`/api/gallery/${galleryId}`);
      if (res.status === 403) {
        const data = await res.json();
        if (data.requirePassword) {
          setNeedsPassword(true);
          setLoading(false);
          return;
        }
        // Private gallery — redirect non-admin users
        router.push("/");
        return;
      }
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setGallery(data.gallery);
      setTitleValue(data.gallery.title);
      setDateValue(data.gallery.date);
      setNeedsPassword(false);
    } catch {
      toast.error(t("gallery.notFound"));
      router.push("/");
    }
  }, [galleryId, router, t]);

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch(`/api/gallery/${galleryId}/photos`);
      if (!res.ok) return;
      const data = await res.json();
      setPhotos(data.photos);
      setAllowDownloadState(data.allowDownload);
    } catch {
      toast.error(t("gallery.failedPhotos"));
    }
  }, [galleryId, t]);

  useEffect(() => {
    Promise.all([fetchGallery(), fetchPhotos()]).finally(() => setLoading(false));
  }, [fetchGallery, fetchPhotos]);

  const updateGallery = async (updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/gallery/${galleryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      const data = await res.json();
      setGallery(data.gallery);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("gallery.updateFailed"));
    }
  };

  const handleTitleSubmit = () => {
    setEditingTitle(false);
    if (titleValue.trim() && titleValue.trim() !== gallery?.title) {
      updateGallery({ title: titleValue.trim() });
    }
  };

  const handleDateChange = (newDate: string) => {
    setDateValue(newDate);
    updateGallery({ date: newDate });
  };

  const handleDeletePhoto = async () => {
    if (!deletePhotoId) return;
    try {
      const res = await fetch(`/api/photos/${deletePhotoId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(t("gallery.photoDeleted"));
      setDeletePhotoId(null);
      fetchPhotos();
    } catch {
      toast.error(t("gallery.failedDeletePhoto"));
    }
  };

  const handleDeleteGallery = async () => {
    try {
      const res = await fetch(`/api/gallery/${galleryId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(t("home.galleryDeleted"));
      router.push("/");
    } catch {
      toast.error(t("home.failedDelete"));
    }
  };

  const handleSetCover = async (photoId: string) => {
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;
    await updateGallery({ coverPhotoId: photo.contentHash });
    toast.success(t("gallery.coverSet"));
  };

  const handlePasswordSubmit = async () => {
    try {
      const res = await fetch(`/api/gallery/${galleryId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordAttempt }),
      });
      if (!res.ok) {
        toast.error(t("gallery.wrongPassword"));
        return;
      }
      setNeedsPassword(false);
      fetchGallery();
      fetchPhotos();
    } catch {
      toast.error(t("gallery.wrongPassword"));
    }
  };

  const handleNotesChange = useCallback(
    (value: string) => {
      updateGallery({ notes: value });
    },
    [galleryId]
  );

  const handleEditCaption = (photoId: string) => {
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;
    setCaptionDialog({ photoId, value: photo.caption || "" });
  };

  const handleSaveCaption = async () => {
    if (!captionDialog) return;
    try {
      const res = await fetch(`/api/photos/${captionDialog.photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: captionDialog.value }),
      });
      if (!res.ok) throw new Error("Failed to update caption");
      toast.success(t("photo.captionSaved"));
      setCaptionDialog(null);
      fetchPhotos();
    } catch {
      toast.error(t("gallery.updateFailed"));
    }
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-6 h-5 w-32" />
        <div className="flex flex-wrap gap-1">
          {[1.5, 0.75, 1.33, 1, 0.67, 1.5, 1, 1.33].map((aspect, i) => (
            <Skeleton key={i} className="rounded-lg h-[140px] sm:h-[220px]" style={{ flexGrow: aspect, flexBasis: `${140 * aspect}px` }} />
          ))}
        </div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="mx-auto max-w-sm py-16 text-center">
        <Lock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="mb-2 text-xl font-semibold">{t("gallery.passwordRequired")}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{t("gallery.passwordRequiredDesc")}</p>
        <div className="flex gap-2">
          <Input
            type="password"
            value={passwordAttempt}
            onChange={(e) => setPasswordAttempt(e.target.value)}
            placeholder={t("gallery.enterPassword")}
            onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
          />
          <Button onClick={handlePasswordSubmit}>{t("gallery.unlock")}</Button>
        </div>
      </div>
    );
  }

  if (!gallery) return null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/"
          className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("gallery.backToGalleries")}
        </Link>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            {authenticated && editingTitle ? (
              <Input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
                className="mb-1 text-2xl font-bold"
                autoFocus
              />
            ) : (
              <h1
                className={`mb-1 text-2xl font-bold ${authenticated ? "cursor-pointer hover:text-muted-foreground" : ""}`}
                onClick={() => authenticated && setEditingTitle(true)}
                title={authenticated ? t("gallery.clickToEdit") : undefined}
              >
                {gallery.title}
                {gallery.isPrivate ? <span title={t("gallery.hiddenBadge")}><Eye className="ml-2 inline h-4 w-4 text-muted-foreground" /></span> : null}
                {gallery.isProtected ? <span title={t("gallery.passwordProtected")}><Lock className="ml-1 inline h-4 w-4 text-muted-foreground" /></span> : null}
              </h1>
            )}
            {authenticated ? (
              <Input
                type="date"
                value={dateValue}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-auto text-sm text-muted-foreground"
              />
            ) : (
              <p className="text-sm text-muted-foreground">{gallery.date}</p>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left column: Photos */}
        <div className="min-w-0 flex-1">
          {photos.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title={t("gallery.noPhotos")}
              description={t("gallery.noPhotosDesc")}
            />
          ) : (
            <PhotoGrid
              photos={photos}
              onPhotoClick={(index) => setLightboxIndex(index)}
              onPhotoDelete={authenticated ? (id) => setDeletePhotoId(id) : undefined}
              onSetCover={authenticated ? handleSetCover : undefined}
              onEditCaption={authenticated ? handleEditCaption : undefined}
              currentCoverId={gallery.coverPhotoId}
              protected={!allowDownload && !authenticated}
            />
          )}
        </div>

        {/* Right column: Actions & Notes */}
        <div className="w-full shrink-0 space-y-4 lg:w-72 xl:w-80">
          {/* Photo count */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
            {t("photo.countSimple", { count: photos.length })}
          </div>

          {/* Action buttons (authenticated only) */}
          {authenticated && (
            <div className="flex flex-col gap-2">
              <Button onClick={() => setUploadDialogOpen(true)} className="w-full justify-start">
                <Upload className="mr-2 h-4 w-4" />
                {t("gallery.uploadPhotos")}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="mr-2 h-4 w-4" />
                {t("gallery.settings")}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={() => setDeleteGalleryOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("gallery.deleteGallery")}
              </Button>
            </div>
          )}

          {/* Settings panel */}
          {showSettings && authenticated && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">{t("gallery.settings")}</h3>
              <div className="space-y-4">
                {/* Visible to visitors */}
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm">{t("gallery.visible")}</Label>
                    </div>
                    <Switch
                      checked={!gallery.isPrivate}
                      onCheckedChange={(v) => updateGallery({ isPrivate: !v })}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground pl-6">{t("gallery.visibleDesc")}</p>
                </div>

                {/* Password protection */}
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm">{t("gallery.passwordProtected")}</Label>
                    </div>
                    <Switch
                      checked={!!gallery.isProtected}
                      onCheckedChange={(v) => {
                        if (v && !gallery.hasPassword) {
                          // Enable protection — need to set a password first
                          updateGallery({ isProtected: true });
                        } else {
                          updateGallery({ isProtected: v });
                        }
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground pl-6">{t("gallery.passwordProtectedDesc")}</p>
                  {!!gallery.isProtected && (
                    <div className="mt-2 pl-6">
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder={gallery.hasPassword ? t("gallery.changePassword") : t("gallery.setPassword")}
                          className="flex-1 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            updateGallery({ password: passwordInput });
                            setPasswordInput("");
                            toast.success(t("gallery.passwordUpdated"));
                          }}
                          disabled={!passwordInput}
                        >
                          {t("gallery.savePassword")}
                        </Button>
                      </div>
                      {gallery.hasPassword && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-1 text-xs"
                          onClick={() => {
                            updateGallery({ password: "", isProtected: false });
                            toast.success(t("gallery.passwordRemoved"));
                          }}
                        >
                          {t("gallery.removePassword")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Allow download */}
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm">{t("gallery.allowDownload")}</Label>
                    </div>
                    <Switch
                      checked={!!gallery.allowDownload}
                      onCheckedChange={(v) => updateGallery({ allowDownload: v })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes / Passage */}
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4" />
                {t("notes.title")}
              </h3>
              {authenticated && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setEditingNotes(!editingNotes)}
                >
                  {editingNotes ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      {t("notes.done")}
                    </>
                  ) : (
                    <>
                      <Pencil className="mr-1 h-3 w-3" />
                      {t("notes.edit")}
                    </>
                  )}
                </Button>
              )}
            </div>
            {editingNotes && authenticated ? (
              <RichTextEditor
                value={gallery.notes || ""}
                onChange={handleNotesChange}
              />
            ) : gallery.notes ? (
              <RichTextViewer content={gallery.notes} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("notes.empty")}</p>
            )}
          </div>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("upload.title")}</DialogTitle>
          </DialogHeader>
          <PhotoUpload
            albumId={galleryId}
            onUploadComplete={() => {
              fetchPhotos();
              fetchGallery();
              setUploadDialogOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Caption Edit Dialog */}
      <Dialog open={!!captionDialog} onOpenChange={(open) => !open && setCaptionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("photo.editCaption")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={captionDialog?.value ?? ""}
            onChange={(e) =>
              setCaptionDialog((prev) => prev ? { ...prev, value: e.target.value } : null)
            }
            placeholder={t("photo.captionPlaceholder")}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCaptionDialog(null)}>
              {t("create.cancel")}
            </Button>
            <Button onClick={handleSaveCaption}>
              {t("photo.saveCaption")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <PhotoLightbox
        photos={photos}
        currentIndex={lightboxIndex}
        open={lightboxIndex >= 0}
        onOpenChange={(open) => !open && setLightboxIndex(-1)}
        onIndexChange={setLightboxIndex}
        allowDownload={allowDownload}
      />

      {/* Delete Photo Confirmation */}
      <AlertDialog
        open={!!deletePhotoId}
        onOpenChange={(open) => !open && setDeletePhotoId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.photoTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("delete.photoDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePhoto} className="bg-destructive text-white">
              {t("delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Gallery Confirmation */}
      <AlertDialog open={deleteGalleryOpen} onOpenChange={setDeleteGalleryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.galleryTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete.galleryDesc", { title: gallery.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGallery} className="bg-destructive text-white">
              {t("delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
