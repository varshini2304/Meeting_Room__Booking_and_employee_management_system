import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Room } from "@/api/types";
import { useCreateBooking } from "@/hooks/queries/useBookings";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock3, LocateFixed, Monitor, Video, Wifi, PencilLine } from "lucide-react";
import conferenceRoom from "@/assets/conference-room.jpg";

interface ConfirmBookingState {
  roomId: string;
  room?: Room;
  date: string;
  startTime: string;
  invitedMembers: string[];
}

const addThirtyMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  const dt = new Date(2000, 0, 1, h, m + 30);
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
};

const ConfirmBooking = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const createBooking = useCreateBooking();
  const { toast } = useToast();
  const isManagerRoute = location.pathname.startsWith("/manager");
  const state = (location.state || null) as ConfirmBookingState | null;
  const [meetingTitle, setMeetingTitle] = useState("");
  const [notes, setNotes] = useState("");

  const endTime = useMemo(() => (state?.startTime ? addThirtyMinutes(state.startTime) : ""), [state?.startTime]);

  if (!state?.roomId || !state?.date || !state?.startTime) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Booking context missing. Please select room/date/time again.</p>
        <Button className="mt-4" onClick={() => navigate(isManagerRoute ? "/manager/book-room" : "/book-room")}>
          Back to Book Room
        </Button>
      </div>
    );
  }

  const handleConfirm = async () => {
    try {
      const booking = await createBooking.mutateAsync({
        roomId: state.roomId,
        date: state.date,
        startTime: state.startTime,
        invitedMembers: state.invitedMembers || [],
      });
      navigate(isManagerRoute ? "/manager/booking-success" : "/booking-success", {
        state: {
          booking,
          room: state.room,
          date: state.date,
          startTime: state.startTime,
          endTime,
          meetingTitle,
          notes,
          invitedMembers: state.invitedMembers || [],
        },
      });
    } catch (error) {
      toast({
        title: "Booking failed",
        description: error instanceof Error ? error.message : "Unable to confirm booking",
        variant: "destructive",
      });
    }
  };

  const room = state.room;
  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">Confirm Room Booking</h1>
      <div className="rounded-2xl border border-border bg-card/95 shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-3xl font-semibold tracking-tight text-card-foreground">Room Summary</h2>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 rounded-xl border border-border overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <img src={room?.imageUrl || conferenceRoom} alt={room?.roomNumber || "Room"} className="h-full min-h-56 w-full object-cover" />
                <div className="p-5 space-y-4">
                  <div>
                    <h3 className="text-4xl font-bold text-card-foreground">{room?.roomNumber || "Selected Room"}</h3>
                    <p className="text-lg text-muted-foreground">{room?.roomType || "-"}</p>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Monitor className="h-4 w-4" />
                    <Wifi className="h-4 w-4" />
                    <Video className="h-4 w-4" />
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <LocateFixed className="h-4 w-4" />
                    {room ? `${room.country} > ${room.branch} > ${room.block} > ${room.floor}` : "Location unavailable"}
                  </p>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground mb-2">Amenities</p>
                    <div className="flex flex-wrap gap-2">
                      {(room?.amenities || []).map((amenity) => (
                        <span key={amenity} className="rounded-md bg-accent px-3 py-1 text-xs text-accent-foreground">
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border p-5 space-y-3">
              <h3 className="text-3xl font-semibold text-card-foreground">Date and Time</h3>
              <p className="text-2xl font-medium text-card-foreground">{new Date(state.date).toLocaleDateString()}</p>
              <p className="text-lg text-muted-foreground flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                Start Time: {state.startTime}
              </p>
              <p className="text-lg text-muted-foreground flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                End Time: {endTime}
              </p>
              <p className="text-lg text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Duration: 30 Minutes
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 rounded-xl border border-border p-5 space-y-4">
              <div>
                <p className="text-2xl font-semibold text-card-foreground mb-2">Meeting Title</p>
                <Input
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="Enter meeting title"
                  className="h-12 text-base"
                />
              </div>
              <div>
                <p className="text-2xl font-semibold text-card-foreground mb-2">Invite Participants</p>
                {state.invitedMembers?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {state.invitedMembers.map((email) => (
                      <span key={email} className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
                        {email}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No participants added.</p>
                )}
              </div>
              <div>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="min-h-24"
                />
              </div>
            </div>

            <div className="rounded-xl border border-border p-5 space-y-3">
              <p className="text-2xl font-semibold text-card-foreground">Meeting Details</p>
              <div className="rounded-lg border border-border p-3 text-base text-card-foreground flex items-center justify-between">
                <span>Selected Date</span>
                <span className="text-muted-foreground">{new Date(state.date).toLocaleDateString()}</span>
              </div>
              <div className="rounded-lg border border-border p-3 text-base text-card-foreground flex items-center justify-between">
                <span>Start Time</span>
                <span className="text-muted-foreground">{state.startTime} - {endTime}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate(isManagerRoute ? "/manager/book-room" : "/book-room")} className="h-12 min-w-32 text-lg">
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={createBooking.isPending} className="h-12 min-w-44 text-lg bg-gradient-to-r from-blue-500 to-blue-600">
              <PencilLine className="h-4 w-4 mr-2" />
              {createBooking.isPending ? "Confirming..." : "Confirm Booking"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmBooking;
