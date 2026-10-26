import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    variant: {
      default: "border-transparent bg-primary/15 text-primary",
      secondary: "border-transparent bg-secondary text-secondary-foreground",
      outline: "border-border text-muted-foreground",
      success: "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      warning: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
      destructive: "border-transparent bg-destructive/15 text-destructive",
      demo: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold tracking-wide",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
