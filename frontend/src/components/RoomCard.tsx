import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RoomCardProps {
  name: string;
  type: string;
  capacity: number;
  image: string;
}

export function RoomCard({ name, type, capacity, image }: RoomCardProps) {
  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border shadow-sm">
      <img src={image} alt={name} className="w-full h-40 object-cover" />
      <div className="p-4">
        <h3 className="font-semibold text-card-foreground">{name}</h3>
        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
          <Users className="h-3.5 w-3.5" /> {type}
        </p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-sm text-muted-foreground border border-border rounded-full px-3 py-1 flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {capacity} people
          </span>
          <Button size="sm" className="rounded-full px-6">
            Book
          </Button>
        </div>
      </div>
    </div>
  );
}
