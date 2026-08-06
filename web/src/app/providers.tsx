"use client";

import { App, ConfigProvider, theme as antdTheme } from "antd";
import arEG from "antd/locale/ar_EG";
import enUS from "antd/locale/en_US";

import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider, useTheme } from "@/context/theme-context";

interface Palette {
  brand: string;
  brandHover: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  border: string;
  borderSubtle: string;
  surface: string;
  elevated: string;
  layout: string;
  tableHeader: string;
  rowHover: string;
  tagBg: string;
  activeShadow: string;
  boxShadow: string;
  boxShadowSecondary: string;
}

const LIGHT: Palette = {
  brand: "#4f46e5",
  brandHover: "#4338ca",
  ink: "#14151a",
  inkMuted: "#5a5d68",
  inkFaint: "#9a9ca6",
  border: "#e8e5de",
  borderSubtle: "#f0eee8",
  surface: "#ffffff",
  elevated: "#ffffff",
  layout: "#fafaf7",
  tableHeader: "#f5f4f0",
  rowHover: "#f4f3fb",
  tagBg: "#eef0ff",
  activeShadow: "0 0 0 3px rgba(79,70,229,0.14)",
  boxShadow: "0 1px 2px rgba(20,21,26,0.05), 0 6px 20px rgba(20,21,26,0.06)",
  boxShadowSecondary: "0 6px 24px rgba(20,21,26,0.08), 0 2px 6px rgba(20,21,26,0.05)",
};

const DARK: Palette = {
  brand: "#7e78ff",
  brandHover: "#9a94ff",
  ink: "#ececee",
  inkMuted: "#a2a4ae",
  inkFaint: "#6b6d77",
  border: "#26272e",
  borderSubtle: "#1f2026",
  surface: "#16171b",
  elevated: "#1b1c21",
  layout: "#0e0f12",
  tableHeader: "#1b1c21",
  rowHover: "#202128",
  tagBg: "#24242f",
  activeShadow: "0 0 0 3px rgba(126,120,255,0.22)",
  boxShadow: "0 1px 2px rgba(0,0,0,0.4), 0 6px 20px rgba(0,0,0,0.45)",
  boxShadowSecondary: "0 8px 30px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)",
};

function themeConfig(dark: boolean) {
  const p = dark ? DARK : LIGHT;
  return {
    algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: p.brand,
      colorInfo: p.brand,
      colorLink: p.brand,
      colorLinkHover: p.brandHover,
      colorSuccess: "#16a34a",
      colorWarning: "#f59e0b",
      colorError: "#ef4444",
      colorText: p.ink,
      colorTextSecondary: p.inkMuted,
      colorTextTertiary: p.inkFaint,
      colorBorder: p.border,
      colorBorderSecondary: p.borderSubtle,
      colorBgLayout: p.layout,
      colorBgContainer: p.surface,
      colorBgElevated: p.elevated,
      borderRadius: 12,
      borderRadiusLG: 16,
      borderRadiusSM: 8,
      controlHeight: 40,
      fontSize: 14,
      fontFamily: "var(--font-sans)",
      lineWidth: 1,
      wireframe: false,
      boxShadow: p.boxShadow,
      boxShadowSecondary: p.boxShadowSecondary,
    },
    components: {
      Layout: {
        headerBg: p.surface,
        headerHeight: 64,
        headerPadding: "0 24px",
        bodyBg: p.layout,
      },
      Card: {
        borderRadiusLG: 16,
        paddingLG: 24,
        colorBorderSecondary: p.border,
        headerFontSize: 16,
        headerBg: "transparent",
        boxShadowTertiary: "none",
      },
      Table: {
        headerBg: p.tableHeader,
        headerColor: p.inkMuted,
        headerSplitColor: "transparent",
        borderColor: p.borderSubtle,
        cellPaddingBlock: 14,
        rowHoverBg: p.rowHover,
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
      Input: { controlHeight: 40, activeShadow: p.activeShadow },
      InputNumber: { controlHeight: 40 },
      Select: { controlHeight: 40 },
      DatePicker: { controlHeight: 40 },
      Tag: { borderRadiusSM: 999, defaultBg: p.tagBg, defaultColor: p.inkMuted },
      Tabs: { titleFontSize: 15, horizontalItemGutter: 24, inkBarColor: p.brand },
      Drawer: { paddingLG: 24 },
      Modal: { borderRadiusLG: 16 },
      Alert: { borderRadiusLG: 12 },
      Segmented: { borderRadius: 10, itemSelectedColor: p.brand },
      Menu: { itemBorderRadius: 10, itemHeight: 40 },
    },
  };
}

function AntdProviders({
  direction,
  locale,
  children,
}: {
  direction: "rtl" | "ltr";
  locale: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <ConfigProvider
      direction={direction}
      locale={locale === "ar" ? arEG : enUS}
      theme={themeConfig(theme === "dark")}
    >
      <App>
        <AuthProvider>{children}</AuthProvider>
      </App>
    </ConfigProvider>
  );
}

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
    <ThemeProvider>
      <AntdProviders direction={direction} locale={locale}>
        {children}
      </AntdProviders>
    </ThemeProvider>
  );
}
