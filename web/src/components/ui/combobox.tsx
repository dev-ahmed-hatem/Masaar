"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { inputBase } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface ComboboxOption<T extends string | number> {
  value: T;
  label: string;
}

/**
 * Fold away the differences Arabic typing produces for the same word: the
 * hamza forms of alef, the two yeh forms, teh marbuta, tatweel and the
 * harakat. Without this, searching "علوم" misses "عُلوم", and a bare alef
 * misses "الأحياء" — the kind of miss that makes a search box feel broken to
 * an Arabic speaker. Latin just lowercases.
 */
function fold(s: string): string {
  return s
    .toLowerCase()
    /* NFKD splits أ into alef + hamza and é into e + acute; the combining-mark
       strip then removes both, which also takes care of the harakat nobody
       types into a search box. */
    .normalize("NFKD")
    .replace(/\p{Mn}/gu, "")
    .replace(/ـ/g, "") // tatweel: decorative letter-stretching
    .replace(/ى/g, "ي") // alef maqsura -> yeh
    .replace(/ة/g, "ه") // teh marbuta -> heh
    .trim();
}

/**
 * Searchable single-select. Replaces antd's `Select showSearch` on
 * front-of-house screens: same job, our tokens, and Radix handles the RTL
 * placement and the focus trap.
 *
 * The list is a `role="listbox"` driven from the search field via
 * `aria-activedescendant`, so keyboard users never have to leave the input.
 */
export function Combobox<T extends string | number>({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  clearLabel,
  id,
  className,
  startSlot,
  align = "start",
}: {
  value: T | undefined;
  /** `undefined` means "cleared". */
  onChange: (value: T | undefined) => void;
  options: ComboboxOption<T>[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Provide to render a clear button once something is selected. */
  clearLabel?: string;
  id?: string;
  className?: string;
  startSlot?: React.ReactNode;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();

  const selected = options.find((o) => o.value === value);
  const needle = fold(query);
  const shown = needle ? options.filter((o) => fold(o.label).includes(needle)) : options;

  // Keep the highlighted row inside the scroll port.
  React.useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function pick(v: T) {
    onChange(v);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (shown.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + shown.length) % shown.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = shown[active];
      if (opt) pick(opt.value);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(Math.max(0, shown.length - 1));
    }
  }

  const clearable = clearLabel != null && selected != null;

  return (
    <div className={cn("relative", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            className={cn(
              inputBase,
              "flex h-11 w-full items-center gap-2 px-3.5 text-start text-[0.9375rem]",
              clearable ? "pe-16" : "pe-10",
            )}
          >
            {startSlot ? (
              <span className="flex shrink-0 items-center text-ink-faint [&_svg]:size-4">
                {startSlot}
              </span>
            ) : null}
            <span
              dir="auto"
              className={cn("min-w-0 flex-1 truncate", selected ? "text-ink" : "text-ink-faint")}
            >
              {selected ? selected.label : placeholder}
            </span>
          </button>
        </PopoverTrigger>

        {/* Outside the trigger: a button inside a button is invalid HTML. */}
        <span className="pointer-events-none absolute inset-y-0 end-3.5 flex items-center gap-1">
          {clearable ? (
            <button
              type="button"
              aria-label={clearLabel}
              onClick={() => onChange(undefined)}
              className="pointer-events-auto rounded-full p-0.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
          <ChevronDown className="size-4 text-ink-faint" aria-hidden />
        </span>

        <PopoverContent
          align={align}
          sideOffset={6}
          className="w-(--radix-popover-trigger-width) p-0"
          /* The search field owns the keyboard, so don't let Radix move focus
             to the first option on open. */
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement)?.querySelector<HTMLInputElement>("input")?.focus();
          }}
        >
          <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
            <Search className="size-4 shrink-0 text-ink-faint" aria-hidden />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0); // a fresh query invalidates the highlighted row
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              aria-autocomplete="list"
              aria-controls={listId}
              aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
              className="min-w-0 flex-1 bg-transparent t-body text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </div>

          <div ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1.5">
            {shown.length === 0 ? (
              <p className="px-3 py-6 text-center t-small text-ink-muted">{emptyText}</p>
            ) : (
              shown.map((o, i) => {
                const isSelected = o.value === value;
                return (
                  <button
                    key={String(o.value)}
                    type="button"
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    data-active={i === active || undefined}
                    dir="auto"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(o.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-control px-3 py-2 text-start t-small text-ink",
                      "data-active:bg-brand-tint data-active:text-on-brand-tint",
                      isSelected && "font-semibold",
                    )}
                  >
                    <span className="min-w-0 truncate">{o.label}</span>
                    {isSelected ? (
                      <Check className="size-4 shrink-0 text-brand" aria-hidden />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
