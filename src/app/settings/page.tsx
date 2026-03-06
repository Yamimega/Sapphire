"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Download, Upload, Globe, Palette, Image, Shield, HardDrive, Save, Archive } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth-context";

interface SiteSettings {
  siteName: string;
  siteDescription: string;
  accentColor: string;
  albumsPerPage: string;
  defaultSort: string;
  defaultLanguage: string;
  showTimeline: string;
  requireLoginToView: string;
  thumbnailQuality: string;
  maxUploadSizeMb: string;
  hasFavicon: string;
  faviconUrl?: string;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { authenticated, loading: authLoading } = useAuth();
  const router = useRouter();


  const [importing, setImporting] = useState(false);
  const [importPhase, setImportPhase] = useState<"upload" | "processing">("upload");
  const [importProgress, setImportProgress] = useState(0);
  const [confirmImport, setConfirmImport] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!authLoading && !authenticated) {
      router.push("/login");
    }
  }, [authLoading, authenticated, router]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data.settings);
    } catch {
      // Settings API may not have data yet
    }
  }, []);

  useEffect(() => {
    if (authenticated) fetchSettings();
  }, [authenticated, fetchSettings]);

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  };

  const saveSettings = async () => {
    if (!settings) return;
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(t("settings.saved"));
      setDirty(false);
      window.dispatchEvent(new CustomEvent("settings-updated"));
    } catch {
      toast.error(t("settings.saveFailed"));
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const formData = new FormData();
    formData.append("favicon", file);

    try {
      const res = await fetch("/api/settings", { method: "PUT", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      toast.success(t("settings.faviconUploaded"));
      fetchSettings();
    } catch {
      toast.error(t("settings.faviconFailed"));
    }
  };

  const handleExport = () => {
    // Direct navigation lets the browser stream the download natively
    // without buffering the entire archive in JS memory (which fails for large backups).
    // Auth cookie is sent automatically with the navigation.
    window.location.href = "/api/backup/export";
    toast.success(t("settings.exportSuccess"));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setConfirmImport(true);
    }
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!pendingFile) return;
    setConfirmImport(false);
    setImporting(true);
    setImportPhase("upload");
    setImportProgress(0);

    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk
    const MAX_RETRIES = 3;

    try {
      // 1. Get a unique upload session ID from the server
      const initRes = await fetch("/api/backup/import/chunk");
      if (!initRes.ok) throw new Error("Failed to initialize upload");
      const { uploadId } = await initRes.json();

      // 2. Split file and upload chunks
      const totalChunks = Math.ceil(pendingFile.size / CHUNK_SIZE);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, pendingFile.size);
        const blob = pendingFile.slice(start, end);

        let success = false;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            const form = new FormData();
            form.append("chunk", blob, "chunk");
            form.append("index", String(i));
            form.append("total", String(totalChunks));
            form.append("uploadId", uploadId);

            const res = await fetch("/api/backup/import/chunk", {
              method: "POST",
              body: form,
            });
            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || `Chunk ${i} failed`);
            }
            success = true;
            break;
          } catch (err) {
            if (attempt === MAX_RETRIES - 1) throw err;
            // Wait before retry (1s, 2s, 3s)
            await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
          }
        }
        if (!success) throw new Error(`Failed to upload chunk ${i}`);

        setImportProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      // 3. Tell the server to assemble and process
      setImportPhase("processing");
      const finalRes = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId }),
      });
      const data = await finalRes.json();
      if (!finalRes.ok) throw new Error(data.error || t("settings.importFailed"));

      toast.success(
        t("settings.importSuccess", {
          galleryCount: data.galleryCount,
          photoCount: data.photoCount,
        })
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.importFailed"));
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  if (authLoading || !authenticated) return null;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Sticky save bar */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <Button
          onClick={saveSettings}
          disabled={!dirty}
          className={dirty ? "" : "opacity-50"}
        >
          <Save className="mr-2 h-4 w-4" />
          {t("settings.save")}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Site Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-muted-foreground" />
              {t("settings.siteIdentity")}
            </CardTitle>
            <CardDescription>{t("settings.siteIdentityDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm">{t("settings.siteName")}</Label>
                <Input
                  value={settings?.siteName ?? ""}
                  onChange={(e) => updateSetting("siteName", e.target.value)}
                  placeholder="Sapphire"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{t("settings.siteDescription")}</Label>
                <Input
                  value={settings?.siteDescription ?? ""}
                  onChange={(e) => updateSetting("siteDescription", e.target.value)}
                  placeholder="Photo Gallery Organizer"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("settings.favicon")}</Label>
              <div className="flex items-center gap-3">
                {settings?.hasFavicon === "true" && settings.faviconUrl && (
                  <img
                    src={`${settings.faviconUrl}?t=${Date.now()}`}
                    alt="Favicon"
                    className="h-8 w-8 rounded border object-contain"
                  />
                )}
                <Button variant="outline" size="sm" onClick={() => faviconRef.current?.click()}>
                  <Image className="mr-2 h-4 w-4" />
                  {t("settings.uploadFavicon")}
                </Button>
                <input
                  ref={faviconRef}
                  type="file"
                  accept="image/*,.ico"
                  className="hidden"
                  onChange={handleFaviconUpload}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4 text-muted-foreground" />
              {t("settings.appearance")}
            </CardTitle>
            <CardDescription>{t("settings.appearanceDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">{t("settings.defaultLanguage")}</Label>
              <Select
                value={settings?.defaultLanguage ?? "en"}
                onValueChange={(v) => updateSetting("defaultLanguage", v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label className="text-sm">{t("settings.showTimeline")}</Label>
              <Switch
                checked={settings?.showTimeline === "true"}
                onCheckedChange={(v) => updateSetting("showTimeline", v ? "true" : "false")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Albums & Photos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              {t("settings.galleryPhotos")}
            </CardTitle>
            <CardDescription>{t("settings.galleryPhotosDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm">{t("settings.galleriesPerPage")}</Label>
                <Input
                  type="number"
                  min="5"
                  max="100"
                  value={settings?.albumsPerPage ?? "20"}
                  onChange={(e) => updateSetting("albumsPerPage", e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{t("settings.defaultSort")}</Label>
                <Select
                  value={settings?.defaultSort ?? "order"}
                  onValueChange={(v) => updateSetting("defaultSort", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="order">{t("settings.sortOrder")}</SelectItem>
                    <SelectItem value="date">{t("settings.sortDate")}</SelectItem>
                    <SelectItem value="name">{t("settings.sortName")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{t("settings.thumbnailQuality")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="30"
                    max="100"
                    value={settings?.thumbnailQuality ?? "80"}
                    onChange={(e) => updateSetting("thumbnailQuality", e.target.value)}
                    className="w-full"
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{t("settings.maxUploadSize")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={settings?.maxUploadSizeMb ?? "20"}
                    onChange={(e) => updateSetting("maxUploadSizeMb", e.target.value)}
                    className="w-full"
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">MB</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-muted-foreground" />
              {t("settings.security")}
            </CardTitle>
            <CardDescription>{t("settings.securityDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div className="space-y-0.5">
                <Label className="text-sm">{t("settings.requireLogin")}</Label>
                <p className="text-xs text-muted-foreground">{t("settings.requireLoginDesc")}</p>
              </div>
              <Switch
                checked={settings?.requireLoginToView === "true"}
                onCheckedChange={(v) => updateSetting("requireLoginToView", v ? "true" : "false")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Backup & Restore */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Archive className="h-4 w-4 text-muted-foreground" />
              {t("settings.backupRestore")}
            </CardTitle>
            <CardDescription>{t("settings.backupRestoreDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <h4 className="mb-1 text-sm font-medium">{t("settings.exportTitle")}</h4>
                <p className="mb-3 text-xs text-muted-foreground">{t("settings.exportDesc")}</p>
                <Button onClick={handleExport} size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  {t("settings.exportBtn")}
                </Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="mb-1 text-sm font-medium">{t("settings.importTitle")}</h4>
                <p className="mb-3 text-xs text-muted-foreground">{t("settings.importDesc")}</p>
                {importing ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {importPhase === "upload"
                        ? t("settings.importUploading", { percent: importProgress })
                        : t("settings.importProcessing")}
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          importPhase === "processing"
                            ? "w-full animate-pulse bg-primary/70"
                            : "bg-primary"
                        }`}
                        style={importPhase === "upload" ? { width: `${importProgress}%` } : undefined}
                      />
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {t("settings.importBtn")}
                  </Button>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Confirmation */}
      <AlertDialog open={confirmImport} onOpenChange={setConfirmImport}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.importConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("settings.importConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFile(null)}>
              {t("delete.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleImport}>
              {t("settings.importBtn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
