"use client";

import { DirectionProvider } from "@radix-ui/react-direction";

import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
import { ToastProvider } from "@/components/ui/toast";

/**
 * App-wide context. Deliberately antd-free: the moderator views are the only
 * antd consumers left, and they mount their own provider in
 * `src/components/admin/antd-provider.tsx` so the library stays out of every
 * other route chunk.
 */
export default function Providers({
  direction,
  children,
}: {
  direction: "rtl" | "ltr";
  children: React.ReactNode;
}) {
  return (
    /* Radix primitives read direction from this context, not from the DOM.
       Without it, popovers/selects/tabs mis-align on /ar. */
    <DirectionProvider dir={direction}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </DirectionProvider>
  );
}
