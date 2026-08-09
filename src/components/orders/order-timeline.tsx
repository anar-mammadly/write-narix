import { cn } from "@/lib/utils";

type TimelineItem = { status: string; color: string; note: string | null; created_at: string };

export function OrderTimeline({
  items,
  className,
  emptyLabel = "No status history yet.",
}: {
  items: TimelineItem[];
  className?: string;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{emptyLabel}</p>;
  }

  return (
    <ol className={cn("relative border-l border-border pl-5", className)}>
      {items.map((item, i) => (
        <li key={i} className="mb-6 last:mb-0">
          <span
            className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full ring-2 ring-background"
            style={{ backgroundColor: item.color }}
          />
          <p className="text-sm font-medium text-foreground">{item.status}</p>
          {item.note && <p className="text-sm text-muted-foreground">{item.note}</p>}
          <time className="text-xs text-muted-foreground">
            {new Date(item.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </li>
      ))}
    </ol>
  );
}
