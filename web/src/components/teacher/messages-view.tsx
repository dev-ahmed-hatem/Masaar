"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { App, Avatar, Badge, Button, Empty, Input, Spin, type GetRef } from "antd";
import { ArrowDown, ArrowLeft } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { chatApi, type ChatMessage, type ChatThread } from "@/lib/chat";

type Dict = Dictionary["chat"];

// Local view model: an in-flight optimistic message carries a clientId and a
// pending/failed flag until the server confirms it.
type UIMessage = ChatMessage & { clientId?: string; pending?: boolean; failed?: boolean };

const POLL_MS = 5000;
const NEAR_BOTTOM_PX = 80;

const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const TRAILING_PUNCT = /[.,;:!?)\]]+$/;

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

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
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
        className="chat-link"
        style={{ color: mine ? "#fff" : "var(--brand)" }}
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

export default function MessagesView({ dict, locale }: { dict: Dict; locale: string }) {
  const { message } = App.useApp();
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
  const composerRef = useRef<GetRef<typeof Input.TextArea>>(null);
  const atBottomRef = useRef(true);
  const messagesRef = useRef<UIMessage[]>([]);
  const draftsRef = useRef<Record<number, string>>({});
  const tmpIdRef = useRef(-1);

  // Mirror messages into a ref so the poll callback can dedup without a
  // render-phase ref read (which the react-hooks lint disallows).
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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
        setUnreadAnchorId(
          unread > 0 && asc.length >= unread ? asc[asc.length - unread].id : null,
        );
        await chatApi.markRead(id);
        setThreads((prev) => prev?.map((t) => (t.id === id ? { ...t, unread_count: 0 } : t)) ?? prev);
      } catch (err) {
        message.error(err instanceof ApiError ? err.message : dict.genericError);
      } finally {
        setLoadingThread(false);
      }
    },
    [activeId, draft, threads, dict.genericError, message],
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

  return (
    <section className="flex flex-col gap-4 sm:gap-6">
      {/* Header — hidden on mobile once a conversation is open, to give the
          chat the full viewport (the thread's own header shows the name). */}
      <div className={active != null ? "hidden lg:block" : "block"}>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "var(--ink)" }}>
          {dict.title}
        </h1>
        <p className="mt-1.5 text-sm sm:text-base" style={{ color: "var(--ink-muted)" }}>
          {dict.intro}
        </p>
      </div>

      <div className="surface grid grid-cols-1 overflow-hidden h-[calc(100dvh-9rem)] max-h-[720px] min-h-[440px] lg:h-[620px] lg:max-h-[calc(100vh-9rem)] lg:grid-cols-[minmax(240px,340px)_1fr]">
        {/* Thread list — full-width on mobile until a thread is opened. */}
        <div
          className={`min-h-0 flex-col overflow-y-auto ${active != null ? "hidden lg:flex" : "flex"}`}
          style={{ borderInlineEnd: "1px solid var(--border)" }}
        >
          {threads == null ? (
            <div className="flex justify-center py-10">
              <Spin />
            </div>
          ) : threads.length === 0 ? (
            <div className="px-4 py-10">
              <Empty description={dict.noThreads} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          ) : (
            threads.map((t) => {
              const name = otherName(t);
              const selected = t.id === activeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openThread(t.id)}
                  className="flex items-center gap-3 px-4 py-3.5 text-start transition-colors"
                  style={{
                    background: selected ? "var(--brand-tint)" : "transparent",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <Avatar
                    size={44}
                    className="shrink-0"
                    style={{ background: "var(--brand-tint)", color: "var(--brand)", fontWeight: 600 }}
                  >
                    {initialOf(name)}
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
                        {name}
                      </span>
                      <span className="shrink-0 text-xs" style={{ color: "var(--ink-faint)" }}>
                        {threadTime(t.last_message_at, locale, dict)}
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className="truncate text-xs"
                        style={{
                          color: t.unread_count > 0 ? "var(--ink)" : "var(--ink-muted)",
                          fontWeight: t.unread_count > 0 ? 600 : 400,
                        }}
                      >
                        {t.last_message?.body ?? dict.noMessagesYet}
                      </span>
                      {t.unread_count > 0 && <Badge count={t.unread_count} size="small" />}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Conversation — full-width on mobile only when a thread is open. */}
        <div className={`relative min-w-0 min-h-0 flex-col ${active == null ? "hidden lg:flex" : "flex"}`}>
          {active == null ? (
            <div className="flex flex-1 items-center justify-center px-6 py-16">
              <Empty description={dict.selectThread} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          ) : (
            <>
              <div
                className="flex items-center gap-2.5 px-3 py-2.5 sm:px-4 sm:py-3"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <button
                  type="button"
                  onClick={closeThread}
                  aria-label={dict.back}
                  className="-ms-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-2)] lg:hidden"
                  style={{ color: "var(--ink-muted)" }}
                >
                  <ArrowLeft size={20} className="rtl:-scale-x-100" />
                </button>
                <Avatar
                  size={36}
                  className="shrink-0"
                  style={{ background: "var(--brand-tint)", color: "var(--brand)", fontWeight: 600 }}
                >
                  {initialOf(otherName(active))}
                </Avatar>
                <span className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {otherName(active)}
                </span>
              </div>
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-4 sm:px-4"
              >
                {olderUrl && (
                  <Button size="small" onClick={loadOlder} className="self-center">
                    {dict.loadOlder}
                  </Button>
                )}
                {loadingThread ? (
                  <div className="flex justify-center py-10">
                    <Spin />
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
                          {showDay && (
                            <div className="my-1.5 flex justify-center">
                              <span
                                className="rounded-full px-3 py-0.5 text-[11px] font-medium"
                                style={{ background: "var(--surface-2)", color: "var(--ink-muted)" }}
                              >
                                {dayLabel(m.created_at, locale)}
                              </span>
                            </div>
                          )}
                          {m.id === unreadAnchorId && (
                            <div className="my-1.5 flex items-center gap-2">
                              <span className="h-px flex-1" style={{ background: "var(--border)" }} />
                              <span className="text-[11px] font-semibold" style={{ color: "var(--brand)" }}>
                                {dict.newMessages}
                              </span>
                              <span className="h-px flex-1" style={{ background: "var(--border)" }} />
                            </div>
                          )}
                          <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div
                              className="max-w-[85%] rounded-2xl px-3.5 py-2 text-sm sm:max-w-[75%]"
                              style={
                                mine
                                  ? {
                                      background: "var(--grad-brand)",
                                      color: "#fff",
                                      boxShadow: "var(--glow)",
                                      opacity: m.pending ? 0.7 : 1,
                                    }
                                  : { background: "var(--brand-tint)", color: "var(--ink)" }
                              }
                            >
                              <div className="whitespace-pre-wrap break-words">
                                {renderBody(m.body, mine)}
                              </div>
                              <div
                                className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px]"
                                style={{ color: mine ? "rgba(255,255,255,0.75)" : "var(--ink-muted)" }}
                              >
                                {m.failed ? (
                                  <button
                                    type="button"
                                    onClick={() => deliver(m, active.id)}
                                    className="font-semibold underline"
                                    style={{ color: mine ? "#ffe0e0" : "var(--brand)" }}
                                  >
                                    {dict.sendFailed} · {dict.retry}
                                  </button>
                                ) : (
                                  <>
                                    <span>{timeLabel(m.created_at, locale)}</span>
                                    {m.pending && <span>· {dict.sending}</span>}
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

              {showJump && (
                <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center">
                  <button
                    type="button"
                    onClick={jumpToLatest}
                    className="chat-jump pointer-events-auto flex items-center gap-1.5"
                  >
                    {newCount > 0 ? `${newCount} ${dict.newMessages}` : dict.jumpToLatest}
                    <ArrowDown size={14} />
                  </button>
                </div>
              )}

              <div
                className="flex items-end gap-2 px-3 py-2.5 sm:px-4 sm:py-3"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <Input.TextArea
                  ref={composerRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") closeThread();
                  }}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  maxLength={2000}
                  placeholder={dict.composerPlaceholder}
                />
                <Button type="primary" onClick={send} disabled={!draft.trim()}>
                  {dict.send}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
