import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Container } from "@/components/ui/Container";
import { BRAND } from "@/lib/brand";
import { PORTS } from "@/lib/data/ports";
import { DATA_PROVENANCE } from "@/lib/data/provenance";

const PRODUCT = [
  { href: "/dashboard", label: "Compare ports" },
  { href: "/25-26", label: "25/26 cargo" },
  { href: "/dwm", label: "DWM analytics" },
  { href: "/services", label: "Services" },
] as const;

const COMPANY = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/dashboard", label: "Start location" },
] as const;

export function Footer() {
  return (
    <footer
      className="relative mt-auto overflow-hidden border-t border-hairline bg-surface-0"
      suppressHydrationWarning
    >
      <Container width="wide">
        <div className="grid items-center gap-6 border-b border-hairline py-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-title-2 font-semibold text-ink">Questions about a lane?</p>
            <p className="mt-2 text-body text-ink-3">
              This is an SIH demo — there is no mailing list. Write to the team from Contact.
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex h-12 items-center justify-center rounded-full bg-brand-orange px-6 text-body font-semibold text-white hover:bg-brand-orange-soft lg:justify-self-end"
          >
            Write to us
          </Link>
        </div>

        <div className="grid gap-12 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1.1fr] lg:gap-10">
          <div className="max-w-sm">
            <Logo size="md" />
            <p className="mt-5 text-body text-ink-3">
              {BRAND.name} helps Indian MSME exporters price port congestion before they book —
              carrier-agnostic, rupee-denominated, and free to use. {DATA_PROVENANCE.short}
            </p>
          </div>

          <div>
            <h3 className="text-label font-semibold uppercase text-ink-4">Product</h3>
            <ul className="mt-5 flex flex-col gap-3">
              {PRODUCT.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-body text-ink-2 transition-colors hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-label font-semibold uppercase text-ink-4">Useful links</h3>
            <ul className="mt-5 flex flex-col gap-3">
              {COMPANY.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-body text-ink-2 transition-colors hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-label font-semibold uppercase text-ink-4">Gates we model</h3>
            <ul className="mt-5 flex flex-wrap gap-2">
              {PORTS.map((port) => (
                <li
                  key={port.id}
                  className="rounded-full border border-hairline px-2.5 py-1 text-small text-ink-3"
                >
                  {port.code}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-small text-ink-4">
              Estimates only — actual charges depend on the carrier invoice and your contract.
              Private ports are not ranked.
            </p>
          </div>
        </div>
      </Container>

      <div
        aria-hidden="true"
        className="pointer-events-none select-none px-5 sm:px-7 lg:px-10"
        style={{ maskImage: "linear-gradient(180deg,rgba(0,0,0,0.5),transparent)" }}
      >
        <span className="block text-center font-display text-[clamp(3rem,15vw,11rem)] font-extrabold leading-[0.78] tracking-[-0.05em] text-white/[0.045]">
          {BRAND.name.toUpperCase()}
        </span>
      </div>

      <Container width="wide">
        <div className="flex flex-col items-center justify-between gap-3 border-t border-hairline py-6 text-small text-ink-4 sm:flex-row">
          <p>
            © 2026 {BRAND.name} · Smart India Hackathon 2026 ·{" "}
            {DATA_PROVENANCE.chip}
          </p>
          <p>Built for Indian MSME exporters</p>
        </div>
      </Container>
    </footer>
  );
}
