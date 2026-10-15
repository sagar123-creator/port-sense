import type { ReactNode } from "react";
import { CardLabel } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface PanelHeaderProps {
  label: string;
  title: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function PanelHeader({
  label,
  title,
  icon,
  description,
  action,
  className,
}: PanelHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}>
      <div className="flex min-w-0 flex-col gap-2">
        <CardLabel icon={icon}>{label}</CardLabel>
        <h3 className="text-title-3 font-semibold text-ink">{title}</h3>
        {description && <p className="max-w-xl text-small text-ink-4">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
