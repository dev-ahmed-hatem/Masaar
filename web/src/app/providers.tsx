"use client";

import { App, ConfigProvider, theme as antdTheme } from "antd";
import arEG from "antd/locale/ar_EG";
import enUS from "antd/locale/en_US";
import { DirectionProvider } from "@radix-ui/react-direction";

import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider, useTheme } from "@/context/theme-context";
import { light, dark, radius, type Palette } from "@/design/tokens";

/**
 * Ant Design theme, derived from the SAME token module that generates the CSS
 * custom properties (see src/design/tokens.ts + scripts/build-tokens.mjs).
 *
 * This file used to carry its own hand-copied LIGHT/DARK hex objects, which
 * meant every palette change had to be made twice and drifted silently when it
 * wasn't. Nothing here may hardcode a colour.
 *
 * antd now only dresses /admin — student, teacher and marketing surfaces run on
 * the Tailwind + Radix primitives in src/components/ui.
 */
function themeConfig(isDark: boolean) {
  const p: Palette = isDark ? dark : light;
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: p.brand,
      colorInfo: p.brand,
      colorLink: p.brand,
      colorLinkHover: p.brandLight,
      colorSuccess: p.success,
      colorWarning: p.warning,
      colorError: p.error,
      colorText: p.ink,
      colorTextSecondary: p.inkMuted,
      colorTextTertiary: p.inkFaint,
      // antd's default placeholder is rgba(0,0,0,.25) / rgba(255,255,255,.25),
      // which fails AA on every surface. Pin it to the faint token, which is
      // contrast-verified at body size.
      colorTextPlaceholder: p.inkFaint,
      colorBorder: p.borderStrong,
      colorBorderSecondary: p.borderSubtle,
      colorBgLayout: p.bg,
      colorBgContainer: p.surface,
      colorBgElevated: p.surface,
      borderRadius: radius.control,
      borderRadiusLG: radius.card,
      borderRadiusSM: 8,
      controlHeight: 40,
      fontSize: 14,
      fontFamily: "var(--font-sans)",
      lineWidth: 1,
      wireframe: false,
      boxShadow: p.shadowSm,
      boxShadowSecondary: p.shadowMd,
    },
    components: {
      Layout: {
        headerBg: p.surface,
        headerHeight: 64,
        headerPadding: "0 24px",
        bodyBg: p.bg,
      },
      Card: {
        borderRadiusLG: radius.card,
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
        primaryColor: p.onBrand,
      },
      Input: { controlHeight: 40, activeShadow: p.focusRing },
      InputNumber: { controlHeight: 40 },
      Select: { controlHeight: 40 },
      DatePicker: { controlHeight: 40 },
      Tag: {
        borderRadiusSM: radius.pill,
        defaultBg: p.brandTint,
        defaultColor: p.onBrandTint,
      },
      Tabs: {
        titleFontSize: 15,
        horizontalItemGutter: 24,
        inkBarColor: p.brand,
      },
      Drawer: { paddingLG: 24 },
      Modal: { borderRadiusLG: radius.card },
      Alert: { borderRadiusLG: radius.control },
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
    /* Radix primitives read direction from this context, not from the DOM.
       Without it, popovers/selects/tabs mis-align on /ar. */
    <DirectionProvider dir={direction}>
      <ThemeProvider>
        <AntdProviders direction={direction} locale={locale}>
          {children}
        </AntdProviders>
      </ThemeProvider>
    </DirectionProvider>
  );
}
