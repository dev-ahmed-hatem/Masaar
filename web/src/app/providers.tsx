"use client";

import { App, ConfigProvider } from "antd";
import arEG from "antd/locale/ar_EG";
import enUS from "antd/locale/en_US";

import { AuthProvider } from "@/context/auth-context";

export default function Providers({
  direction,
  locale,
  children,
}: {
  direction: "rtl" | "ltr";
  locale: string;
  children: React.ReactNode;
}) {
  return (
    <ConfigProvider
      direction={direction}
      locale={locale === "ar" ? arEG : enUS}
      theme={{
        token: {
          colorPrimary: "#0c7c6e",
          borderRadius: 10,
          fontFamily: "var(--font-sans)",
        },
      }}
    >
      <App>
        <AuthProvider>{children}</AuthProvider>
      </App>
    </ConfigProvider>
  );
}
