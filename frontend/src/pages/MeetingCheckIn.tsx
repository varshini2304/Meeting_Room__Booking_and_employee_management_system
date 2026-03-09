import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getCheckInDetailsApi, checkInWithTokenApi, type CheckInDetails } from "@/api/bookings";

const MeetingCheckIn = () => {
  const [searchParams] = useSearchParams();
  const [details, setDetails] = useState<CheckInDetails | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const token = searchParams.get("token") || "";

  const load = async () => {
    if (!token) {
      setError("Missing token");
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const response = await getCheckInDetailsApi(token);
      setDetails(response);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load meeting details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCheckIn = async () => {
    try {
      setIsCheckingIn(true);
      await checkInWithTokenApi(token);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setIsCheckingIn(false);
    }
  };

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading meeting details...</div>;
  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>;
  if (!details) return <div className="p-6 text-sm text-muted-foreground">No meeting data found.</div>;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Meeting Details</h1>
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <p><span className="font-semibold">Date:</span> {details.date}</p>
          <p><span className="font-semibold">Time:</span> {details.startTime} - {details.endTime}</p>
          <p><span className="font-semibold">Room:</span> {details.room?.roomNumber} ({details.room?.roomType})</p>
          <p><span className="font-semibold">Location:</span> {details.room?.country}, {details.room?.branch}, {details.room?.block}, {details.room?.floor}</p>
          <p><span className="font-semibold">Organizer:</span> {details.owner?.name} ({details.owner?.email})</p>
          <p><span className="font-semibold">Participants:</span> {details.participants.map((p) => p.email).join(", ") || "None"}</p>
          <p><span className="font-semibold">Status:</span> {details.status}</p>
          <p><span className="font-semibold">Check-in Cutoff:</span> {new Date(details.cutoffAt).toLocaleString()}</p>
        </div>

        <div>
          <Button onClick={handleCheckIn} disabled={!details.canCheckIn || isCheckingIn || details.status !== "booked"}>
            {details.occupancyConfirmedAt ? "Checked In" : isCheckingIn ? "Checking In..." : "Check In"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MeetingCheckIn;

