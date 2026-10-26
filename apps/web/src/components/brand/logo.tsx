import Link from "next/link";
import { APP_NAME } from "@/lib/env";
import { cn } from "@/lib/utils";

/** Original mark: a play triangle cut into a rounded frame, suggesting a clip being trimmed. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="8" className="fill-primary" />
      <path d="M12.5 10.2v11.6c0 .8.9 1.3 1.6.9l9.2-5.8c.6-.4.6-1.3 0-1.7l-9.2-5.8c-.7-.5-1.6 0-1.6.8Z" className="fill-primary-foreground" />
      <rect x="7" y="9" width="2.2" height="14" rx="1.1" className="fill-primary-foreground/70" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span>{APP_NAME}</span>
    </Link>
  );
}
