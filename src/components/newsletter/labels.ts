import type { Dictionary } from "@/i18n";

import type { NewsletterLabels } from "./signup-box";

/** Picks the strings the box needs from the dictionary (keeps the client bundle small). */
export function newsletterLabels(dict: Dictionary): NewsletterLabels {
  const n = dict.newsletter;
  return {
    title: n.title,
    description: n.description,
    shortDescription: n.shortDescription,
    emailLabel: n.emailLabel,
    emailPlaceholder: n.emailPlaceholder,
    languageLabel: n.languageLabel,
    languages: n.languages,
    submit: n.submit,
    submitting: n.submitting,
    success: n.success,
    privacy: n.privacy,
    honeypot: n.honeypot,
    errors: n.errors,
  };
}
