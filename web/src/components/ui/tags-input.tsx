"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";
import { inputBase } from "./input";

/**
 * Free-text chips (specialties). Enter or a comma commits the draft;
 * Backspace on an empty box removes the last chip — the shortcut people
 * already expect from every tag field.
 *
 * Replaces antd's `Select mode="tags"`, which renders a dropdown that never
 * has anything in it.
 */
export function TagsInput({
  value,
  onChange,
  placeholder,
  removeLabel,
  id,
  maxTags = 20,
  "aria-describedby": describedBy,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Accessible name for each chip's delete button, e.g. "Remove". */
  removeLabel: string;
  id?: string;
  maxTags?: number;
  "aria-describedby"?: string;
}) {
  const [draft, setDraft] = React.useState("");

  function commit(raw: string) {
    const tag = raw.trim();
    if (!tag || value.length >= maxTags) return;
    // Case-insensitive de-dupe: "Exam prep" and "exam prep" are one tag.
    if (!value.some((t) => t.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft("");
  }

  return (
    <div className={cn(inputBase, "input-shell flex min-h-11 flex-wrap items-center gap-1.5 p-1.5")}>
      {value.map((tag) => (
        <span
          key={tag}
          dir="auto"
          className="inline-flex items-center gap-1 rounded-pill bg-brand-tint py-1 ps-2.5 pe-1 t-caption font-semibold text-on-brand-tint"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            aria-label={`${removeLabel} — ${tag}`}
            className="rounded-full p-0.5 transition-colors hover:bg-brand hover:text-on-brand"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}

      <input
        id={id}
        aria-describedby={describedBy}
        value={draft}
        dir="auto"
        placeholder={value.length === 0 ? placeholder : undefined}
        onChange={(e) => {
          const next = e.target.value;
          if (next.endsWith(",")) commit(next.slice(0, -1));
          else setDraft(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // Never let a tag submit the surrounding form.
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
        className="min-w-28 flex-1 bg-transparent px-2 py-1 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:outline-none"
      />
    </div>
  );
}
