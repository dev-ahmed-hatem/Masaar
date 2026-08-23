import type { Metadata } from "next";
import localFont from "next/font/local";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "./globals.css";

// Jakarta covers Latin only. We deliberately give it NO fallback fonts here:
// next/font would otherwise bake Arabic-capable system fonts (Segoe UI, Arial,
// its metric-adjusted "Fallback") into --font-jakarta, and those would catch
// Arabic glyphs before the stack ever reached Cairo. With the variable holding
// just the Jakarta face, Arabic falls straight through to "Cairo" (see the
// --font-sans / --font-display chains + @font-face rules in globals.css).
const jakarta = localFont({
  src: "../../public/fonts/plus-jakarta-sans-latin.woff2",
  variable: "--font-jakarta",
  display: "swap",
  weight: "200 800",
  adjustFontFallback: false,
  fallback: [],
});

// Cairo (Arabic) is self-hosted via plain @font-face rules in globals.css,
// pointing at static files in /public/fonts/cairo — more reliable in prod
// than next/font for the Arabic subset.

export const metadata: Metadata = {
  title: "Masaar",
  description: "Tutoring reservation marketplace — the Arab world.",
};

// Runs before first paint to set the theme class from localStorage / system,
// preventing a light-to-dark flash on load. Mirrors ThemeProvider's logic.
const noFlashTheme = `(function(){try{var t=localStorage.getItem("masaar-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var r=document.documentElement;if(t==="dark"){r.classList.add("dark");}r.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={jakarta.variable}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}
