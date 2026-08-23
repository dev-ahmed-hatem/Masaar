"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { App, Avatar, Badge, Button, Empty, Input, Spin } from "antd";
import { ArrowLeft } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { chatApi, type ChatMessage, type ChatThread } from "@/lib/chat";

type Dict = Dictionary["chat"];

const POLL_MS = 5000;

function timeLabel(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string | null, locale: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" });
}

// Stable per-day key (local time) used to insert date separators in a thread.
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function MessagesView({ dict, locale }: { dict: Dict; locale: string }) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [olderUrl, setOlderUrl] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshThreads = useCallback(async () => {
    try {
      const res = await chatApi.threads();
      setThreads(res.results);
    } catch {
      setThreads((prev) => prev ?? []);
    }
  }, []);

  // Merge a newest-first page into ascending state, dedup by id.
  const mergeNewest = useCallback((page: ChatMessage[]) => {
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const fresh = page.filter((m) => !known.has(m.id)).reverse();
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, []);

  const openThread = useCallback(
    async (id: number) => {
      setActiveId(id);
      setMessages([]);
      setOlderUrl(null);
      setLoadingThread(true);
      try {
        const page = await chatApi.messages(id);
        setMessages([...page.results].reverse());
        setOlderUrl(page.next);
        await chatApi.markRead(id);
        setThreads((prev) =>
          prev?.map((t) => (t.id === id ? { ...t, unread_count: 0 } : t)) ?? prev,
        );
      } catch (err) {
        message.error(err instanceof ApiError ? err.message : dict.genericError);
      } finally {
        setLoadingThread(false);
      }
    },
    [dict.genericError, message],
  );

  async function loadOlder() {
    if (!olderUrl) return;
    try {
      const page = await chatApi.messagesPage(olderUrl);
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        return [...[...page.results].reverse().filter((m) => !known.has(m.id)), ...prev];
      });
      setOlderUrl(page.next);
    } catch {
      /* keep the button; user can retry */
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body || !activeId) return;
    setSending(true);
    try {
      const sent = await chatApi.send(activeId, body);
      setDraft("");
      mergeNewest([sent]);
      chatApi.markRead(activeId).catch(() => undefined);
      refreshThreads();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    refreshThreads();
  }, [refreshThreads]);

  // Poll the open conversation + thread list while the tab is visible.
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden) return;
      refreshThreads();
      if (activeId != null) {
        try {
          const page = await chatApi.messages(activeId);
          mergeNewest(page.results);
          chatApi.markRead(activeId).catch(() => undefined);
        } catch {
          /* transient poll failure */
        }
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [activeId, mergeNewest, refreshThreads]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, activeId]);

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
                        {dayLabel(t.last_message_at, locale)}
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
        <div className={`min-w-0 min-h-0 flex-col ${active == null ? "hidden lg:flex" : "flex"}`}>
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
                  onClick={() => setActiveId(null)}
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
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-4 sm:px-4">
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
                        <Fragment key={m.id}>
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
                          <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div
                              className="max-w-[85%] rounded-2xl px-3.5 py-2 text-sm sm:max-w-[75%]"
                              style={
                                mine
                                  ? { background: "var(--grad-brand)", color: "#fff", boxShadow: "var(--glow)" }
                                  : { background: "var(--brand-tint)", color: "var(--ink)" }
                              }
                            >
                              <div className="whitespace-pre-wrap break-words">{m.body}</div>
                              <div
                                className="mt-0.5 text-end text-[10px]"
                                style={{ color: mine ? "rgba(255,255,255,0.75)" : "var(--ink-muted)" }}
                              >
                                {timeLabel(m.created_at, locale)}
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
              <div
                className="flex items-end gap-2 px-3 py-2.5 sm:px-4 sm:py-3"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <Input.TextArea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  maxLength={2000}
                  placeholder={dict.composerPlaceholder}
                />
                <Button type="primary" onClick={send} loading={sending} disabled={!draft.trim()}>
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
