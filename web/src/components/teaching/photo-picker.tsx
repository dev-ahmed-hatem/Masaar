"use client";

import { Camera } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

/** Image types both the application and the profile photo endpoints accept. */
export const PHOTO_ACCEPT = "image/png,image/jpeg,image/webp";

/**
 * Round photo preview with upload / replace / remove. Purely presentational:
 * the applicant form keeps the `File` locally, the profile editor uploads it —
 * both only hand this a preview URL.
 */
export default function PhotoPicker({
  src,
  name,
  hint,
  uploadLabel,
  replaceLabel,
  removeLabel,
  onPick,
  onRemove,
  busy = false,
}: {
  src: string | null;
  name?: string | null;
  hint: string;
  uploadLabel: string;
  replaceLabel: string;
  removeLabel: string;
  onPick: (file: File) => void;
  onRemove?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-5">
      <Avatar src={src} name={name} shape="circle" className="size-24 text-3xl" />

      <div className="flex min-w-0 flex-col gap-2">
        <p className="max-w-xs t-caption text-ink-muted">{hint}</p>
        <div className="flex flex-wrap items-center gap-2">
          {/* A styled <label> wrapping the file input: a real <input type=file>
              can't be triggered from a button without a ref dance, and the
              label keeps the keyboard and screen-reader behaviour intact. */}
          <Button asChild variant="outline" size="sm" className="cursor-pointer">
            <label>
              <Camera aria-hidden />
              {src ? replaceLabel : uploadLabel}
              <input
                type="file"
                accept={PHOTO_ACCEPT}
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Reset so picking the same file twice still fires change.
                  e.target.value = "";
                  if (file) onPick(file);
                }}
              />
            </label>
          </Button>

          {src && onRemove ? (
            <Button variant="ghost" size="sm" onClick={onRemove} disabled={busy}>
              {removeLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
