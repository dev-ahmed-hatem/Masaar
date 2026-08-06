"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/context/theme-context";

export default function ThemeToggle({ label }: { label?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label ?? "Toggle theme"}
      title={label ?? "Toggle theme"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
      style={{ color: "var(--ink-muted)", border: "1px solid var(--border-strong)" }}
    >
      {isDark ? <Sun size={17} strokeWidth={2.2} /> : <Moon size={17} strokeWidth={2.2} />}
    </button>
  );
}
