"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ExternalLink } from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { bookingActions, listSlots, rescheduleBooking, type Booking, type Slot } from "@/lib/bookings";
import { createReview } from "@/lib/reviews";
import {
  LESSONS_PAGE_SIZE,
  LessonCard,
  useGroupedBookings,
  type BookingGroup,
} from "@/components/bookings/shared";
import SlotCalendar from "@/components/bookings/slot-calendar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { RatingInput } from "@/components/ui/rating";
import { ConfirmDialog, ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

/** Count pill inside a tab trigger — zero is left off rather than shown as 0. */
function TabCount({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="inline-flex min-w-5 items-center justify-center rounded-pill bg-brand-tint px-1.5 t-caption font-bold text-on-brand-tint">
      {n}
    </span>
  );
}

type Dict = Dictionary["myLessons"];
type BookingsDict = Dictionary["bookings"];
type BrowseDict = Dictionary["browse"];

export default function StudentLessons({
  dict,
  bookingsDict,
  browseDict,
  locale,
}: {
  dict: Dict;
  bookingsDict: BookingsDict;
  browseDict: BrowseDict;
  locale: Locale;
}) {
  const toast = useToast();
  const { groups, loading, error, reload, setPage } = useGroupedBookings(dict.loadError);
  const [reviewing, setReviewing] = useState<Booking | null>(null);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<BookingGroup>("upcoming");

  const run = useCallback(
    async (fn: () => Promise<unknown>, ok: string) => {
      try {
        await fn();
        toast.success(ok);
        reload();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : dict.actionError);
      }
    },
    [toast, reload, dict.actionError],
  );

  async function confirmCancel() {
    if (!cancelling) return;
    setCancelBusy(true);
    await run(() => bookingActions.cancel(cancelling.id, ""), dict.cancelled);
    setCancelBusy(false);
    setCancelling(null);
  }

  function actionsFor(b: Booking, group: BookingGroup) {
    if (group === "requested") {
      return (
        <>
          <Button variant="outline" size="sm" onClick={() => setRescheduling(b)}>
            {dict.reschedule}
          </Button>
          {/* Nothing is charged before a teacher confirms, so this one needs no
              confirmation step. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => run(() => bookingActions.cancel(b.id, ""), dict.cancelled)}
          >
            {dict.cancel}
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
          <Button variant="outline" size="sm" onClick={() => setRescheduling(b)}>
            {dict.reschedule}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => run(() => bookingActions.complete(b.id), dict.completed)}
          >
            {dict.complete}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCancelling(b)}>
            {dict.cancel}
          </Button>
        </>
      );
    }
    return b.status === "COMPLETED" && !reviewedIds.has(b.id) ? (
      <Button variant="outline" size="sm" onClick={() => setReviewing(b)}>
        {dict.review}
      </Button>
    ) : null;
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
          <EmptyState
            icon={<CalendarClock aria-hidden />}
            title={dict.empty}
            action={
              <Button variant="outline" asChild>
                <Link href={`/${locale}/teachers`}>{dict.browseCta}</Link>
              </Button>
            }
          />
        </Card>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        {g.rows.map((b) => (
          <LessonCard
            key={b.id}
            booking={b}
            bookingsDict={bookingsDict}
            locale={locale}
            who={b.teacher_name}
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

  if (error) return <Alert variant="error" title={error} />;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="t-h1 text-ink">{dict.title}</h1>
        <p className="max-w-2xl t-body text-ink-muted">{dict.intro}</p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as BookingGroup)}
        className="flex flex-col gap-5"
      >
        <TabsList>
          <TabsTrigger value="upcoming">
            {dict.tabUpcoming}
            <TabCount n={groups.upcoming.total} />
          </TabsTrigger>
          <TabsTrigger value="requested">
            {dict.tabRequested}
            <TabCount n={groups.requested.total} />
          </TabsTrigger>
          <TabsTrigger value="past">{dict.tabPast}</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">{renderList("upcoming")}</TabsContent>
        <TabsContent value="requested">{renderList("requested")}</TabsContent>
        <TabsContent value="past">{renderList("past")}</TabsContent>
      </Tabs>

      <ConfirmDialog
        open={cancelling != null}
        onOpenChange={(next) => !next && setCancelling(null)}
        title={dict.cancel}
        description={dict.cancelConfirm}
        confirmLabel={dict.cancel}
        cancelLabel={dict.keepLesson}
        loading={cancelBusy}
        onConfirm={confirmCancel}
      />

      {reviewing ? (
        <ReviewModal
          booking={reviewing}
          dict={dict}
          onClose={() => setReviewing(null)}
          onDone={(id) => {
            setReviewedIds((prev) => new Set(prev).add(id));
            setReviewing(null);
          }}
        />
      ) : null}

      {rescheduling ? (
        <RescheduleModal
          booking={rescheduling}
          dict={dict}
          browseDict={browseDict}
          locale={locale}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null);
            reload();
          }}
        />
      ) : null}
    </section>
  );
}

function RescheduleModal({
  booking,
  dict,
  browseDict,
  locale,
  onClose,
  onDone,
}: {
  booking: Booking;
  dict: Dict;
  browseDict: BrowseDict;
  locale: Locale;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [start, setStart] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    // Offer the hours of the stage the lesson was booked in.
    listSlots(booking.teacher_id, 14, booking.teacher_stage)
      .then((s) => active && setSlots(s))
      .catch(() => active && setSlots([]))
      .finally(() => active && setLoadingSlots(false));
    return () => {
      active = false;
    };
  }, [booking.teacher_id, booking.teacher_stage]);

  async function submit() {
    if (!start) return;
    setSubmitting(true);
    try {
      await rescheduleBooking(booking.id, { scheduled_start: start });
      toast.success(dict.rescheduled);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : dict.actionError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={dict.rescheduleTitle}
      className="md:max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {dict.close}
          </Button>
          <Button disabled={!start} loading={submitting} onClick={submit}>
            {dict.reschedule}
          </Button>
        </>
      }
    >
      {loadingSlots ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : slots.length === 0 ? (
        <EmptyState icon={<CalendarClock aria-hidden />} title={browseDict.noSlots} />
      ) : (
        <SlotCalendar
          slots={slots}
          selected={start}
          onPick={setStart}
          locale={locale}
          hint={browseDict.pickTimePrompt}
        />
      )}
    </ResponsiveDialog>
  );
}

function ReviewModal({
  booking,
  dict,
  onClose,
  onDone,
}: {
  booking: Booking;
  dict: Dict;
  onClose: () => void;
  onDone: (bookingId: number) => void;
}) {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await createReview({ booking: booking.id, rating, text });
      toast.success(dict.reviewSuccess);
      onDone(booking.id);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "already_reviewed") {
        toast.error(dict.alreadyReviewed);
        onDone(booking.id);
      } else {
        toast.error(err instanceof ApiError ? err.message : dict.actionError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={dict.reviewTitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {dict.close}
          </Button>
          <Button loading={submitting} onClick={submit}>
            {dict.submitReview}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label>{dict.rating}</Label>
        <RatingInput value={rating} onChange={setRating} name="lesson-rating" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="review-text">{dict.reviewText}</Label>
        <Textarea
          id="review-text"
          rows={4}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
    </ResponsiveDialog>
  );
}
