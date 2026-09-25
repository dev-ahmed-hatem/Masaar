"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, MessageSquare, Send } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { chatApi, type ChatMessage, type ChatThread } from "@/lib/chat";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

type Dict = Dictionary["chat"];

// Local view model: an in-flight optimistic message carries a clientId and a
// pending/failed flag until the server confirms it.
type UIMessage = ChatMessage & { clientId?: string; pending?: boolean; failed?: boolean };

const POLL_MS = 5000;
const NEAR_BOTTOM_PX = 80;
/** Composer ceiling (~4 rows) before it starts scrolling instead of growing. */
const COMPOSER_MAX_PX = 128;

const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const TRAILING_PUNCT = /[.,;:!?)\]]+$/;

const fill = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);

function timeLabel(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string | null, locale: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" });
}

/** Thread-list timestamp: time if today, "Yesterday", else a short date. */
function threadTime(iso: string | null, locale: string, dict: Dict): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return timeLabel(iso, locale);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return dict.yesterday;
  return d.toLocaleDateString(locale, { dateStyle: "medium" });
}

// Stable per-day key (local time) used to insert date separators in a thread.
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Render message text with clickable links (opens in a new tab). */
function renderBody(text: string, mine: boolean): ReactNode {
  const nodes: ReactNode[] = [];
  const re = new RegExp(URL_RE);
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    let url = m[0];
    // Don't swallow sentence punctuation that trails a URL.
    const trail = url.match(TRAILING_PUNCT)?.[0] ?? "";
    if (trail) url = url.slice(0, url.length - trail.length);
    if (start > last) nodes.push(text.slice(last, start));
    const href = url.startsWith("www.") ? `https://${url}` : url;
    nodes.push(
      <a
        key={key++}
        href={href}
        target="_blank"
        rel="noreferrer"
        dir="ltr"
        className={cn(
          "break-words underline underline-offset-2 hover:opacity-85",
          mine ? "text-on-brand" : "text-brand",
        )}
      >
        {url}
      </a>,
    );
    if (trail) nodes.push(trail);
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function MessagesView({
  dict,
  locale,
  audience = "teacher",
}: {
  dict: Dict;
  locale: string;
  /** Whose inbox this is — only the copy differs, the thread model is shared. */
  audience?: "student" | "teacher";
}) {
  const toast = useToast();
  const { user } = useAuth();
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [olderUrl, setOlderUrl] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [showJump, setShowJump] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [unreadAnchorId, setUnreadAnchorId] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const atBottomRef = useRef(true);
  const messagesRef = useRef<UIMessage[]>([]);
  const draftsRef = useRef<Record<number, string>>({});
  const tmpIdRef = useRef(-1);

  // Mirror messages into a ref so the poll callback can dedup without a
  // render-phase ref read (which the react-hooks lint disallows).
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Grow the composer with the draft instead of shipping a second textarea
  // library. Height is layout, not state, so it belongs on the element.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_PX)}px`;
  }, [draft, activeId]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior });
  }, []);

  const jumpToLatest = useCallback(() => {
    scrollToBottom("smooth");
    atBottomRef.current = true;
    setShowJump(false);
    setNewCount(0);
  }, [scrollToBottom]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    atBottomRef.current = near;
    if (near) {
      setShowJump(false);
      setNewCount(0);
    }
  }

  const refreshThreads = useCallback(async () => {
    try {
      const res = await chatApi.threads();
      setThreads(res.results);
    } catch {
      setThreads((prev) => prev ?? []);
    }
  }, []);

  // Merge a newest-first poll page: append genuinely new messages, then either
  // follow to the bottom (if already there or the message is mine) or surface
  // the "new messages" pill without yanking the reader's scroll position.
  const appendIncoming = useCallback(
    (page: ChatMessage[]) => {
      const known = new Set(messagesRef.current.map((m) => m.id));
      const fresh = page.filter((m) => !known.has(m.id)).reverse();
      if (!fresh.length) return;
      const fromOthers = fresh.filter((m) => user == null || m.sender_id !== user.id).length;
      // Final insert re-dedups against the authoritative prev state.
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const add = fresh.filter((m) => !seen.has(m.id));
        return add.length ? [...prev, ...add] : prev;
      });
      if (atBottomRef.current || fromOthers < fresh.length) {
        requestAnimationFrame(() => scrollToBottom("smooth"));
      } else {
        setNewCount((c) => c + fromOthers);
        setShowJump(true);
      }
    },
    [user, scrollToBottom],
  );

  const closeThread = useCallback(() => {
    if (activeId != null) draftsRef.current[activeId] = draft;
    setActiveId(null);
  }, [activeId, draft]);

  const openThread = useCallback(
    async (id: number) => {
      if (activeId != null) draftsRef.current[activeId] = draft;
      setActiveId(id);
      setMessages([]);
      setOlderUrl(null);
      setUnreadAnchorId(null);
      setShowJump(false);
      setNewCount(0);
      atBottomRef.current = true;
      setDraft(draftsRef.current[id] ?? "");
      setLoadingThread(true);
      const unread = threads?.find((t) => t.id === id)?.unread_count ?? 0;
      try {
        const page = await chatApi.messages(id);
        const asc = [...page.results].reverse();
        setMessages(asc);
        setOlderUrl(page.next);
        setUnreadAnchorId(unread > 0 && asc.length >= unread ? asc[asc.length - unread].id : null);
        await chatApi.markRead(id);
        setThreads((prev) => prev?.map((t) => (t.id === id ? { ...t, unread_count: 0 } : t)) ?? prev);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : dict.genericError);
      } finally {
        setLoadingThread(false);
      }
    },
    [activeId, draft, threads, dict.genericError, toast],
  );

  async function loadOlder() {
    if (!olderUrl) return;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const page = await chatApi.messagesPage(olderUrl);
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        const older = [...page.results].reverse().filter((m) => !known.has(m.id));
        return [...older, ...prev];
      });
      setOlderUrl(page.next);
      // Keep the reader anchored to what they were looking at.
      requestAnimationFrame(() => {
        if (el) el.scrollTop += el.scrollHeight - prevHeight;
      });
    } catch {
      /* keep the button; user can retry */
    }
  }

  const deliver = useCallback(
    async (msg: UIMessage, threadId: number) => {
      setMessages((prev) =>
        prev.map((m) => (m.clientId === msg.clientId ? { ...m, pending: true, failed: false } : m)),
      );
      try {
        const sent = await chatApi.send(threadId, msg.body);
        setMessages((prev) => [
          ...prev.filter((m) => m.clientId !== msg.clientId && m.id !== sent.id),
          sent,
        ]);
        chatApi.markRead(threadId).catch(() => undefined);
        refreshThreads();
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.clientId === msg.clientId ? { ...m, pending: false, failed: true } : m)),
        );
      }
    },
    [refreshThreads],
  );

  function send() {
    const body = draft.trim();
    if (!body || activeId == null) return;
    const tempId = tmpIdRef.current;
    tmpIdRef.current -= 1;
    const optimistic: UIMessage = {
      id: tempId,
      clientId: `tmp-${tempId}`,
      thread_id: activeId,
      sender_id: user?.id ?? -1,
      sender_name: user?.full_name ?? "",
      body,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    draftsRef.current[activeId] = "";
    requestAnimationFrame(() => scrollToBottom("smooth"));
    composerRef.current?.focus();
    deliver(optimistic, activeId);
  }

  useEffect(() => {
    let active = true;
    chatApi
      .threads()
      .then((r) => active && setThreads(r.results))
      .catch(() => active && setThreads((prev) => prev ?? []));
    return () => {
      active = false;
    };
  }, []);

  // Poll the open conversation + thread list while the tab is visible.
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden) return;
      refreshThreads();
      if (activeId != null) {
        try {
          const page = await chatApi.messages(activeId);
          appendIncoming(page.results);
          chatApi.markRead(activeId).catch(() => undefined);
        } catch {
          /* transient poll failure */
        }
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [activeId, appendIncoming, refreshThreads]);

  // On opening a thread: snap to the newest message and focus the composer.
  useEffect(() => {
    if (activeId == null || loadingThread) return;
    requestAnimationFrame(() => scrollToBottom("auto"));
    composerRef.current?.focus();
  }, [activeId, loadingThread, scrollToBottom]);

  const active = threads?.find((t) => t.id === activeId) ?? null;
  const otherName = (t: ChatThread) =>
    user && t.student_id === user.id ? t.teacher_name : t.student_name;
  const student = audience === "student";

  return (
    <section className="flex flex-col gap-4 sm:gap-6">
      {/* Header — hidden on mobile once a conversation is open, to give the
          chat the full viewport (the thread's own header shows the name). */}
      <header className={cn("flex flex-col gap-2", active != null ? "hidden lg:flex" : "flex")}>
        <h1 className="t-h1 text-ink">{dict.title}</h1>
        <p className="max-w-2xl t-body text-ink-muted">
          {student ? dict.introStudent : dict.intro}
        </p>
      </header>

      <Card className="grid h-[calc(100dvh-9rem)] max-h-[720px] min-h-[440px] grid-cols-1 overflow-hidden lg:h-[620px] lg:max-h-[calc(100vh-9rem)] lg:grid-cols-[minmax(240px,340px)_1fr]">
        {/* Thread list — full-width on mobile until a thread is opened. */}
        <div
          aria-label={dict.threads}
          className={cn(
            "min-h-0 flex-col overflow-y-auto border-border lg:border-e",
            active != null ? "hidden lg:flex" : "flex",
          )}
        >
          {threads == null ? (
            <div className="flex flex-col gap-2 p-4" aria-busy>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-control" />
              ))}
            </div>
          ) : threads.length === 0 ? (
            <EmptyState
              icon={<MessageSquare aria-hidden />}
              title={student ? dict.noThreadsStudent : dict.noThreads}
              className="py-10"
            />
          ) : (
            threads.map((t) => {
              const name = otherName(t);
              const selected = t.id === activeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openThread(t.id)}
                  aria-current={selected}
                  className={cn(
                    "flex items-center gap-3 border-b border-border px-4 py-3.5 text-start transition-colors",
                    selected ? "bg-brand-tint" : "hover:bg-surface-2",
                  )}
                >
                  <Avatar name={name} shape="circle" className="size-11 shrink-0 text-base" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center justify-between gap-2">
                      <bdi className="truncate t-small font-semibold text-ink">{name}</bdi>
                      <span className="shrink-0 t-caption text-ink-faint">
                        {threadTime(t.last_message_at, locale, dict)}
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span
                        dir="auto"
                        className={cn(
                          "truncate t-caption",
                          t.unread_count > 0 ? "font-semibold text-ink" : "text-ink-muted",
                        )}
                      >
                        {t.last_message?.body ?? dict.noMessagesYet}
                      </span>
                      {t.unread_count > 0 ? (
                        <Badge
                          variant="solid"
                          size="sm"
                          className="shrink-0 px-2"
                          aria-label={fill(dict.unreadCount, { n: String(t.unread_count) })}
                        >
                          {t.unread_count}
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Conversation — full-width on mobile only when a thread is open. */}
        <div
          className={cn(
            "relative min-h-0 min-w-0 flex-col",
            active == null ? "hidden lg:flex" : "flex",
          )}
        >
          {active == null ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState icon={<MessageSquare aria-hidden />} title={dict.selectThread} />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5 sm:px-4 sm:py-3">
                <button
                  type="button"
                  onClick={closeThread}
                  aria-label={dict.back}
                  className="-ms-1 flex size-9 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
                >
                  <ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden />
                </button>
                <Avatar name={otherName(active)} shape="circle" className="size-9 shrink-0 text-sm" />
                <bdi className="truncate t-small font-semibold text-ink">{otherName(active)}</bdi>
              </div>

              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4 sm:px-4"
              >
                {/* `mt-auto` pins a short conversation to the bottom of the pane,
                    the way every chat behaves, and collapses to nothing once the
                    thread is long enough to scroll. */}
                <div className="mt-auto flex flex-col gap-2">
                  {olderUrl ? (
                    <Button variant="outline" size="sm" onClick={loadOlder} className="self-center">
                      {dict.loadOlder}
                    </Button>
                  ) : null}

                  {loadingThread ? (
                    <div className="flex flex-col gap-3 py-2" aria-busy>
                      <Skeleton className="h-10 w-48 rounded-card" />
                      <Skeleton className="h-10 w-40 self-end rounded-card" />
                      <Skeleton className="h-16 w-56 rounded-card" />
                    </div>
                  ) : (
                    (() => {
                      let lastDay = "";
                      return messages.map((m) => {
                        const mine = user != null && m.sender_id === user.id;
                        const key = dayKey(m.created_at);
                        const showDay = key !== lastDay;
                        lastDay = key;
                        return (
                          <Fragment key={m.clientId ?? m.id}>
                            {showDay ? (
                              <div className="my-1.5 flex justify-center">
                                <span className="rounded-pill bg-surface-2 px-3 py-0.5 t-caption font-medium text-ink-muted">
                                  {dayLabel(m.created_at, locale)}
                                </span>
                              </div>
                            ) : null}

                            {m.id === unreadAnchorId ? (
                              <div className="my-1.5 flex items-center gap-2">
                                <span className="h-px flex-1 bg-border" />
                                <span className="t-caption font-semibold text-brand">
                                  {dict.newMessages}
                                </span>
                                <span className="h-px flex-1 bg-border" />
                              </div>
                            ) : null}

                            <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                              <div
                                className={cn(
                                  "max-w-[85%] rounded-card px-3.5 py-2 t-small sm:max-w-[75%]",
                                  mine
                                    ? "rounded-ee-sm bg-brand text-on-brand"
                                    : "rounded-es-sm bg-surface-2 text-ink",
                                  m.pending && "opacity-70",
                                )}
                              >
                                <div dir="auto" className="whitespace-pre-wrap break-words">
                                  {renderBody(m.body, mine)}
                                </div>
                                <div
                                  className={cn(
                                    "mt-0.5 flex items-center justify-end gap-1.5 t-caption",
                                    /* No alpha on the brand bubble: white on teal
                                       is already only 5:1, so fading it would drop
                                       the timestamp below AA. */
                                    mine ? "text-on-brand" : "text-ink-faint",
                                  )}
                                >
                                  {m.failed ? (
                                    <button
                                      type="button"
                                      onClick={() => deliver(m, active.id)}
                                      className="font-semibold underline underline-offset-2"
                                    >
                                      {dict.sendFailed} · {dict.retry}
                                    </button>
                                  ) : (
                                    <>
                                      <span>{timeLabel(m.created_at, locale)}</span>
                                      {m.pending ? <span>· {dict.sending}</span> : null}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Fragment>
                        );
                      });
                    })()
                  )}
                  <div ref={bottomRef} />
                </div>
              </div>

              {showJump ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    pill
                    onClick={jumpToLatest}
                    className="pointer-events-auto text-brand shadow-md"
                  >
                    {newCount > 0 ? `${newCount} ${dict.newMessages}` : dict.jumpToLatest}
                    <ArrowDown aria-hidden />
                  </Button>
                </div>
              ) : null}

              <div className="flex items-end gap-2 border-t border-border px-3 py-2.5 sm:px-4 sm:py-3">
                <Textarea
                  ref={composerRef}
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") closeThread();
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  maxLength={2000}
                  aria-label={dict.composerPlaceholder}
                  placeholder={dict.composerPlaceholder}
                  className="min-h-11 resize-none py-2.5"
                />
                <Button
                  size="icon"
                  onClick={send}
                  disabled={!draft.trim()}
                  aria-label={dict.send}
                  className="shrink-0"
                >
                  <Send className="rtl:-scale-x-100" aria-hidden />
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </section>
  );
}
