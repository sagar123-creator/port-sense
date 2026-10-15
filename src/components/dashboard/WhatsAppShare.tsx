"use client";

import { MessageCircle } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { formatINR } from "@/lib/utils";
import type { RiskResult } from "@/types";
import { Button } from "@/components/ui/Button";

export function WhatsAppShare({ result }: { result: RiskResult }) {
  const text = encodeURIComponent(
    `${BRAND.name}: ${result.port.name} demurrage risk is ${result.riskLevel.toUpperCase()} (${result.congestionScore}/100). Est. extra cost ${formatINR(result.estimatedCostINR)}. ${result.recommendation}`,
  );
  const href = `https://wa.me/?text=${text}`;

  return (
    <Button
      href={href}
      external
      variant="outline"
      size="sm"
      ariaLabel={`Share the ${result.port.name} risk summary on WhatsApp`}
      leadingIcon={<MessageCircle className="h-4 w-4 text-risk-low" aria-hidden="true" />}
    >
      Share on WhatsApp
    </Button>
  );
}
