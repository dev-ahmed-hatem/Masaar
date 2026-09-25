"use client";

import { useCallback, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { CalendarClock, ExternalLink } from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { bookingActions, type Booking } from "@/lib/bookings";
import {
  formatWhen,
  LESSONS_PAGE_SIZE,
  LessonCard,
  PROVIDERS,
  TabCount,
  useGroupedBookings,
  type BookingGroup,
} from "@/components/bookings/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog, ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";

type Dict = Dictionary["bookings"];
type BrowseDict = Dictionary["browse"];

export default function LessonsManager({
  dict,
  browseDict,
  locale,
}: {
  dict: Dict;
  browseDict: BrowseDict;
  locale: Locale;
}) {
  const toast = useToast();
  const { groups, loading, error, reload, setPage } = useGroupedBookings(dict.loadError);
  const [tab, setTab] = useState<BookingGroup>("requested");
  const [confirming, setConfirming] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [noShowing, setNoShowing] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (fn: () => Promise<unknown>, ok: string) => {
      try {
        await fn();
        toast.success(ok);
        reload();
        return true;
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : dict.actionError);
        return false;
      }
    },
    [toast, reload, dict.actionError],
  );

  function actionsFor(b: Booking, group: BookingGroup) {
    if (group === "requested") {
      return (
        <>
          <Button size="sm" onClick={() => setConfirming(b)}>
            {dict.confirm}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => run(() => bookingActions.decline(b.id), dict.declined)}
          >
            {dict.decline}
          </Button>
        </>
      );
    }
    if (group === "upcoming") {
      return (
        <>
          {b.meeting_link ? (
            <Button size="sm" asChild>
              <a href={b.meeting_link} target="_blank" rel="noreferrer">
                {dict.join}
                <ExternalLink aria-hidden />
              </a>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setNoShowing(b)}>
            {dict.noShow}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCancelling(b)}>
            {dict.cancel}
          </Button>
        </>
      );
    }
    return null;
  }

  function renderList(group: BookingGroup) {
    const g = groups[group];
    if (loading) {
      return (
        <div className="flex flex-col gap-3" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-card" />
          ))}
        </div>
      );
    }
    if (g.rows.length === 0) {
      return (
        <Card>
          <EmptyState icon={<CalendarClock aria-hidden />} title={dict.empty} />
        </Card>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        {g.rows.map((b) => (
          <LessonCard
            key={b.id}
            booking={b}
            bookingsDict={dict}
            locale={locale}
            who={b.student_name}
            price={b.is_trial ? dict.trial : b.price_display}
            actions={actionsFor(b, group)}
          />
        ))}
        <Pagination
          page={g.page}
          pageSize={LESSONS_PAGE_SIZE}
          total={g.total}
          onChange={(p) => setPage(group, p)}
          prevLabel={browseDict.prevPage}
          nextLabel={browseDict.nextPage}
          className="pt-2"
        />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        variant="error"
        title={error}
        action={
          <Button variant="outline" size="sm" onClick={reload}>
            {dict.retry}
          </Button>
        }
      />
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="t-h1 text-ink">{dict.teacherTitle}</h1>
        <p className="max-w-2xl t-body text-ink-muted">{dict.teacherIntro}</p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as BookingGroup)}
        className="flex flex-col gap-5"
      >
        <TabsList>
          <TabsTrigger value="requested">
            {dict.tabRequests}
            <TabCount n={groups.requested.total} />
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            {dict.tabUpcoming}
            <TabCount n={groups.upcoming.total} />
          </TabsTrigger>
          <TabsTrigger value="past">{dict.tabPast}</TabsTrigger>
        </TabsList>

        <TabsContent value="requested">{renderList("requested")}</TabsContent>
        <TabsContent value="upcoming">{renderList("upcoming")}</TabsContent>
        <TabsContent value="past">{renderList("past")}</TabsContent>
      </Tabs>

      {confirming ? (
        <ConfirmLessonDialog
          dict={dict}
          locale={locale}
          booking={confirming}
          onClose={() => setConfirming(null)}
          onConfirm={async (provider, link) => {
            const ok = await run(
              () => bookingActions.confirm(confirming.id, provider, link),
              dict.confirmed,
            );
            if (ok) setConfirming(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={cancelling != null}
        onOpenChange={(next) => !next && setCancelling(null)}
        title={dict.cancel}
        description={dict.cancelConfirm}
        confirmLabel={dict.cancel}
        cancelLabel={dict.keepLesson}
        loading={busy}
        onConfirm={async () => {
          if (!cancelling) return;
          setBusy(true);
          await run(() => bookingActions.cancel(cancelling.id, ""), dict.cancelled);
          setBusy(false);
          setCancelling(null);
        }}
      />

      <ConfirmDialog
        open={noShowing != null}
        onOpenChange={(next) => !next && setNoShowing(null)}
        title={dict.noShow}
        description={dict.noShowConfirm}
        confirmLabel={dict.noShow}
        cancelLabel={dict.keepLesson}
        loading={busy}
        onConfirm={async () => {
          if (!noShowing) return;
          setBusy(true);
          await run(() => bookingActions.noShow(noShowing.id), dict.noShowDone);
          setBusy(false);
          setNoShowing(null);
        }}
      />
    </section>
  );
}

/**
 * Confirming a request means committing to a time AND handing over a joinable
 * link — the student has already paid, so the link is required, not optional.
 */
function ConfirmLessonDialog({
  dict,
  locale,
  booking,
  onClose,
  onConfirm,
}: {
  dict: Dict;
  locale: Locale;
  booking: Booking;
  onClose: () => void;
  onConfirm: (provider: string, link: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        meeting_provider: z.string().min(1),
        meeting_link: z
          .string()
          .trim()
          .min(1, dict.requiredLink)
          .refine((v) => /^https?:\/\/\S+$/i.test(v), dict.invalidLink),
      }),
    [dict],
  );
  type Values = z.infer<typeof schema>;

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { meeting_provider: "ZOOM", meeting_link: "" },
  });

  return (
    <ResponsiveDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={dict.confirmTitle}
      description={
        <>
          <bdi>{booking.student_name}</bdi> ·{" "}
          <bdi>{formatWhen(booking.scheduled_start, locale)}</bdi>
        </>
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {dict.cancel}
          </Button>
          <Button type="submit" form="confirm-lesson" loading={saving}>
            {dict.submit}
          </Button>
        </>
      }
    >
      <form
        id="confirm-lesson"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (v) => {
          setSaving(true);
          await onConfirm(v.meeting_provider, v.meeting_link.trim());
          setSaving(false);
        })}
      >
        <Field id="meeting_provider" label={dict.provider} required>
          <Controller
            control={control}
            name="meeting_provider"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="meeting_provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field id="meeting_link" label={dict.meetingLink} error={errors.meeting_link?.message} required>
          <Input dir="ltr" inputMode="url" placeholder="https://" {...register("meeting_link")} />
        </Field>
      </form>
    </ResponsiveDialog>
  );
}
