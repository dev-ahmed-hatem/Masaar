"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface ResumeField {
  name: string;
  label: string;
  /** Renders a textarea on its own row instead of a half-width input. */
  area?: boolean;
  /** Short numeric field (a year) — narrower and numeric on mobile keyboards. */
  year?: boolean;
}

/**
 * Repeatable résumé block (education, work experience, certifications) — the
 * same three lists appear in the application form and the profile editor.
 *
 * Controlled by value/onChange rather than RHF's `useFieldArray`: every item is
 * a flat record of strings, so the whole list is one form value and both
 * callers can hand it straight to a `Controller`.
 */
export default function ResumeList<T extends object>({
  value,
  onChange,
  title,
  addLabel,
  removeLabel,
  fields,
  blank,
  idPrefix,
}: {
  value: T[];
  onChange: (next: T[]) => void;
  title: string;
  addLabel: string;
  removeLabel: string;
  fields: ResumeField[];
  /** An empty item — its keys define the shape a new row starts with. */
  blank: T;
  /** Namespace for the generated input ids (must be unique per list). */
  idPrefix: string;
}) {
  const rows = value ?? [];

  // The three item shapes are plain interfaces of strings, but an interface
  // has no index signature — so read and write their fields by name here.
  const cell = (row: T, key: string) => String((row as Record<string, unknown>)[key] ?? "");

  function patch(index: number, key: string, next: string) {
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: next } : row)));
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 t-small font-semibold text-ink">{title}</legend>

      {rows.map((row, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-card border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {fields
              .filter((f) => !f.area)
              .map((f) => {
                const id = `${idPrefix}-${index}-${f.name}`;
                return (
                  <div key={f.name} className="flex flex-col gap-1.5">
                    <Label htmlFor={id}>{f.label}</Label>
                    <Input
                      id={id}
                      dir="auto"
                      inputMode={f.year ? "numeric" : undefined}
                      value={cell(row, f.name)}
                      onChange={(e) => patch(index, f.name, e.target.value)}
                    />
                  </div>
                );
              })}
          </div>

          {fields
            .filter((f) => f.area)
            .map((f) => {
              const id = `${idPrefix}-${index}-${f.name}`;
              return (
                <div key={f.name} className="flex flex-col gap-1.5">
                  <Label htmlFor={id}>{f.label}</Label>
                  <Textarea
                    id={id}
                    dir="auto"
                    rows={2}
                    className="min-h-16"
                    value={cell(row, f.name)}
                    onChange={(e) => patch(index, f.name, e.target.value)}
                  />
                </div>
              );
            })}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start text-error hover:bg-error-tint hover:text-error"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <Trash2 aria-hidden />
            {removeLabel}
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => onChange([...rows, { ...blank }])}
      >
        <Plus aria-hidden />
        {addLabel}
      </Button>
    </fieldset>
  );
}
