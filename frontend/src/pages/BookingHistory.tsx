import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBookingHistory } from "@/hooks/queries/useBookings";
import type { Booking, Room } from "@/api/types";

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

const BookingHistory = () => {
  const { data: bookings = [] } = useBookingHistory();

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

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">Booking History</h1>
      <div className="bg-card rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center gap-3 mb-6">
          <button className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 text-sm text-foreground">
            <span>📅</span> Last 30 Days <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          <button className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 text-sm text-foreground">
            Room Type <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="ml-auto">
            <Button className="rounded-full px-8">Filter</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Room Name</th>
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Date</th>
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Time</th>
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Participants</th>
                <th className="text-left text-sm font-medium text-muted-foreground py-3 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {mapped.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-b-0">
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
              {mapped.length === 0 && (
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
