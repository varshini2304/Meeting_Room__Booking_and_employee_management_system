import { Users } from "lucide-react";

interface SlotSelectorProps {
  timeSlots: string[];
  bookedSlots?: number[];
  bookingInfo?: { title: string; time: string; people: string };
}

export function SlotSelector({ timeSlots, bookedSlots = [], bookingInfo }: SlotSelectorProps) {
  return (
    <div className="flex-1 overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="flex border-b border-border">
          {timeSlots.map((slot) => (
            <div key={slot} className="flex-1 text-center text-xs text-muted-foreground py-2 border-r border-border last:border-r-0">
              {slot}
            </div>
          ))}
        </div>
        <div className="flex h-24 relative">
          {timeSlots.map((slot, i) => {
            const isBooked = bookedSlots.includes(i);
            return (
              <div
                key={slot}
                className={`flex-1 border-r border-border last:border-r-0 ${
                  isBooked ? "bg-destructive/10" : "bg-accent/50 hover:bg-accent cursor-pointer"
                }`}
              >
                {i === bookedSlots[0] && bookingInfo && (
                  <div className="p-2 text-xs">
                    <p className="font-semibold text-destructive">{bookingInfo.title}</p>
                    <p className="text-muted-foreground flex items-center gap-1 mt-1">
                      <Users className="h-3 w-3" /> {bookingInfo.people}
                    </p>
                    <p className="text-destructive mt-1">Booked {bookingInfo.time}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
