import {
  CalendarCheck,
  CreditCard,
  DollarSign,
  FileCheck,
  Layers,
  Star,
  Tags,
  UserCheck,
  Users,
} from "lucide-react";

import type { Dictionary } from "@/i18n/dictionaries";

export interface AdminSection {
  label: string;
  /** One line on what the section is for; shown on the hub cards only. */
  desc: string;
  href: string;
  icon: React.ReactNode;
}

/**
 * The moderator sections, in one place: the sidebar and the hub cards are two
 * renderings of this list, so a new queue is added once.
 */
export function adminSections(d: Dictionary, locale: string): AdminSection[] {
  const p = (seg: string) => `/${locale}/admin/${seg}`;
  return [
    {
      label: d.admin.teacherBrowser,
      desc: d.adminTeachers.intro,
      href: p("teachers"),
      icon: <Users aria-hidden />,
    },
    {
      label: d.admin.teachers,
      desc: d.adminApplications.intro,
      href: p("applications"),
      icon: <UserCheck aria-hidden />,
    },
    {
      label: d.bookings.adminTitle,
      desc: d.bookings.adminIntro,
      href: p("bookings"),
      icon: <CalendarCheck aria-hidden />,
    },
    {
      label: d.admin.receipts,
      desc: d.adminReceipts.intro,
      href: p("receipts"),
      icon: <FileCheck aria-hidden />,
    },
    {
      label: d.admin.paymentAccounts,
      desc: d.adminPaymentAccounts.intro,
      href: p("payment-accounts"),
      icon: <CreditCard aria-hidden />,
    },
    {
      label: d.adminReviews.title,
      desc: d.adminReviews.intro,
      href: p("reviews"),
      icon: <Star aria-hidden />,
    },
    {
      label: d.admin.payouts,
      desc: d.adminPayouts.intro,
      href: p("payouts"),
      icon: <DollarSign aria-hidden />,
    },
    {
      label: d.admin.pricing,
      desc: d.adminPricing.intro,
      href: p("pricing"),
      icon: <Tags aria-hidden />,
    },
    {
      label: d.adminCatalog.title,
      desc: d.adminCatalog.intro,
      href: p("catalog"),
      icon: <Layers aria-hidden />,
    },
  ];
}
