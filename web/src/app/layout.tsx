import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Masaar",
  description: "Tutoring reservation marketplace — Egypt & Saudi Arabia.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
