import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";

interface Room {
  id?: string;
  name: string;
  type: string;
  capacity: number;
  location: string;
  status: string;
  image: string;
}

interface RoomsTableProps {
  rooms: Room[];
  onEdit?: (id?: string) => void;
  onDelete?: (id?: string) => void;
}

export function RoomsTable({ rooms, onEdit, onDelete }: RoomsTableProps) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Room</th>
            <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Type</th>
            <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Capacity</th>
            <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Location</th>
            <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Status</th>
            <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id || room.name} className="border-b border-border last:border-b-0">
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <img src={room.image} alt={room.name} className="w-10 h-10 rounded-lg object-cover" />
                  <span className="text-sm font-medium text-card-foreground">{room.name}</span>
                </div>
              </td>
              <td className="py-3 px-4 text-sm text-card-foreground">{room.type}</td>
              <td className="py-3 px-4 text-sm text-card-foreground">{room.capacity}</td>
              <td className="py-3 px-4 text-sm text-muted-foreground">{room.location}</td>
              <td className="py-3 px-4">
                <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                  room.status === "Active" ? "bg-green-50 text-success" : "bg-yellow-50 text-yellow-600"
                }`}>
                  {room.status}
                </span>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <button className="p-1 text-muted-foreground hover:text-primary" onClick={() => onEdit?.(room.id)}><Edit className="h-4 w-4" /></button>
                  <button className="p-1 text-muted-foreground hover:text-destructive" onClick={() => onDelete?.(room.id)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
