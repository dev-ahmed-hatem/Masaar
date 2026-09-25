import type { Metadata } from "next";
import "./globals.css";

// Both faces are self-hosted via plain @font-face rules in globals.css
// (/public/fonts/readex and /public/fonts/cairo) — more reliable in prod than
// next/font for Arabic subsets, and each face covers Arabic AND Latin:
//   display -> Readex Pro   body -> Cairo
// There is deliberately no Latin-only face here. The previous setup needed a
// `fallback: []` on next/font to stop Arabic-capable system fonts from
// intercepting Arabic glyphs before the stack reached Cairo; with one
// bilingual face per role that whole failure mode is gone.

export const metadata: Metadata = {
  // Next picks up icon.svg, apple-icon.png and opengraph-image.png from this
  // directory automatically; metadataBase makes the OG URL absolute.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Wisal", template: "%s · Wisal" },
  description: "Book lessons with vetted teachers across the Arab world.",
  applicationName: "Wisal",
  openGraph: {
    type: "website",
    siteName: "Wisal",
    title: "Wisal",
    description: "Book lessons with vetted teachers across the Arab world.",
  },
  twitter: { card: "summary_large_image" },
};

// Runs before first paint to set the theme class from localStorage / system,
// preventing a light-to-dark flash on load. Mirrors ThemeProvider's logic.
const noFlashTheme = `(function(){try{var t=localStorage.getItem("wisal-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var r=document.documentElement;if(t==="dark"){r.classList.add("dark");}r.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
        {/* antd is mounted per-subtree in src/app/[locale]/(app)/admin/layout.tsx,
            not here: it is the only place that still uses it, and mounting its
            registry globally put the whole library in every route chunk. */}
        {children}
      </body>
    </html>
  );
}
