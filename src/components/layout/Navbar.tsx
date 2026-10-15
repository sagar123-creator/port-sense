"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/25-26", label: "25/26" },
  { href: "/dwm", label: "Analytics" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

/** Section roots that stay active across their sub-routes (e.g. /dwm/olap). */
const isActive = (pathname: string, href: string): boolean =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-[var(--ease-out-quint)]",
        scrolled || open
          ? "border-b border-hairline bg-surface-1/85 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <Container width="wide">
        <div className="flex h-16 items-center justify-between gap-4 sm:h-20">
          <Logo size="md" />

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-1 rounded-full border border-hairline bg-white/[0.04] p-1 backdrop-blur-md">
              {LINKS.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-full px-4 py-2 text-small font-medium transition-all duration-300 ease-[var(--ease-out-quint)]",
                        active
                          ? "bg-white/10 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                          : "text-ink-3 hover:text-ink",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="group inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-orange pl-3.5 pr-1.5 text-label font-semibold text-white transition-colors duration-300 hover:bg-brand-orange-soft sm:h-11 sm:gap-2 sm:pl-5 sm:pr-2 sm:text-small"
            >
              <span className="sm:hidden">Compare</span>
              <span className="hidden sm:inline">Compare ports</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 ease-[var(--ease-out-quint)] group-hover:rotate-45">
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-white/[0.04] text-ink transition-colors hover:bg-white/[0.08] lg:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </Container>

      <div
        id="mobile-nav"
        hidden={!open}
        className="border-t border-hairline bg-surface-1/95 backdrop-blur-xl lg:hidden"
      >
        <Container width="wide">
          <nav aria-label="Mobile" className="py-6">
            <ul className="flex flex-col">
              {LINKS.map((link, index) => {
                const active = isActive(pathname, link.href);
                return (
                  <li key={link.href} className="border-b border-hairline last:border-0">
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between py-4 font-display text-title-2 font-medium transition-colors",
                        active ? "text-brand-orange-soft" : "text-ink-2 hover:text-ink",
                      )}
                    >
                      {link.label}
                      <span className="text-label font-semibold uppercase text-ink-4 tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-orange text-body font-semibold text-white"
            >
              Compare ports
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </nav>
        </Container>
      </div>
    </header>
  );
}
