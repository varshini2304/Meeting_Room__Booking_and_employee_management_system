import { StatCard } from "@/components/StatCard";
import { CalendarCheck, XCircle, CheckCircle, ChevronDown, MapPin, Calendar, Wifi, Monitor, Projector } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { useAllBookings } from "@/hooks/queries/useBookings";
import { useRoomAvailability } from "@/hooks/queries/useRooms";
import type { Room } from "@/api/types";
import roomA from "@/assets/room-a.jpg";
import roomB from "@/assets/room-b.jpg";
import conferenceRoom from "@/assets/conference-room.jpg";
import boardroom from "@/assets/boardroom.jpg";

type RoomStatus = "Available" | "Booked" | "Under Maintenance";

const getRoomImage = (room: Room) => {
  if (room.imageUrl) return room.imageUrl;
  if (room.roomNumber?.toLowerCase().includes("a")) return roomA;
  if (room.roomNumber?.toLowerCase().includes("b")) return roomB;
  if (room.roomType?.toLowerCase().includes("conference")) return conferenceRoom;
  if (room.roomType?.toLowerCase().includes("board")) return boardroom;
  return roomA;
};

const statusBadgeStyles: Record<RoomStatus, string> = {
  Available: "bg-green-50 text-success",
  Booked: "bg-destructive/10 text-destructive",
  "Under Maintenance": "bg-yellow-50 text-yellow-600",
};

const heatmapHours = ["9am", "10am", "11am", "12am", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm", "7pm"];
const heatmapDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const RoomAvailability = () => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [filters, setFilters] = useState({
    branch: "all",
    status: "all",
  });

  const { data: allBookings = [] } = useAllBookings();
  const { data: availability } = useRoomAvailability({ date, startTime: time }, true);
  const rooms = availability?.rooms ?? [];
  const availabilityMessage = availability?.message ?? null;

  const totalToday = allBookings.filter((b) => b.date === date).length;
  const cancelled = allBookings.filter((b) => b.status === "cancelled").length;
  const active = allBookings.filter((b) => b.status === "booked").length;

  const options = useMemo(() => {
    const branches = Array.from(new Set(rooms.map((r) => r.branch).filter(Boolean)));
    return { branches };
  }, [rooms]);

  const uiRooms = useMemo(
    () => rooms
      .map((room) => ({
        name: room.roomNumber,
        type: room.roomType,
        image: getRoomImage(room),
        branch: room.branch,
        location: `${room.branch} - ${room.block} - ${room.floor}`,
        status: room.isActive ? (room.isAvailable === false ? "Booked" : "Available") : "Under Maintenance",
        date: date,
      }))
      .filter((r) => {
        if (filters.branch !== "all" && r.branch !== filters.branch) return false;
        if (filters.status !== "all" && r.status !== filters.status) return false;
        return true;
      }),
    [rooms, date, filters],
  );

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">Room Availability</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon={CalendarCheck} iconBg="bg-accent" iconColor="text-primary" label="Total Bookings Today" value={totalToday} />
        <StatCard icon={XCircle} iconBg="bg-destructive/10" iconColor="text-destructive" label="Cancelled Bookings" value={cancelled} />
        <StatCard icon={CheckCircle} iconBg="bg-green-50" iconColor="text-success" label="Active Meetings" value={active} />
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto bg-card" />
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-auto bg-card" />
        </div>

        <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-card">
          <select
            className="bg-transparent outline-none appearance-none"
            value={filters.branch}
            onChange={(e) => setFilters((prev) => ({ ...prev, branch: e.target.value }))}
          >
            <option value="all">All Branches</option>
            {options.branches.map((br) => <option key={br} value={br}>{br}</option>)}
          </select>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-card">
          <select
            className="bg-transparent outline-none appearance-none"
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="all">All Statuses</option>
            <option value="Available">Available</option>
            <option value="Booked">Booked</option>
          </select>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="ml-auto">
          <Button
            variant="outline"
            className="rounded-full px-8"
            onClick={() => {
              setFilters({ branch: "all", status: "all" });
              setDate(new Date().toISOString().slice(0, 10));
              setTime("10:00");
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {availabilityMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {availabilityMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {uiRooms.map((room) => (
          <div key={room.name} className="bg-card rounded-xl border border-border p-4 flex gap-4">
            <img src={room.image} alt={room.name} className="w-32 h-24 rounded-lg object-cover" />
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-card-foreground">{room.name}</h3>
                  <p className="text-xs text-muted-foreground">{room.type}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadgeStyles[room.status]}`}>{room.status}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                <Wifi className="h-3 w-3" /><Monitor className="h-3 w-3" /><Projector className="h-3 w-3" />
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {room.location}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" /> {room.date}
                </div>
                <Button size="sm" variant={room.status === "Available" ? "default" : "outline"} className="text-xs h-7">
                  {room.status === "Available" ? "Book Now" : "Booked"}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-semibold text-card-foreground mb-4">Availability Heatmap</h2>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {heatmapDays.map((day) => (
              <div key={day} className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground w-20">{day}</span>
                <div className="flex gap-0.5 flex-1">
                  {heatmapHours.map((_, i) => {
                    const intensity = Math.random();
                    return (
                      <div key={i} className="flex-1 h-6 rounded-sm" style={{ backgroundColor: `hsl(211 100% ${100 - intensity * 50}%)` }} />
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-1">
              <span className="w-20" />
              <div className="flex gap-0.5 flex-1">
                {heatmapHours.map((h) => (
                  <span key={h} className="flex-1 text-[10px] text-muted-foreground text-center">{h}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RoomAvailability;
