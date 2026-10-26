"use client";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type Step = { label: string; state: "done" | "active" | "pending" | "failed"; detail?: string | null };

export function PipelineSteps({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0">
      {steps.map((s, i) => (
        <li key={s.label} className="flex flex-1 items-start gap-2 sm:flex-col sm:items-center sm:text-center">
          <div className="flex items-center sm:w-full">
            <div className={cn("hidden h-px flex-1 sm:block", i === 0 ? "bg-transparent" : "bg-border")} />
            {s.state === "done" && <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />}
            {s.state === "active" && <Loader2 className="size-5 shrink-0 animate-spin text-primary" />}
            {s.state === "pending" && <Circle className="size-5 shrink-0 text-muted-foreground/50" />}
            {s.state === "failed" && <XCircle className="size-5 shrink-0 text-destructive" />}
            <div className={cn("hidden h-px flex-1 sm:block", i === steps.length - 1 ? "bg-transparent" : "bg-border")} />
          </div>
          <div className="sm:mt-2">
            <p className={cn("text-sm", s.state === "pending" ? "text-muted-foreground" : "font-medium")}>{s.label}</p>
            {s.detail && <p className={cn("text-xs", s.state === "failed" ? "text-destructive" : "text-muted-foreground")}>{s.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
