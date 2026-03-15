import { CheckCircle2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { Booking, Room } from "@/api/types";
import { CalendarDays, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BookingSuccessState {
  booking: Booking;
  room?: Room;
  date: string;
  startTime: string;
  endTime: string;
  meetingTitle?: string;
  notes?: string;
  invitedMembers: string[];
}

const toLocalDateFromKey = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const BookingSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isManagerRoute = location.pathname.startsWith("/manager");
  const state = (location.state || null) as BookingSuccessState | null;

  if (!state?.booking) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">No booking details found.</p>
        <Button className="mt-4" onClick={() => navigate(isManagerRoute ? "/manager/book-room" : "/book-room")}>
          Back to Book Room
        </Button>
      </div>
    );
  }

  const copyBookingId = async () => {
    try {
      await navigator.clipboard.writeText(state.booking._id);
      toast({ title: "Copied", description: "Booking ID copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Unable to copy booking ID.", variant: "destructive" });
    }
  };

  const handleAddToCalendar = () => {
    if (!state) return;

    const dateStr = state.date.replace(/-/g, "");
    const startStr = `${dateStr}T${state.startTime.replace(":", "")}00`;
    const endStr = `${dateStr}T${state.endTime.replace(":", "")}00`;

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${startStr}
DTEND:${endStr}
SUMMARY:${state.meetingTitle || "Toyota Meeting Booking"}
DESCRIPTION:${state.notes || "Room: " + (state.room?.roomNumber || "")}
LOCATION:${state.room?.roomNumber || "Meeting Room"} - ${state.room?.branch || ""}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `meeting-${state.date}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">Booking Confirmed</h1>
      <div className="bg-card rounded-3xl border border-border p-6 space-y-6 shadow-sm bg-gradient-to-br from-primary/5 via-card to-card">
        <div className="text-center">
          <div className="relative mx-auto h-20 w-20">
            <div className="absolute inset-0 rounded-full bg-green-500/15 animate-ping" />
            <div className="absolute inset-1 rounded-full border-2 border-green-500/40" />
            <div className="absolute inset-3 rounded-full bg-green-500 flex items-center justify-center text-white shadow-sm">
              <CheckCircle2 className="h-9 w-9" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-card-foreground mt-4">Booking Confirmed!</h2>
          <p className="text-muted-foreground mt-2">Your meeting room has been successfully reserved.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-border rounded-2xl p-5 bg-background/60">
            <h3 className="text-xl font-semibold text-card-foreground mb-4">Booking Details</h3>
            <div className="space-y-2 text-sm text-foreground">
              <p><span className="font-semibold">Meeting Title:</span> {state.meetingTitle || "Project Strategy Meeting"}</p>
              <p><span className="font-semibold">Room Name:</span> {state.room?.roomNumber || "-"}</p>
              <p><span className="font-semibold">Room Type:</span> {state.room?.roomType || "-"}</p>
              <p><span className="font-semibold">Location:</span> {state.room ? `${state.room.country} > ${state.room.branch} > ${state.room.block} > ${state.room.floor}` : "-"}</p>
              <p><span className="font-semibold">Date:</span> {toLocalDateFromKey(state.date).toLocaleDateString()}</p>
              <p><span className="font-semibold">Time Slot:</span> {state.startTime} - {state.endTime}</p>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Booking ID:</span>
                <span className="text-muted-foreground">{state.booking._id}</span>
                <button className="text-primary hover:opacity-80" onClick={copyBookingId}>
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              {state.notes ? <p className="text-xs text-muted-foreground">Notes: {state.notes}</p> : null}
            </div>
          </div>

          <div className="border border-border rounded-2xl p-5 bg-background/60">
            <h3 className="text-xl font-semibold text-card-foreground mb-4">Participants & Amenities</h3>
            {state.invitedMembers?.length ? (
              <div className="flex flex-wrap gap-2 mb-4">
                {state.invitedMembers.map((participant) => (
                  <span key={participant} className="rounded-lg border border-border px-3 py-1 text-sm text-muted-foreground bg-card">
                    {participant}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">No participants added.</p>
            )}
            <div>
              <p className="text-sm font-semibold text-card-foreground mb-2">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {(state.room?.amenities || []).map((amenity) => (
                  <span key={amenity} className="rounded-md bg-accent px-3 py-1 text-xs text-accent-foreground">
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Confirmation email has been sent. Participants receive venue details, and booking owner receives check-in link.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button className="h-12 text-base px-6 bg-gradient-to-r from-blue-500 to-blue-600" onClick={() => navigate(isManagerRoute ? "/manager/my-bookings" : "/manage-bookings")}>
            View My Bookings
          </Button>
          <Button variant="outline" className="h-12 text-base px-6" onClick={handleAddToCalendar}>
            <CalendarDays className="h-4 w-4 mr-2" /> Add to Calendar
          </Button>
          <Button variant="outline" className="h-12 text-base px-6" onClick={() => navigate(isManagerRoute ? "/manager/book-room" : "/book-room")}>
            Book Another Room
          </Button>
          <Button variant="outline" className="h-12 text-base px-6" onClick={() => navigate(isManagerRoute ? "/manager" : "/dashboard")}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    </>
  );
};

export default BookingSuccess;
