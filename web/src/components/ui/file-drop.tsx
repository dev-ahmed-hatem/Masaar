"use client";

import * as React from "react";
import { ImageUp, X } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Single-image picker with drag-and-drop and a real preview.
 *
 * The preview matters more than it looks: this is how a student checks they
 * photographed the right transfer receipt before a human reviewer sees it.
 * Replaces antd `Upload`, which only listed a filename.
 */
export function FileDrop({
  value,
  onChange,
  accept,
  maxBytes,
  label,
  hint,
  invalidMessage,
  removeLabel,
  id,
  className,
  invalid,
  "aria-describedby": describedBy,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  /** Comma-separated MIME list, mirroring what the API accepts. */
  accept: string;
  maxBytes: number;
  label: string;
  hint?: string;
  /** Shown when a dropped file is the wrong type or too large. */
  invalidMessage: string;
  removeLabel: string;
  id?: string;
  className?: string;
  /** Draws the error border; the message itself stays with the caller's field. */
  invalid?: boolean;
  "aria-describedby"?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [rejected, setRejected] = React.useState(false);

  // Object URLs must be revoked or the blob stays in memory for the session.
  const preview = React.useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  React.useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function accepted(file: File): boolean {
    return accept.split(",").includes(file.type) && file.size <= maxBytes;
  }

  function take(file: File | undefined) {
    if (!file) return;
    if (accepted(file)) {
      setRejected(false);
      onChange(file);
    } else {
      setRejected(true);
    }
  }

  function clear() {
    setRejected(false);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (value && preview) {
    return (
      <div className={cn("flex items-start gap-3 rounded-card border border-border p-3", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL from the
            file the user just picked; next/image cannot optimise it. */}
        <img
          src={preview}
          alt={value.name}
          className="size-20 shrink-0 rounded-control border border-border object-cover"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate t-small font-medium text-ink">{value.name}</p>
          <p className="t-caption text-ink-faint">{Math.round(value.size / 1024)} KB</p>
        </div>
        <button
          type="button"
          onClick={clear}
          aria-label={removeLabel}
          className="shrink-0 rounded-control p-1.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        id={id}
        aria-describedby={describedBy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-1.5 rounded-card border border-dashed px-4 py-7 text-center",
          "transition-colors",
          dragging ? "border-brand bg-brand-tint" : "border-border-input hover:border-brand",
          invalid && "border-error",
        )}
      >
        <ImageUp className="size-6 text-ink-faint" aria-hidden />
        <span className="t-small font-semibold text-ink">{label}</span>
        {hint ? <span className="t-caption text-ink-muted">{hint}</span> : null}
      </button>

      {rejected ? (
        <p role="alert" className="mt-1.5 t-caption text-error">
          {invalidMessage}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => take(e.target.files?.[0])}
      />
    </div>
  );
}
