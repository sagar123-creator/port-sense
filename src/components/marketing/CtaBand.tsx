import { Photo } from "@/components/ui/Photo";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";

interface CtaBandProps {
  eyebrow?: string;
  title: string;
  description: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export function CtaBand({
  eyebrow = "Two minutes, no signup",
  title,
  description,
  primaryLabel = "Open the dashboard",
  primaryHref = "/dashboard",
  secondaryLabel,
  secondaryHref,
}: CtaBandProps) {
  return (
    <section className="relative isolate overflow-hidden border-t border-hairline bg-surface-0">
      <Photo
        src="/images/sections/worker.jpg"
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        grade="night"
        className="opacity-45"
      />
      <div className="absolute inset-0 bg-[radial-gradient(90%_80%_at_50%_50%,rgba(10,22,40,0.6)_0%,rgba(5,11,20,0.94)_70%)]" />
      <div className="grid-lines absolute inset-0 opacity-70" aria-hidden="true" />

      <Container width="prose">
        <div className="relative flex flex-col items-center py-[clamp(5rem,10vw,9rem)] text-center">
          <Eyebrow tone="glass">{eyebrow}</Eyebrow>
          <h2 className="mt-7 font-semibold text-display-2 text-ink">{title}</h2>
          <p className="mt-5 max-w-xl text-lead text-ink-2">{description}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button href={primaryHref} variant="primary" size="lg" withArrow>
              {primaryLabel}
            </Button>
            {secondaryLabel && secondaryHref && (
              <Button href={secondaryHref} variant="outline" size="lg">
                {secondaryLabel}
              </Button>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
