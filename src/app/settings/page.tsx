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
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
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

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/backup/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ??
        "sapphire-backup.zip";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("settings.exportSuccess"));
    } catch {
      toast.error(t("settings.exportFailed"));
    } finally {
      setExporting(false);
    }
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
    try {
      const formData = new FormData();
      formData.append("backup", pendingFile);
      const res = await fetch("/api/backup/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
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
                <Button onClick={handleExport} disabled={exporting} size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  {exporting ? t("settings.exporting") : t("settings.exportBtn")}
                </Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="mb-1 text-sm font-medium">{t("settings.importTitle")}</h4>
                <p className="mb-3 text-xs text-muted-foreground">{t("settings.importDesc")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={importing}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {importing ? t("settings.importing") : t("settings.importBtn")}
                </Button>
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
