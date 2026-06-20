import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageSpinner({
  label,
  fullScreen = false,
  className,
}: {
  label?: string;
  fullScreen?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-text-secondary",
        fullScreen ? "min-h-screen" : "min-h-[55vh]",
        className
      )}
    >
      <Loader2 size={26} className="animate-spin text-accent" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
