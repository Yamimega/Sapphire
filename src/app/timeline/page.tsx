"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TimelineView } from "@/components/timeline-view";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Search } from "lucide-react";
import type { TimelineEntry } from "@/types";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/context";

interface YearGroup {
  year: string;
  months: MonthGroup[];
}

interface MonthGroup {
  month: string; // "01", "02", etc.
  label: string; // formatted month name
  entries: TimelineEntry[];
}

const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_NAMES_ZH = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
];
const MONTH_NAMES_JA = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

function getMonthName(month: string, locale: string): string {
  const idx = parseInt(month, 10) - 1;
  if (locale === "zh") return MONTH_NAMES_ZH[idx] ?? month;
  if (locale === "ja") return MONTH_NAMES_JA[idx] ?? month;
  return MONTH_NAMES_EN[idx] ?? month;
}

export default function TimelinePage() {
  const { t, locale } = useTranslation();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [jumpDate, setJumpDate] = useState("");

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch("/api/timeline");
      const data = await res.json();
      setEntries(data.entries);
    } catch {
      toast.error(t("timeline.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Group entries by year -> month
  const yearGroups = useMemo((): YearGroup[] => {
    const byYear: Record<string, Record<string, TimelineEntry[]>> = {};

    for (const entry of entries) {
      // date format is YYYY-MM-DD
      const [year, month] = entry.date.split("-");
      if (!year || !month) continue;
      if (!byYear[year]) byYear[year] = {};
      if (!byYear[year][month]) byYear[year][month] = [];
      byYear[year][month].push(entry);
    }

    return Object.entries(byYear)
      .sort(([a], [b]) => b.localeCompare(a)) // newest year first
      .map(([year, months]) => ({
        year,
        months: Object.entries(months)
          .sort(([a], [b]) => b.localeCompare(a)) // newest month first
          .map(([month, monthEntries]) => ({
            month,
            label: getMonthName(month, locale),
            entries: monthEntries,
          })),
      }));
  }, [entries, locale]);

  const handleJump = () => {
    if (!jumpDate) return;
    // Try exact date match
    const target = document.querySelector(`[data-date="${jumpDate}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Try month match
    const [year, month] = jumpDate.split("-");
    const monthEl = document.querySelector(`[data-month="${year}-${month}"]`);
    if (monthEl) {
      monthEl.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Try year match
    const yearEl = document.querySelector(`[data-year="${year}"]`);
    if (yearEl) {
      yearEl.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Fallback: find nearest date
    if (entries.length > 0) {
      const dates = entries.map((e) => e.date);
      const nearest = dates.reduce((prev, curr) =>
        Math.abs(curr.localeCompare(jumpDate)) < Math.abs(prev.localeCompare(jumpDate))
          ? curr
          : prev
      );
      const el = document.querySelector(`[data-date="${nearest}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t("timeline.title")}</h1>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={jumpDate}
            onChange={(e) => setJumpDate(e.target.value)}
            className="w-auto"
          />
          <Button variant="outline" size="sm" onClick={handleJump} disabled={!jumpDate}>
            <Search className="mr-2 h-4 w-4" />
            {t("timeline.jump")}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-4 h-8 w-24" />
              <div className="ml-4 space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="ml-4 h-20 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : yearGroups.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={t("timeline.noGalleries")}
          description={t("timeline.noGalleriesDesc")}
        />
      ) : (
        <div className="space-y-10">
          {yearGroups.map((yg) => (
            <section key={yg.year} data-year={yg.year}>
              {/* Year header */}
              <h2 className="mb-6 text-3xl font-bold tracking-tight">{yg.year}</h2>

              <div className="space-y-6 pl-2 md:pl-4">
                {yg.months.map((mg) => {
                  const totalGalleries = mg.entries.reduce(
                    (sum, e) => sum + e.galleries.length,
                    0
                  );
                  return (
                    <section
                      key={mg.month}
                      data-month={`${yg.year}-${mg.month}`}
                    >
                      {/* Month header */}
                      <div className="mb-4 flex items-baseline gap-3 border-b pb-2">
                        <h3 className="text-xl font-semibold text-primary">{mg.label}</h3>
                        <span className="text-sm text-muted-foreground">
                          {t("timeline.galleryCount", { count: totalGalleries })}
                        </span>
                      </div>

                      {/* Entries under this month */}
                      <div className="pl-2 md:pl-4">
                        {mg.entries.map((entry) => (
                          <div key={entry.date} data-date={entry.date}>
                            <TimelineView entries={[entry]} />
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
