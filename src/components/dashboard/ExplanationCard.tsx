"use client";

import { MessageSquareText } from "lucide-react";
import { Card, CardLabel } from "@/components/ui/Card";

export interface ExplanationView {
  title: string;
  summary: string;
  bullets: Array<{
    label: string;
    text: string;
    factId?: string;
    citation?: string;
  }>;
  honestyNote: string;
  engine: string;
}

export function ExplanationCard({ explanation }: { explanation: ExplanationView | null }) {
  if (!explanation) return null;

  return (
    <Card tone="outline" padding="md">
      <CardLabel icon={<MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />}>
        Layer 5 · Why these numbers
      </CardLabel>
      <h3 className="mt-3 font-semibold text-title-3 text-ink">{explanation.title}</h3>
      <p className="mt-2 text-body text-ink-2">{explanation.summary}</p>
      <ol className="mt-4 space-y-3">
        {explanation.bullets.map((b) => (
          <li key={b.label} className="border-b border-hairline pb-3 last:border-b-0 last:pb-0">
            <p className="text-label font-semibold uppercase text-ink-4">{b.label}</p>
            <p className="mt-1 text-small text-ink-2">{b.text}</p>
            {b.citation ? (
              <p className="mt-1 text-label text-ink-4">source: {b.citation}</p>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-small text-ink-4">{explanation.honestyNote}</p>
    </Card>
  );
}
