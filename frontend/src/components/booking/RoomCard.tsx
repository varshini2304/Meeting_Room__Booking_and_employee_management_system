import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookingRoomCardProps {
  id?: string;
  name: string;
  type: string;
  capacity: number;
  image: string;
  amenities?: string[];
  booked?: { time: string; people: string; title: string } | null;
  onBook?: (roomId?: string) => void;
  bookingInProgress?: boolean;
}

export function RoomCard({ id, name, type, capacity, image, amenities = [], booked, onBook, bookingInProgress }: BookingRoomCardProps) {
  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border shadow-sm">
      <img src={image} alt={name} className="w-full h-32 object-cover" />
      <div className="p-3">
        <h3 className="font-semibold text-card-foreground">{name}</h3>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <Users className="h-3 w-3" /> {type}
        </p>
        {booked ? (
          <p className="text-xs text-destructive font-medium mt-2">
            Booked<br />{booked.time}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Users className="h-3 w-3" /> {capacity} people
          </p>
        )}
        <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">
          Amenities: {amenities.length ? amenities.join(", ") : "None listed"}
        </p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" /> {booked ? booked.people : "Any"}
          </span>
          <Button
            size="sm"
            className="rounded-full px-5 text-xs"
            disabled={Boolean(booked) || bookingInProgress}
            onClick={() => onBook?.(id)}
          >
            Book
          </Button>
        </div>
      </div>
    </div>
  );
}
