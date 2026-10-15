import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { PageStage } from "@/components/layout/PageStage";
import { ContactForm } from "@/components/contact/ContactForm";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: "Contact",
  description: `Questions about ${BRAND.name}, a port we should model, or a partnership.`,
};

const DETAILS = [
  {
    icon: Mail,
    title: "Mail us",
    value: "contact@portsense.demo",
    hint: "Placeholder for the SIH demo.",
  },
  {
    icon: MapPin,
    title: "Our focus",
    value: "Indian export gates",
    hint: "JNPT, Chennai, Cochin, Vizag, Kolkata.",
  },
  {
    icon: Phone,
    title: "Talk to the team",
    value: "SIH 2026 evaluation",
    hint: "Use the form — this is not a live helpdesk.",
  },
  {
    icon: Clock,
    title: "Working days",
    value: "Mon–Sat · 2 working days",
    hint: "Faster during evaluation week.",
  },
] as const;

export default function ContactPage() {
  return (
    <PageStage
      index="01"
      eyebrow="Contact"
      title="Contact us"
      subtitle={`A port, a carrier, a start city, a partnership — this reaches the ${BRAND.name} team.`}
      image="/images/hero/night-port.jpg"
      alt="Night operations at a container terminal"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {DETAILS.map(({ icon: Icon, title, value, hint }) => (
          <article
            key={title}
            className="flex min-h-[11rem] flex-col rounded-card border border-hairline bg-surface-2/80 p-5"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-orange/15 text-brand-orange-soft">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-title-3 font-semibold text-ink">{title}</h2>
            <p className="mt-1 text-body text-ink-2">{value}</p>
            <p className="mt-auto pt-3 text-small text-ink-4">{hint}</p>
          </article>
        ))}
      </div>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-label font-semibold uppercase tracking-[0.14em] text-brand-orange-soft">
            Contact us
          </p>
          <h2 className="mt-3 text-title-1 font-semibold tracking-[-0.03em] text-ink">
            Write us what you want to know
          </h2>
          <p className="mt-4 max-w-md text-body text-ink-3">
            Tell us the start city and the destination. We rank gates on demurrage and sketch the
            inland haul (road/rail rupees pending sourced rates). This form stores nothing in the
            SIH demo.
          </p>
        </div>
        <div className="rounded-card border border-hairline bg-surface-2/80 p-6 sm:p-8">
          <h3 className="text-title-3 font-semibold text-ink">Send a message</h3>
          <div className="mt-5">
            <ContactForm />
          </div>
        </div>
      </div>
    </PageStage>
  );
}
