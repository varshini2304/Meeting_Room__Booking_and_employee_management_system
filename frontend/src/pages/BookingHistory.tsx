import { useMemo, useState } from "react";
import { ChevronDown, CalendarCheck, CheckCircle2, XCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBookingHistory } from "@/hooks/queries/useBookings";
import type { Booking, Room } from "@/api/types";
import { Input } from "@/components/ui/input";

type HistoryStatus = "Completed" | "Cancelled";

const StatusBadge = ({ status }: { status: HistoryStatus }) => {
  const styles: Record<HistoryStatus, string> = {
    Completed: "bg-accent text-accent-foreground",
    Cancelled: "bg-destructive/10 text-destructive",
  };
  return <span className={`text-xs font-medium px-3 py-1 rounded-full ${styles[status]}`}>{status}</span>;
};

const AvatarGroup = ({ count, extra }: { count: number; extra: number }) => (
  <div className="flex items-center -space-x-2">
    {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
      <div
        key={i}
        className="w-7 h-7 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-medium text-muted-foreground"
      >
        {String.fromCharCode(65 + i)}
      </div>
    ))}
    {extra > 0 && <span className="text-xs text-muted-foreground ml-2">+{extra}</span>}
  </div>
);

type DateRange = "last30" | "all";
type StatusFilter = "all" | HistoryStatus;

const defaultFilters = {
  dateRange: "last30" as DateRange,
  roomType: "all",
  status: "all" as StatusFilter,
  query: "",
};

const BookingHistory = () => {
  const { data: bookings = [] } = useBookingHistory();
  const [pendingFilters, setPendingFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);

  const mapped = useMemo(() => {
    const now = new Date();
    return bookings
      .filter((b: Booking) => {
        if (b.status === "cancelled") return true;
        const endAt = new Date(`${b.date}T${b.endTime}:00`);
        return !Number.isNaN(endAt.getTime()) && endAt < now;
      })
      .sort((a: Booking, b: Booking) => {
        const aTs = new Date(`${a.date}T${a.startTime}:00`).getTime();
        const bTs = new Date(`${b.date}T${b.startTime}:00`).getTime();
        return bTs - aTs;
      })
      .map((b: Booking) => {
        const room = b.roomId as Room;
        return {
          id: b._id,
          room: room?.roomNumber || "Room",
          meeting: room?.roomType || "Meeting",
          date: b.date,
          time: `${b.startTime} - ${b.endTime}`,
          participants: b.invitedMembers?.length || 0,
          avatarCount: Math.min(3, b.invitedMembers?.length || 0),
          status: (b.status === "cancelled" ? "Cancelled" : "Completed") as HistoryStatus,
        };
      });
  }, [bookings]);

  const roomTypeOptions = useMemo(() => {
    const types = mapped
      .map((b) => b.meeting)
      .filter((value) => Boolean(value && value.trim()))
      .map((value) => value.trim());
    return ["all", ...Array.from(new Set(types))];
  }, [mapped]);

  const filtered = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const query = appliedFilters.query.trim().toLowerCase();

    return mapped.filter((b) => {
      if (appliedFilters.status !== "all" && b.status !== appliedFilters.status) return false;
      if (appliedFilters.roomType !== "all" && b.meeting !== appliedFilters.roomType) return false;
      if (appliedFilters.dateRange === "last30") {
        const bookingDate = new Date(`${b.date}T00:00:00`);
        if (Number.isNaN(bookingDate.getTime()) || bookingDate < cutoff) return false;
      }
      if (query) {
        const haystack = `${b.room} ${b.meeting}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [appliedFilters, mapped]);

  const stats = useMemo(() => ({
    total: mapped.length,
    completed: mapped.filter((b) => b.status === "Completed").length,
    cancelled: mapped.filter((b) => b.status === "Cancelled").length,
    participants: mapped.reduce((s, b) => s + b.participants, 0),
  }), [mapped]);

  return (
    <>
      <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-background to-background p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Booking History</h1>
            <p className="text-sm text-muted-foreground mt-1">Review past meetings and outcomes.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {[
              { label: "Total", value: stats.total, icon: CalendarCheck, color: "text-primary", bg: "bg-primary/10" },
              { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Cancelled", value: stats.cancelled, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
              { label: "Participants", value: stats.participants, icon: Users, color: "text-sky-600", bg: "bg-sky-50" },
            ].map((c) => (
              <div key={c.label} className="bg-card rounded-xl border border-border px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg}`}>
                  <c.icon className={`h-4 w-4 ${c.color}`} />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">{c.label}</p>
                  <p className="text-xl font-bold text-foreground">{c.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground bg-background/60">
            <span>📅</span>
            <select
              className="bg-transparent outline-none appearance-none pr-6"
              value={pendingFilters.dateRange}
              onChange={(e) =>
                setPendingFilters((prev) => ({ ...prev, dateRange: e.target.value as DateRange }))
              }
            >
              <option value="last30">Last 30 Days</option>
              <option value="all">All Dates</option>
            </select>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground bg-background/60">
            <select
              className="bg-transparent outline-none appearance-none pr-6"
              value={pendingFilters.roomType}
              onChange={(e) => setPendingFilters((prev) => ({ ...prev, roomType: e.target.value }))}
            >
              {roomTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type === "all" ? "All Room Types" : type}
                </option>
              ))}
            </select>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground bg-background/60">
            <select
              className="bg-transparent outline-none appearance-none pr-6"
              value={pendingFilters.status}
              onChange={(e) =>
                setPendingFilters((prev) => ({ ...prev, status: e.target.value as StatusFilter }))
              }
            >
              <option value="all">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <Input
            value={pendingFilters.query}
            onChange={(e) => setPendingFilters((prev) => ({ ...prev, query: e.target.value }))}
            placeholder="Search room or type"
            className="w-full sm:w-56"
          />
          <div className="ml-auto flex items-center gap-2">
            <Button className="rounded-full px-6" onClick={() => setAppliedFilters(pendingFilters)}>
              Filter
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-6"
              onClick={() => {
                setPendingFilters(defaultFilters);
                setAppliedFilters(defaultFilters);
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Room Name</th>
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Date</th>
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Time</th>
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Participants</th>
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors">
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-sm text-card-foreground">
                      {b.room} {b.meeting}
                    </p>
                    <p className="text-xs text-muted-foreground">{b.meeting}</p>
                  </td>
                  <td className="py-4 pr-4 text-sm text-card-foreground">{b.date}</td>
                  <td className="py-4 pr-4 text-sm text-card-foreground">{b.time}</td>
                  <td className="py-4 pr-4">
                    <AvatarGroup count={b.avatarCount} extra={b.participants} />
                  </td>
                  <td className="py-4 pr-4">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No booking history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default BookingHistory;
