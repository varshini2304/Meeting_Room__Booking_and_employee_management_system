import { RoomsTable } from "@/components/rooms/RoomsTable";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useRooms } from "@/hooks/queries/useRooms";
import type { Room } from "@/api/types";
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

const ManageRooms = () => {
  const navigate = useNavigate();
  const { data: rooms = [] } = useRooms();
  const mapped = rooms.map((room) => ({
    id: room._id,
    name: room.roomNumber,
    type: room.roomType,
    capacity: room.capacity,
    location: `${room.branch} - ${room.block}, ${room.floor}`,
    status: room.isActive ? "Active" : "Inactive",
    image: getRoomImage(room),
  }));

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Manage Rooms</h1>
        <Button onClick={() => navigate("/manager/create-room")}>+ Add Room</Button>
      </div>
      <RoomsTable rooms={mapped} onEdit={(id) => id && navigate(`/manager/create-room?edit=${id}`)} />
    </>
  );
};

export default ManageRooms;
