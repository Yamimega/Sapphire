"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Camera, Clock, Settings, Menu, X, Globe, LogIn, LogOut, Sun, Moon, FolderOpen } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, type Locale } from "@/lib/i18n/translations";

export function NavHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const { authenticated, authEnabled, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [siteName, setSiteName] = useState("Sapphire");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings?.siteName) setSiteName(d.settings.siteName);
      })
      .catch(() => {});
  }, []);

  const navItems = [
    { href: "/", label: t("nav.gallery"), icon: Camera },
    { href: "/albums", label: t("nav.albums"), icon: FolderOpen },
    { href: "/timeline", label: t("nav.timeline"), icon: Clock },
    ...(authenticated
      ? [{ href: "/settings", label: t("nav.settings"), icon: Settings }]
      : []),
  ];

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const localeLabels: Record<Locale, string> = {
    en: t("lang.en"),
    zh: t("lang.zh"),
    ja: t("lang.ja"),
  };

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center">
          <Link href="/" className="mr-8 text-lg font-semibold tracking-tight">
            {siteName}
          </Link>
          {/* Desktop nav */}
          <nav className="hidden gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Locale switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Globe className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {locales.map((l) => (
                <DropdownMenuItem
                  key={l}
                  onClick={() => setLocale(l)}
                  className={cn(locale === l && "bg-accent")}
                >
                  {localeLabels[l]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme toggle */}
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme} aria-label={t("nav.theme")}>
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {/* Auth button (desktop) */}
          {authEnabled && (
            <div className="hidden md:block">
              {authenticated ? (
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("nav.logout")}
                </Button>
              ) : (
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    <LogIn className="mr-2 h-4 w-4" />
                    {t("nav.login")}
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="border-t px-4 pb-4 md:hidden">
          <div className="flex flex-col gap-1 pt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
            {authEnabled && (
              <>
                {authenticated ? (
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <LogOut className="h-5 w-5" />
                    {t("nav.logout")}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <LogIn className="h-5 w-5" />
                    {t("nav.login")}
                  </Link>
                )}
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
