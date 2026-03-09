import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";
import { useProfile } from "@/hooks/queries/useProfile";
import { useBookingHistory } from "@/hooks/queries/useBookings";

const Profile = () => {
  const { data: profile } = useProfile();
  const { data: history = [] } = useBookingHistory();
  const initials = profile?.name
    ? profile.name
      .split(" ")
      .map((v) => v[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    : "JS";

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">My Profile</h1>
      <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground border-4 border-border">
            {initials}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-card-foreground">{profile?.name || "User"}</h2>
            <p className="text-muted-foreground mt-1">{profile?.email || "-"}</p>
            <p className="text-muted-foreground mt-0.5">Department: {profile?.branch || "Toyota"}</p>
          </div>
          <Button className="rounded-full px-6">Edit Profile</Button>
        </div>
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <h2 className="font-semibold text-card-foreground mb-4 border-b border-border pb-3">Activity Summary</h2>
        <div className="flex items-center gap-4 p-4 border border-border rounded-xl">
          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
            <CalendarDays className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <p className="font-medium text-card-foreground">Meetings Booked</p>
            <p className="text-xl font-bold text-primary">{history.filter((b) => b.status === "booked").length}</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Profile;
