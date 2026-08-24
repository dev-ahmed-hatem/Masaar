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
      className="icon-btn h-9 w-9"
    >
      {isDark ? <Sun size={17} strokeWidth={2.2} /> : <Moon size={17} strokeWidth={2.2} />}
    </button>
  );
}
