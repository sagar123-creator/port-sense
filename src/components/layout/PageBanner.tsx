import { Photo } from "@/components/ui/Photo";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { cn } from "@/lib/utils";

export interface BannerStat {
  value: string;
  label: string;
}

interface PageBannerProps {
  title: string;
  image: string;
  alt: string;
  subtitle?: string;
  eyebrow?: string;
  stats?: readonly BannerStat[];
  actions?: ReactNode;
  className?: string;
}

export function PageBanner({
  title,
  image,
  alt,
  subtitle,
  eyebrow,
  stats,
  actions,
  className,
}: PageBannerProps) {
  return (
    <section
      className={cn("relative isolate overflow-hidden border-b border-hairline bg-surface-1", className)}
    >
      <div className="orange-slab absolute left-0 top-0 z-10 hidden h-full w-1.5 sm:block" aria-hidden="true" />
      <Photo
        src={image}
        alt={alt}
        fill
        priority
        sizes="100vw"
        grade="warm"
        className="opacity-70"
      />
      <div className="absolute inset-0 bg-[linear-gradient(100deg,var(--surface-0)_8%,rgba(10,22,40,0.88)_48%,rgba(10,22,40,0.42)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,11,20,0.85)_0%,transparent_35%,var(--surface-1)_100%)]" />
      <div className="grid-lines absolute inset-0 opacity-60" aria-hidden="true" />

      <Container width="wide">
        <div className="relative pb-14 pt-32 sm:pb-20 sm:pt-40">
          <div className="max-w-3xl">
            {eyebrow && <Eyebrow tone="glass">{eyebrow}</Eyebrow>}
            <h1
              className={cn(
                "font-semibold text-display-2 text-ink",
                eyebrow ? "mt-6" : undefined,
              )}
            >
              {title}
            </h1>
            {subtitle && <p className="mt-5 max-w-2xl text-lead text-ink-2">{subtitle}</p>}
            {actions && <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>}
          </div>

          {stats && stats.length > 0 && (
            <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-hairline pt-8 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col gap-1.5">
                  <dt className="order-2 text-small text-ink-3">{stat.label}</dt>
                  <dd className="order-1 font-display text-title-2 font-semibold tabular-nums text-ink">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </Container>
    </section>
  );
}
