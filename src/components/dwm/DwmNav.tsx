"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dwm", label: "Overview" },
  { href: "/dwm/history", label: "History" },
  { href: "/dwm/olap", label: "OLAP Explorer" },
  { href: "/dwm/etl", label: "Data & ETL" },
  { href: "/dwm/mining", label: "Data Mining" },
] as const;

/** Section tab bar shared by every /dwm route (mirrors Navbar link styling). */
export function DwmNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="DWM sections"
      className="flex min-w-0 gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-small font-semibold transition-colors duration-200",
              active
                ? "border-brand-orange/50 bg-brand-orange/15 text-brand-orange-soft"
                : "border-hairline bg-surface-2/60 text-ink-3 hover:border-white/20 hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
