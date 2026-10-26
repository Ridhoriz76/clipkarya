"use client";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/misc";
import type { AuthState } from "@/app/(auth)/actions";

type Field = { name: string; label: string; type?: string; autoComplete?: string; placeholder?: string };

export function AuthForm({
  action,
  fields,
  submitLabel,
  hidden,
}: {
  action: (state: AuthState, form: FormData) => Promise<AuthState>;
  fields: Field[];
  submitLabel: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-4">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {fields.map((f) => (
        <div key={f.name} className="space-y-1.5">
          <Label htmlFor={f.name}>{f.label}</Label>
          <Input id={f.name} name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} placeholder={f.placeholder} required />
        </div>
      ))}
      {state?.error && <Notice variant="error">{state.error}</Notice>}
      {state?.message && <Notice variant="info">{state.message}</Notice>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} {submitLabel}
      </Button>
    </form>
  );
}
