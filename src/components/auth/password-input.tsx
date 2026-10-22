"use client";

import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/i18n";
import { PASSWORD_MAX, passwordChecks } from "@/lib/auth-rules";
import { cn } from "@/lib/utils";

type Labels = Pick<Dictionary["auth"], "showPassword" | "hidePassword">;

/** Password field with a show/hide toggle. Always LTR, also on Urdu pages. */
export function PasswordInput({
  id,
  name,
  autoComplete,
  labels,
  value,
  onChange,
  describedBy,
}: {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  labels: Labels;
  value?: string;
  onChange?: (value: string) => void;
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    // LTR as a whole, so the toggle sits on the side the text ends on (also on Urdu pages).
    <div className="relative" dir="ltr">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        dir="ltr"
        required
        maxLength={PASSWORD_MAX}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        aria-describedby={describedBy}
        className="pe-11"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? labels.hidePassword : labels.showPassword}
        aria-pressed={visible}
        className="absolute inset-y-0 end-0 grid w-10 place-items-center rounded-sm text-grey hover:text-ivory focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
      </button>
    </div>
  );
}

/** Live checklist of the password rules (src/lib/auth-rules.ts). */
export function PasswordRules({
  id,
  password,
  labels,
}: {
  id: string;
  password: string;
  labels: Pick<Dictionary["auth"], "passwordRules" | "rules" | "ruleMet" | "ruleNotMet">;
}) {
  return (
    <div id={id} className="space-y-1.5 text-xs text-grey">
      <p>{labels.passwordRules}</p>
      <ul className="space-y-1">
        {passwordChecks(password).map(({ rule, ok }) => (
          <li key={rule} className={cn("flex items-center gap-2", ok && "text-gold-soft")}>
            {ok ? <Check aria-hidden className="size-3.5" /> : <Circle aria-hidden className="size-3" />}
            {labels.rules[rule]}
            <span className="sr-only">({ok ? labels.ruleMet : labels.ruleNotMet})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
