"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { App, Avatar, Badge, Button, Empty, Input, Spin } from "antd";

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
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>
          {dict.title}
        </h1>
        <p className="mt-1.5 text-base" style={{ color: "var(--ink-muted)" }}>
          {dict.intro}
        </p>
      </div>

      <div
        className="surface grid overflow-hidden"
        style={{ gridTemplateColumns: "minmax(220px, 320px) 1fr", minHeight: 480 }}
      >
        {/* Thread list */}
        <div className="flex flex-col overflow-y-auto" style={{ borderInlineEnd: "1px solid var(--border)" }}>
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
                  className="flex items-center gap-3 px-4 py-3 text-start transition-colors"
                  style={{
                    background: selected ? "var(--brand-tint)" : "transparent",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <Avatar style={{ background: "var(--brand-tint)", color: "var(--brand)", fontWeight: 600 }}>
                    {name.trim().charAt(0).toUpperCase() || "?"}
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
                        {name}
                      </span>
                      <span className="shrink-0 text-xs" style={{ color: "var(--ink-muted)" }}>
                        {dayLabel(t.last_message_at, locale)}
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs" style={{ color: "var(--ink-muted)" }}>
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

        {/* Conversation */}
        <div className="flex min-w-0 flex-col">
          {active == null ? (
            <div className="flex flex-1 items-center justify-center px-6 py-16">
              <Empty description={dict.selectThread} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          ) : (
            <>
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {otherName(active)}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4" style={{ maxHeight: 420 }}>
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
                  messages.map((m) => {
                    const mine = user != null && m.sender_id === user.id;
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm"
                          style={
                            mine
                              ? { background: "var(--brand)", color: "#fff" }
                              : { background: "var(--brand-tint)", color: "var(--ink)" }
                          }
                        >
                          <div className="whitespace-pre-wrap break-words">{m.body}</div>
                          <div
                            className="mt-0.5 text-[10px]"
                            style={{ color: mine ? "rgba(255,255,255,0.75)" : "var(--ink-muted)" }}
                          >
                            {timeLabel(m.created_at, locale)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>
              <div className="flex gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
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
