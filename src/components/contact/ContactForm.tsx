"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { BRAND } from "@/lib/brand";

export function ContactForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-risk-low/15 text-risk-low">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-title-2 font-semibold text-ink">Message recorded</h2>
          <p className="mt-3 max-w-md text-body text-ink-2">
            This demo form stores nothing. In production it would reach the {BRAND.name} team.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSent(false)}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        setSent(true);
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="contact-name">
          <TextInput id="contact-name" name="name" required autoComplete="name" placeholder="Your full name" />
        </Field>
        <Field label="Email" htmlFor="contact-email">
          <TextInput
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.in"
          />
        </Field>
        <Field label="Phone" htmlFor="contact-phone" hint="Optional">
          <TextInput
            id="contact-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+91"
          />
        </Field>
        <Field label="Subject" htmlFor="contact-subject" hint="Optional">
          <TextInput
            id="contact-subject"
            name="subject"
            placeholder="Start city, destination, or partnership"
          />
        </Field>
      </div>
      <Field label="Organisation" htmlFor="contact-org" hint="Optional">
        <TextInput
          id="contact-org"
          name="organisation"
          autoComplete="organization"
          placeholder="Company or trade body"
        />
      </Field>
      <Field label="Message" htmlFor="contact-message">
        <TextArea
          id="contact-message"
          name="message"
          required
          rows={4}
          placeholder="Which port, carrier or lane should we look at?"
        />
      </Field>
      <Button type="submit" variant="primary" size="md" withArrow fullWidth>
        Send message
      </Button>
    </form>
  );
}
