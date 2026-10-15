import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { DwmNav } from "@/components/dwm/DwmNav";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "DWM Analytics",
  description: `Data warehouse, OLAP and data-mining analytics for Indian port statistics — ${BRAND.name}.`,
};

/**
 * Shared chrome for the /dwm section: heading, tab navigation, honesty banner.
 * The banner is rendered server-side on every tab so the real/synthetic
 * distinction is impossible to miss.
 */
export default function DwmLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate overflow-x-hidden bg-surface-1 pt-20 pb-16 sm:pt-28 sm:pb-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(60%_80%_at_20%_0%,rgba(228,77,14,0.14),transparent_70%)]" />
      <Container width="wide" className="relative min-w-0 px-4 sm:px-6">
        <header className="max-w-3xl">
          <p className="text-label font-semibold uppercase tracking-[0.16em] text-brand-orange-soft">
            DWM Analytics
          </p>
          <h1 className="mt-3 font-display text-title-1 font-semibold tracking-[-0.04em] text-ink sm:text-display-2">
            Port statistics, warehoused and mined.
          </h1>
          <p className="mt-3 text-small text-ink-2 sm:text-body">
            Star-schema warehouse over the published datasets this repository ships — ETL with
            rejection reporting, the five OLAP operations over real queries, and data mining that
            states its limits.{" "}
            <strong className="font-semibold text-ink">Real</strong> rows are published statistics;
            <strong className="font-semibold text-ink"> synthetic</strong> rows are labelled demo
            material and never mix into a real result.
          </p>
        </header>

        <div className="mt-6">
          <DwmNav />
        </div>

        <div className="mt-6 min-w-0">{children}</div>
      </Container>
    </div>
  );
}
