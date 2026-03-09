import { StatCard } from "@/components/StatCard";
import { CalendarCheck, XCircle, CheckCircle, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAllBookings } from "@/hooks/queries/useBookings";
import type { Booking, Room, User } from "@/api/types";

type BookingStatus = "Booked" | "Cancelled" | "Occupied" | "Not Confirmed";

const statusStyles: Record<BookingStatus, string> = {
  Booked: "bg-green-50 text-success",
  Cancelled: "bg-destructive/10 text-destructive",
  Occupied: "bg-accent text-accent-foreground",
  "Not Confirmed": "bg-yellow-50 text-yellow-600",
};

const AllBookings = () => {
  const { data: bookings = [] } = useAllBookings();
  const mapped = bookings.map((b: Booking) => {
    const room = b.roomId as Room;
    const owner = b.ownerId as User;
    const status = b.status === "cancelled" ? "Cancelled" : b.occupancyConfirmedAt ? "Occupied" : "Booked";
    return {
      employee: owner?.name || "Employee",
      room: room?.roomNumber || "Room",
      location: `${room?.branch || "HQ"} - ${room?.block || ""}, ${room?.floor || ""}`,
      date: b.date,
      time: `${b.startTime} - ${b.endTime}`,
      participants: b.invitedMembers?.length || 0,
      status: status as BookingStatus,
    };
  });
  const today = new Date().toISOString().slice(0, 10);
  const totalToday = mapped.filter((m) => m.date === today).length;
  const cancelled = mapped.filter((m) => m.status === "Cancelled").length;
  const active = mapped.filter((m) => m.status === "Booked" || m.status === "Occupied").length;

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">All Bookings</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon={CalendarCheck} iconBg="bg-accent" iconColor="text-primary" label="Total Bookings Today" value={totalToday} />
        <StatCard icon={XCircle} iconBg="bg-destructive/10" iconColor="text-destructive" label="Cancelled Bookings" value={cancelled} />
        <StatCard icon={CheckCircle} iconBg="bg-green-50" iconColor="text-success" label="Active Meetings" value={active} />
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <button className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 text-sm text-foreground">
            📅 Apr 24, 2024 - Apr 30, 2024 <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          <button className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 text-sm text-foreground">
            All Branches <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          <button className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 text-sm text-foreground">
            All Rooms <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          <button className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 text-sm text-foreground">
            All Employees <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="ml-auto">
            <Button className="rounded-full px-8">Filter</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Employee Name</th>
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Room Name</th>
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Location</th>
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Date</th>
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Time Slot</th>
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Participants</th>
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Booking Status</th>
                <th className="text-left text-sm font-medium text-muted-foreground py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mapped.map((b, i) => (
                <tr key={i} className="border-b border-border last:border-b-0">
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                        {b.employee.split(" ").map(n => n[0]).join("")}
                      </div>
                      <span className="text-sm font-medium text-card-foreground">{b.employee}</span>
                    </div>
                  </td>
                  <td className="py-4 pr-4 text-sm text-card-foreground">{b.room}</td>
                  <td className="py-4 pr-4 text-sm text-muted-foreground">{b.location}</td>
                  <td className="py-4 pr-4 text-sm text-card-foreground">{b.date}</td>
                  <td className="py-4 pr-4 text-sm text-card-foreground">{b.time}</td>
                  <td className="py-4 pr-4 text-sm text-card-foreground text-center">{b.participants}</td>
                  <td className="py-4 pr-4">
                    <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusStyles[b.status]}`}>{b.status}</span>
                  </td>
                  <td className="py-4">
                    <button className="text-sm text-primary hover:underline">View Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 mt-4 text-sm text-muted-foreground">
          <span>1–10 of {mapped.length}</span>
          <button className="p-1 rounded border border-border hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></button>
          <button className="w-8 h-8 rounded border border-primary bg-accent text-primary font-medium flex items-center justify-center">1</button>
          <button className="text-sm text-primary hover:underline">Next</button>
          <button className="p-1 rounded border border-border hover:bg-secondary"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </>
  );
};

export default AllBookings;
