import { cn } from "@/lib/cn";

/** Loading placeholder. Prefer this over a spinner for content-shaped waits. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("bg-surface-2 rounded-control motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}
