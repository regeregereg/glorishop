import { BookingStatus, STATUS_LABELS } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<BookingStatus, { dot: string; text: string; bg: string }> = {
  PENDING: { dot: "bg-status-pending", text: "text-status-pending", bg: "bg-white/5" },
  CONFIRMED: { dot: "bg-status-confirmed", text: "text-status-confirmed", bg: "bg-status-confirmed/10" },
  IN_PROGRESS: { dot: "bg-status-progress", text: "text-status-progress", bg: "bg-status-progress/10" },
  DONE: { dot: "bg-status-done", text: "text-status-done", bg: "bg-status-done/10" },
  CANCELLED_USER: { dot: "bg-status-cancelled", text: "text-status-cancelled", bg: "bg-status-cancelled/10" },
  CANCELLED_ADMIN: { dot: "bg-status-cancelled", text: "text-status-cancelled", bg: "bg-status-cancelled/10" },
  NO_SHOW: { dot: "bg-status-cancelled", text: "text-status-cancelled", bg: "bg-status-cancelled/10" },
};

export function StatusBadge({
  status,
  size = "md",
}: {
  status: BookingStatus;
  size?: "sm" | "md";
}) {
  const style = STATUS_STYLES[status];
  const isLive = status === "IN_PROGRESS";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        style.bg,
        style.text,
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          style.dot,
          isLive && "status-dot-pulse"
        )}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
