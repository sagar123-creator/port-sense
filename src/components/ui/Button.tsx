import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "inverse" | "outline" | "ghost" | "onLight";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-orange text-white shadow-[0_12px_32px_-12px_rgba(228,77,14,0.85)] hover:bg-brand-orange-soft",
  inverse: "bg-white text-surface-1 hover:bg-brand-off-white",
  outline: "border border-hairline-strong bg-white/[0.03] text-ink hover:border-white/30 hover:bg-white/[0.07]",
  ghost: "text-ink-2 hover:bg-white/[0.06] hover:text-ink",
  onLight: "bg-graphite text-white hover:bg-graphite/90",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 px-4 text-small",
  md: "h-11 gap-2 px-5 text-body",
  lg: "h-13 gap-2.5 px-7 text-body sm:text-title-3",
};

const ARROW_SIZES: Record<ButtonSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-4 w-4",
};

interface ButtonProps {
  children: ReactNode;
  href?: string;
  external?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  withArrow?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
  leadingIcon?: ReactNode;
}

function buttonClass({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: Pick<ButtonProps, "variant" | "size" | "fullWidth" | "className">): string {
  return cn(
    "group inline-flex items-center justify-center rounded-full font-semibold tracking-[-0.01em] transition-all duration-300 ease-[var(--ease-out-quint)]",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    fullWidth ? "w-full min-w-0" : "shrink-0",
    className,
  );
}

export function Button({
  children,
  href,
  external = false,
  variant = "primary",
  size = "md",
  withArrow = false,
  fullWidth = false,
  disabled = false,
  type = "button",
  onClick,
  className,
  ariaLabel,
  leadingIcon,
}: ButtonProps) {
  const classes = buttonClass({ variant, size, fullWidth, className });

  const content = (
    <>
      {leadingIcon}
      {children}
      {withArrow && (
        <ArrowUpRight
          className={cn(
            ARROW_SIZES[size],
            "transition-transform duration-300 ease-[var(--ease-out-quint)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
          )}
          aria-hidden="true"
        />
      )}
    </>
  );

  if (href !== undefined) {
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={classes}
          aria-label={ariaLabel}
        >
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} aria-label={ariaLabel}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
      aria-label={ariaLabel}
    >
      {content}
    </button>
  );
}

interface IconLinkProps {
  href: string;
  label: string;
  children: ReactNode;
  className?: string;
}

export function TextLink({ href, label, children, className }: IconLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "group inline-flex items-center gap-2 text-body font-semibold text-brand-orange-soft transition-colors hover:text-brand-orange",
        className,
      )}
    >
      {children}
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-orange/30 transition-all duration-300 ease-[var(--ease-out-quint)] group-hover:border-brand-orange group-hover:bg-brand-orange/15">
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
