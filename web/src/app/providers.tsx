"use client";

import { App, ConfigProvider, theme as antdTheme } from "antd";
import arEG from "antd/locale/ar_EG";
import enUS from "antd/locale/en_US";

import { AuthProvider } from "@/context/auth-context";

const BRAND = "#6d5efc";
const BRAND_HOVER = "#5646e0";
const INK = "#0f1729";
const INK_MUTED = "#5b6478";
const INK_FAINT = "#9aa2b4";
const BORDER = "#ececf6";
const BORDER_SUBTLE = "#f1f1f9";
const SURFACE = "#ffffff";
const LAYOUT = "#f6f7fc";
const TABLE_HEADER = "#f5f4ff";

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
          colorLinkHover: BRAND_HOVER,
          colorSuccess: "#16a34a",
          colorWarning: "#f59e0b",
          colorError: "#ef4444",
          colorText: INK,
          colorTextSecondary: INK_MUTED,
          colorTextTertiary: INK_FAINT,
          colorBorder: BORDER,
          colorBorderSecondary: BORDER_SUBTLE,
          colorBgLayout: LAYOUT,
          colorBgContainer: SURFACE,
          colorBgElevated: SURFACE,
          borderRadius: 12,
          borderRadiusLG: 18,
          borderRadiusSM: 8,
          controlHeight: 40,
          fontSize: 14,
          fontFamily: "var(--font-sans)",
          lineWidth: 1,
          wireframe: false,
          boxShadow:
            "0 1px 2px rgba(15,23,41,0.04), 0 6px 20px rgba(15,23,41,0.05)",
          boxShadowSecondary:
            "0 8px 30px rgba(109,94,252,0.14), 0 2px 8px rgba(15,23,41,0.06)",
        },
        components: {
          Layout: {
            headerBg: SURFACE,
            headerHeight: 64,
            headerPadding: "0 24px",
            bodyBg: LAYOUT,
          },
          Card: {
            borderRadiusLG: 20,
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
            rowHoverBg: "#f6f5ff",
            headerBorderRadius: 0,
            fontWeightStrong: 600,
          },
          Button: {
            controlHeight: 40,
            fontWeight: 600,
            primaryShadow: "none",
            defaultShadow: "none",
            dangerShadow: "none",
          },
          Input: { controlHeight: 40, activeShadow: "0 0 0 3px rgba(109,94,252,0.14)" },
          InputNumber: { controlHeight: 40 },
          Select: { controlHeight: 40 },
          DatePicker: { controlHeight: 40 },
          Tag: { borderRadiusSM: 999, defaultBg: "#f2f1fb", defaultColor: INK_MUTED },
          Tabs: { titleFontSize: 15, horizontalItemGutter: 24, inkBarColor: BRAND },
          Drawer: { paddingLG: 24 },
          Modal: { borderRadiusLG: 20 },
          Alert: { borderRadiusLG: 14 },
          Segmented: { borderRadius: 10, itemSelectedColor: BRAND },
          Menu: { itemBorderRadius: 10, itemHeight: 40 },
        },
      }}
    >
      <App>
        <AuthProvider>{children}</AuthProvider>
      </App>
    </ConfigProvider>
  );
}
