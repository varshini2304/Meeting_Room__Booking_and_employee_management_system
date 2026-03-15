import { StatCard } from "@/components/StatCard";
import { CalendarCheck, XCircle, CheckCircle, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
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
  const [filters, setFilters] = useState({
    dateRange: "all",
    branch: "all",
    room: "all",
    employee: "all",
  });

  const mapped = useMemo(() => bookings.map((b: Booking) => {
    const room = b.roomId as Room;
    const owner = b.ownerId as User;
    const status = b.status === "cancelled" ? "Cancelled" : b.occupancyConfirmedAt ? "Occupied" : "Booked";
    return {
      id: b._id,
      employee: owner?.name || "Employee",
      room: room?.roomNumber || "Room",
      branch: room?.branch || "HQ",
      location: `${room?.branch || "HQ"} - ${room?.block || ""}, ${room?.floor || ""}`,
      date: b.date,
      time: `${b.startTime} - ${b.endTime}`,
      participants: b.invitedMembers?.length || 0,
      status: status as BookingStatus,
    };
  }), [bookings]);

  const today = new Date().toISOString().slice(0, 10);
  const totalToday = mapped.filter((m) => m.date === today).length;
  const cancelled = mapped.filter((m) => m.status === "Cancelled").length;
  const active = mapped.filter((m) => m.status === "Booked" || m.status === "Occupied").length;

  const options = useMemo(() => {
    const branches = Array.from(new Set(mapped.map((b) => b.branch).filter(Boolean)));
    const rooms = Array.from(new Set(mapped.map((b) => b.room).filter(Boolean)));
    const employees = Array.from(new Set(mapped.map((b) => b.employee).filter(Boolean)));
    return { branches, rooms, employees };
  }, [mapped]);

  const filtered = useMemo(() => {
    return mapped.filter((b) => {
      if (filters.branch !== "all" && b.branch !== filters.branch) return false;
      if (filters.room !== "all" && b.room !== filters.room) return false;
      if (filters.employee !== "all" && b.employee !== filters.employee) return false;

      if (filters.dateRange !== "all") {
        if (filters.dateRange === "today" && b.date !== today) return false;
      }
      return true;
    });
  }, [mapped, filters, today]);

  const resetFilters = () => {
    setFilters({
      dateRange: "all",
      branch: "all",
      room: "all",
      employee: "all",
    });
  };

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
          <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground">
            <span>📅</span>
            <select
              className="bg-transparent outline-none appearance-none"
              value={filters.dateRange}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: e.target.value }))}
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
            </select>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground">
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

          <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground">
            <select
              className="bg-transparent outline-none appearance-none"
              value={filters.room}
              onChange={(e) => setFilters((prev) => ({ ...prev, room: e.target.value }))}
            >
              <option value="all">All Rooms</option>
              {options.rooms.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground">
            <select
              className="bg-transparent outline-none appearance-none"
              value={filters.employee}
              onChange={(e) => setFilters((prev) => ({ ...prev, employee: e.target.value }))}
            >
              <option value="all">All Employees</option>
              {options.employees.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="ml-auto">
            <Button variant="outline" className="rounded-full px-6" onClick={resetFilters}>Reset</Button>
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
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-b-0">
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No bookings found matching filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default AllBookings;
