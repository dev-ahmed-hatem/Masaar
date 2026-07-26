"use client";

import { App, ConfigProvider, theme as antdTheme } from "antd";
import arEG from "antd/locale/ar_EG";
import enUS from "antd/locale/en_US";

import { AuthProvider } from "@/context/auth-context";

const BRAND = "#0c7c6e";
const INK = "#0f1d1b";
const INK_MUTED = "#5b6b68";
const INK_FAINT = "#8a9794";
const BORDER = "#e6ebea";
const BORDER_SUBTLE = "#eef2f1";
const SURFACE = "#ffffff";
const LAYOUT = "#f4f7f6";
const TABLE_HEADER = "#f5f8f7";

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
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: BRAND,
          colorInfo: BRAND,
          colorLink: BRAND,
          colorLinkHover: "#0a6559",
          colorSuccess: "#2e9e6b",
          colorWarning: "#d9930f",
          colorError: "#d64545",
          colorText: INK,
          colorTextSecondary: INK_MUTED,
          colorTextTertiary: INK_FAINT,
          colorBorder: BORDER,
          colorBorderSecondary: BORDER_SUBTLE,
          colorBgLayout: LAYOUT,
          colorBgContainer: SURFACE,
          colorBgElevated: SURFACE,
          borderRadius: 10,
          borderRadiusLG: 14,
          borderRadiusSM: 6,
          controlHeight: 40,
          fontSize: 14,
          fontFamily: "var(--font-sans)",
          lineWidth: 1,
          wireframe: false,
          boxShadow:
            "0 1px 2px rgba(16,29,27,0.04), 0 6px 20px rgba(16,29,27,0.05)",
          boxShadowSecondary:
            "0 8px 28px rgba(16,29,27,0.10), 0 2px 8px rgba(16,29,27,0.05)",
        },
        components: {
          Layout: {
            headerBg: SURFACE,
            headerHeight: 64,
            headerPadding: "0 24px",
            bodyBg: LAYOUT,
          },
          Card: {
            borderRadiusLG: 16,
            paddingLG: 24,
            colorBorderSecondary: BORDER,
            headerFontSize: 16,
            headerBg: "transparent",
            boxShadowTertiary: "none",
          },
          Table: {
            headerBg: TABLE_HEADER,
            headerColor: INK_MUTED,
            headerSplitColor: "transparent",
            borderColor: BORDER_SUBTLE,
            cellPaddingBlock: 14,
            rowHoverBg: "#f2f7f6",
            headerBorderRadius: 0,
            fontWeightStrong: 600,
          },
          Button: {
            controlHeight: 40,
            fontWeight: 500,
            primaryShadow: "none",
            defaultShadow: "none",
            dangerShadow: "none",
          },
          Input: { controlHeight: 40, activeShadow: "0 0 0 2px rgba(12,124,110,0.12)" },
          InputNumber: { controlHeight: 40 },
          Select: { controlHeight: 40 },
          DatePicker: { controlHeight: 40 },
          Tag: { borderRadiusSM: 6, defaultBg: "#f1f5f4", defaultColor: INK_MUTED },
          Tabs: { titleFontSize: 15, horizontalItemGutter: 24, inkBarColor: BRAND },
          Drawer: { paddingLG: 24 },
          Modal: { borderRadiusLG: 16 },
          Alert: { borderRadiusLG: 12 },
          Segmented: { borderRadius: 8 },
          Menu: { itemBorderRadius: 8, itemHeight: 38 },
        },
      }}
    >
      <App>
        <AuthProvider>{children}</AuthProvider>
      </App>
    </ConfigProvider>
  );
}
