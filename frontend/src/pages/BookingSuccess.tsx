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

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">Booking Confirmed</h1>
      <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
        <div className="text-center">
          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
          <h2 className="text-3xl font-bold text-card-foreground mt-3">Booking Confirmed!</h2>
          <p className="text-muted-foreground mt-2">Your meeting room has been successfully reserved.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border border-border rounded-xl p-5">
          <div className="space-y-3">
            <h3 className="text-3xl font-semibold text-card-foreground">Booking Details</h3>
            <p className="text-xl"><span className="font-semibold">Meeting Title:</span> {state.meetingTitle || "Project Strategy Meeting"}</p>
            <p className="text-xl"><span className="font-semibold">Room Name:</span> {state.room?.roomNumber || "-"}</p>
            <p className="text-xl"><span className="font-semibold">Room Type:</span> {state.room?.roomType || "-"}</p>
            <p className="text-xl"><span className="font-semibold">Location:</span> {state.room ? `${state.room.country} > ${state.room.branch} > ${state.room.block} > ${state.room.floor}` : "-"}</p>
            <p className="text-xl"><span className="font-semibold">Date:</span> {new Date(state.date).toLocaleDateString()}</p>
            <p className="text-xl"><span className="font-semibold">Time Slot:</span> {state.startTime} - {state.endTime}</p>
            <div className="flex items-center gap-2 text-xl">
              <span className="font-semibold">Booking ID:</span>
              <span>{state.booking._id}</span>
              <button className="text-primary hover:opacity-80" onClick={copyBookingId}>
                <Copy className="h-4 w-4" />
              </button>
            </div>
            {state.notes ? <p className="text-base text-muted-foreground">Notes: {state.notes}</p> : null}
          </div>
          <div className="space-y-4">
            <h3 className="text-3xl font-semibold text-card-foreground">Participants</h3>
            {state.invitedMembers?.length ? (
              <div className="flex flex-wrap gap-2">
                {state.invitedMembers.map((participant) => (
                  <span key={participant} className="rounded-lg border border-border px-3 py-1 text-sm text-muted-foreground">
                    {participant}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No participants added.</p>
            )}
            <div>
              <p className="text-xl font-semibold text-card-foreground mb-2">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {(state.room?.amenities || []).map((amenity) => (
                  <span key={amenity} className="rounded-md bg-accent px-3 py-1 text-xs text-accent-foreground">
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Confirmation email has been sent. Participants receive venue details, and booking owner receives check-in link.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button className="h-12 text-lg px-8 bg-gradient-to-r from-blue-500 to-blue-600" onClick={() => navigate(isManagerRoute ? "/manager/my-bookings" : "/manage-bookings")}>
            View My Bookings
          </Button>
          <Button variant="outline" className="h-12 text-lg px-8">
            <CalendarDays className="h-4 w-4 mr-2" /> Add to Calendar
          </Button>
          <Button variant="outline" className="h-12 text-lg px-8" onClick={() => navigate(isManagerRoute ? "/manager/book-room" : "/book-room")}>
            Book Another Room
          </Button>
          <Button variant="outline" className="h-12 text-lg px-8" onClick={() => navigate(isManagerRoute ? "/manager" : "/dashboard")}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    </>
  );
};

export default BookingSuccess;
