import type { Metadata } from "next";
import localFont from "next/font/local";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "./globals.css";

const jakarta = localFont({
  src: "../../public/fonts/plus-jakarta-sans-latin.woff2",
  variable: "--font-jakarta",
  display: "swap",
  weight: "200 800",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});

const cairo = localFont({
  src: "../../public/fonts/cairo-arabic.woff2",
  variable: "--font-cairo",
  display: "swap",
  weight: "200 1000",
  fallback: ["Segoe UI", "Tahoma", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Masaar",
  description: "Tutoring reservation marketplace — Egypt & Saudi Arabia.",
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
      className={`${jakarta.variable} ${cairo.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}
