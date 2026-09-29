"use client";
import { cn } from "@/lib/utils";
import { SEAT_LABEL, useSeat, type Seat } from "@/lib/seat";

export function SeatSwitch() {
  const [seat, setSeat] = useSeat();
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Viewing as:</span>
      <div className="flex rounded-md border bg-card p-0.5">
        {(["lead", "operator"] as Seat[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeat(s)}
            aria-pressed={seat === s}
            className={cn("rounded px-2 py-1 transition-colors", seat === s ? "bg-dept text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            {SEAT_LABEL[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
