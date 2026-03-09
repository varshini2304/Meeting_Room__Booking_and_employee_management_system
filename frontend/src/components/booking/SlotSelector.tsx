interface SlotSelectorProps {
  timeSlots: string[];
  bookedSlots?: string[];
  selectedTime?: string;
  onSelectTime?: (time: string) => void;
  slotSummary?: Record<string, { count: number; rooms: string[] }>;
}

export function SlotSelector({ timeSlots, bookedSlots = [], selectedTime, onSelectTime, slotSummary = {} }: SlotSelectorProps) {
  const bookedSet = new Set(bookedSlots);
  return (
    <div className="w-full overflow-x-auto">
      <div className="grid grid-flow-col auto-cols-[110px] gap-2 pb-1 min-w-max">
        {timeSlots.map((slot) => {
          const isBooked = bookedSet.has(slot);
          const isSelected = selectedTime === slot;
          const summary = slotSummary[slot];
          return (
            <button
              key={slot}
              type="button"
              className={`h-20 rounded-lg border text-center transition-colors px-2 ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : isBooked
                    ? "border-destructive/30 bg-destructive/10 hover:bg-destructive/15"
                    : "border-border bg-accent/40 hover:bg-accent/60"
              }`}
              onClick={() => onSelectTime?.(slot)}
            >
              <div className="flex h-full flex-col items-center justify-center gap-1">
                <p className="text-xs font-medium text-card-foreground">{slot}</p>
                {isBooked ? (
                  <p className="text-[11px] font-semibold text-destructive">
                    Booked{summary?.count ? ` (${summary.count})` : ""}
                  </p>
                ) : (
                  <p className={`text-[11px] ${isSelected ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                    {isSelected ? "Selected" : "Available"}
                  </p>
                )}
                {isBooked ? (
                  <p className="text-[10px] text-muted-foreground truncate w-full">
                    {(summary?.rooms || []).join(", ") || "Occupied"}
                  </p>
                ) : (
                  <p className="text-[10px] text-transparent w-full">-</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-accent border border-border" /> Available
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-destructive/50 border border-destructive/40" /> Booked
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-primary/70 border border-primary" /> Selected
        </span>
      </div>
    </div>
  );
}
