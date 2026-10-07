import { NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <NotebookPen className="size-4.5" />
      </div>
      <div className="grid leading-tight">
        <span className="font-semibold">Registro de clases</span>
        {subtitle ? <span className="truncate text-xs text-muted-foreground">{subtitle}</span> : null}
      </div>
    </div>
  );
}
