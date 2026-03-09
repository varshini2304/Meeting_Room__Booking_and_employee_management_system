import { RoomCard } from "@/components/RoomCard";
import { UpcomingMeetings } from "@/components/UpcomingMeetings";
import { useMyBookings } from "@/hooks/queries/useBookings";
import { useRoomAvailability } from "@/hooks/queries/useRooms";
import type { Room } from "@/api/types";
import { useNavigate } from "react-router-dom";

import roomA from "@/assets/room-a.jpg";
import roomB from "@/assets/room-b.jpg";
import conferenceRoom from "@/assets/conference-room.jpg";
import boardroom from "@/assets/boardroom.jpg";

const getRoomImage = (room: Room) => {
  if (room.imageUrl) return room.imageUrl;
  if (room.roomNumber?.toLowerCase().includes("a")) return roomA;
  if (room.roomNumber?.toLowerCase().includes("b")) return roomB;
  if (room.roomType?.toLowerCase().includes("conference")) return conferenceRoom;
  if (room.roomType?.toLowerCase().includes("board")) return boardroom;
  return roomA;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const { data: rooms = [] } = useRoomAvailability({ date: today, startTime: "10:00" }, true);
  const { data: upcomingBookings = [] } = useMyBookings();

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">Meeting Room Dashboard</h1>
      <div className="flex gap-6">
        <div className="flex-1">
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <h2 className="font-semibold text-card-foreground mb-4">Available Meeting Rooms</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rooms.map((room) => (
                <RoomCard
                  key={room._id}
                  name={room.roomNumber}
                  type={room.roomType}
                  capacity={room.capacity}
                  image={getRoomImage(room)}
                  onBook={() => navigate("/book-room")}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="w-80 flex-shrink-0">
          <UpcomingMeetings meetings={upcomingBookings} />
        </div>
      </div>
    </>
  );
};

export default Dashboard;
