import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export type LogoTone = "light" | "dark";
export type LogoSize = "sm" | "md" | "lg" | "hero";

const MARK_SIZES: Record<LogoSize, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-11 w-11",
  hero: "h-[3.75rem] w-[3.75rem] sm:h-[4.5rem] sm:w-[4.5rem]",
};

const NAME_SIZES: Record<LogoSize, string> = {
  sm: "text-body",
  md: "text-title-3 sm:text-[1.125rem]",
  lg: "text-title-2",
  hero: "text-title-1",
};

const RADIUS: Record<LogoSize, string> = {
  sm: "rounded-[0.7rem]",
  md: "rounded-[0.75rem]",
  lg: "rounded-[0.85rem]",
  hero: "rounded-[1.15rem]",
};

/** Uploaded P-with-ship mark. */
export function LogoMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: LogoSize;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/port-sense-mark.png"
      alt=""
      width={72}
      height={72}
      className={cn(
        "shrink-0 bg-surface-1 object-contain",
        RADIUS[size],
        MARK_SIZES[size],
        className,
      )}
      aria-hidden="true"
    />
  );
}

interface LogoProps {
  className?: string;
  showTagline?: boolean;
  tone?: LogoTone;
  size?: LogoSize;
  asLink?: boolean;
}

export function Logo({
  className,
  showTagline = false,
  tone = "light",
  size = "md",
  asLink = true,
}: LogoProps) {
  const content = (
    <>
      <LogoMark size={size} />
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "font-display font-semibold tracking-[-0.03em] whitespace-nowrap",
            NAME_SIZES[size],
            tone === "light" ? "text-ink" : "text-graphite",
          )}
        >
          {BRAND.name}
        </span>
        {showTagline && (
          <span
            className={cn(
              "text-small leading-snug",
              tone === "light" ? "text-ink-3" : "text-graphite-3",
            )}
          >
            {BRAND.tagline}
          </span>
        )}
      </span>
    </>
  );

  const classes = cn("group inline-flex items-center gap-2.5", className);

  if (!asLink) {
    return <span className={classes}>{content}</span>;
  }

  return (
    <Link href="/" className={classes} aria-label={`${BRAND.name} home`}>
      {content}
    </Link>
  );
}
