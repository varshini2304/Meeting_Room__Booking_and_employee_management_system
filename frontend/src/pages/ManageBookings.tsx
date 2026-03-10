import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useBookingHistory, useCancelBooking } from "@/hooks/queries/useBookings";
import type { Booking, Room } from "@/api/types";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Status = "Scheduled" | "Completed" | "Cancelled";

const StatusBadge = ({ status }: { status: Status }) => {
  const styles: Record<Status, string> = {
    Scheduled: "bg-accent text-accent-foreground",
    Completed: "bg-green-50 text-success",
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
type StatusFilter = "all" | Status;

const defaultFilters = {
  dateRange: "last30" as DateRange,
  roomType: "all",
  status: "all" as StatusFilter,
  query: "",
};

const ManageBookings = () => {
  const { data: bookings = [] } = useBookingHistory();
  const cancelMutation = useCancelBooking();
  const { toast } = useToast();
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [participantEmail, setParticipantEmail] = useState("");
  const [pendingFilters, setPendingFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);

  const mapped = useMemo(() => bookings.map((b: Booking) => {
    const now = new Date();
    const endAt = new Date(`${b.date}T${b.endTime}:00`);
    const room = b.roomId as Room;
    const derivedStatus =
      b.status === "cancelled"
        ? "Cancelled"
        : !Number.isNaN(endAt.getTime()) && endAt < now
          ? "Completed"
          : "Scheduled";
    return {
      id: b._id,
      room: room?.roomNumber || "Room",
      meeting: room?.roomType || "Meeting",
      date: b.date,
      time: `${b.startTime} - ${b.endTime}`,
      participants: b.invitedMembers?.length || 0,
      avatarCount: Math.min(3, b.invitedMembers?.length || 0),
      status: derivedStatus as Status,
    };
  }), [bookings]);

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

  const handleParticipantSubmit = () => {
    if (!participantEmail.trim()) return;
    toast({
      title: "Participant email captured",
      description: `${participantEmail.trim()} added for invitation.`,
    });
    setParticipantEmail("");
    setSelectedBookingId(null);
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">Manage Bookings</h1>
      <div className="bg-card rounded-xl border border-border shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground">
            <span>📅</span>
            <select
              className="bg-transparent outline-none"
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
          <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground">
            <select
              className="bg-transparent outline-none"
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
          <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground">
            <select
              className="bg-transparent outline-none"
              value={pendingFilters.status}
              onChange={(e) =>
                setPendingFilters((prev) => ({ ...prev, status: e.target.value as StatusFilter }))
              }
            >
              <option value="all">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
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
              {filtered.map((b) => (
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
                    <div className="flex items-center gap-3">
                      <AvatarGroup count={b.avatarCount} extra={b.participants} />
                      <Button variant="outline" size="sm" onClick={() => setSelectedBookingId(b.id)}>
                        Add
                      </Button>
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <button
                        className="text-xs text-destructive hover:underline"
                        onClick={() => cancelMutation.mutate(b.id)}
                        disabled={cancelMutation.isPending || b.status !== "Scheduled"}
                      >
                        Cancel
                      </button>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No bookings found for this user.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog open={Boolean(selectedBookingId)} onOpenChange={(open) => !open && setSelectedBookingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Participant</DialogTitle>
            <DialogDescription>Enter participant email address for this meeting.</DialogDescription>
          </DialogHeader>
          <Input
            type="email"
            placeholder="participant@company.com"
            value={participantEmail}
            onChange={(e) => setParticipantEmail(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedBookingId(null)}>
              Cancel
            </Button>
            <Button onClick={handleParticipantSubmit}>Add Participant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ManageBookings;

