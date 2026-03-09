import { CalendarDays, Users } from "lucide-react";
import type { Booking, Room } from "@/api/types";

interface Meeting {
  title: string;
  time: string;
  room: string;
  people: number;
}

const defaultMeetings: Meeting[] = [
  { title: "Project Kickoff", time: "Today, 10:00 AM - 11:00 AM", room: "Room A", people: 8 },
  { title: "Q3 Sales Review", time: "Today, 1:00 PM - 2:00 PM", room: "Room B", people: 10 },
  { title: "Weekly Sync", time: "Tomorrow, 9:00 AM - 10:00 AM", room: "Conference Room", people: 16 },
];

const toUiMeeting = (booking: Booking): Meeting => {
  const room = booking.roomId as Room;
  return {
    title: room?.roomType || "Meeting",
    time: `${booking.date}, ${booking.startTime} - ${booking.endTime}`,
    room: room?.roomNumber || "Room",
    people: booking.invitedMembers?.length || 0,
  };
};

export function UpcomingMeetings({ meetings }: { meetings?: Booking[] }) {
  const uiMeetings = meetings?.length ? meetings.map(toUiMeeting) : defaultMeetings;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-card-foreground">Upcoming Meetings</h2>
        <button className="text-sm text-primary font-medium hover:underline">View All</button>
      </div>
      <div className="space-y-4">
        {uiMeetings.map((m, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
              <CalendarDays className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-card-foreground">{m.title}</p>
              <p className="text-xs text-muted-foreground">{m.time}</p>
              <p className="text-sm font-medium text-card-foreground mt-0.5">{m.room}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Users className="h-3 w-3" /> {m.people} people
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-right">
        <button className="text-sm text-primary font-medium hover:underline">View All</button>
      </div>
    </div>
  );
}
