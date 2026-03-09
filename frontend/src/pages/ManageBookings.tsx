import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useCancelBooking, useConfirmOccupancy, useMyBookings } from "@/hooks/queries/useBookings";
import type { Booking, Room } from "@/api/types";

type Status = "Completed" | "Cancelled";

const StatusBadge = ({ status }: { status: Status }) => {
  const styles: Record<Status, string> = {
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

const ManageBookings = () => {
  const { data: bookings = [] } = useMyBookings();
  const cancelMutation = useCancelBooking();
  const confirmMutation = useConfirmOccupancy();

  const mapped = bookings.map((b: Booking) => {
    const room = b.roomId as Room;
    return {
      id: b._id,
      room: room?.roomNumber || "Room",
      meeting: room?.roomType || "Meeting",
      date: b.date,
      time: `${b.startTime} - ${b.endTime}`,
      participants: b.invitedMembers?.length || 0,
      avatarCount: Math.min(3, b.invitedMembers?.length || 0),
      status: (b.status === "cancelled" ? "Cancelled" : "Completed") as Status,
    };
  });

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
                <th className="py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {mapped.map((b, i) => (
                <tr key={i} className="border-b border-border last:border-b-0">
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
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => confirmMutation.mutate(b.id)}
                        disabled={confirmMutation.isPending}
                      >
                        Confirm
                      </button>
                      <button
                        className="text-xs text-destructive hover:underline"
                        onClick={() => cancelMutation.mutate(b.id)}
                        disabled={cancelMutation.isPending}
                      >
                        Cancel
                      </button>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default ManageBookings;

