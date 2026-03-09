import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { SlotSelector } from "@/components/booking/SlotSelector";
import { InviteMembers } from "@/components/booking/InviteMembers";
import { RoomCard } from "@/components/booking/RoomCard";
import { useCreateBooking } from "@/hooks/queries/useBookings";
import { useRoomAvailability } from "@/hooks/queries/useRooms";
import type { Room } from "@/api/types";
import { useToast } from "@/hooks/use-toast";

import roomA from "@/assets/room-a.jpg";
import roomB from "@/assets/room-b.jpg";
import conferenceRoom from "@/assets/conference-room.jpg";
import boardroom from "@/assets/boardroom.jpg";

const timeSlots = [
  "9:00", "10:00", "10:30", "10:40", "11:00", "12:30", "13:30", "15:30", "17:00", "17:30", "18:00"
];

const toBackendTime = (slot: string) => slot.padStart(5, "0").replace(" ", "");
const getRoomImage = (room: Room) => {
  if (room.imageUrl) return room.imageUrl;
  if (room.roomNumber?.toLowerCase().includes("a")) return roomA;
  if (room.roomNumber?.toLowerCase().includes("b")) return roomB;
  if (room.roomType?.toLowerCase().includes("conference")) return conferenceRoom;
  if (room.roomType?.toLowerCase().includes("board")) return boardroom;
  return roomA;
};

const BookRoom = () => {
  const [date, setDate] = useState<Date | undefined>(new Date(2024, 3, 18));
  const [invitedMembers, setInvitedMembers] = useState<string[]>([]);
  const [selectedTime] = useState("10:00");
  const { toast } = useToast();
  const dateStr = (date || new Date()).toISOString().slice(0, 10);
  const { data: rooms = [], refetch } = useRoomAvailability({ date: dateStr, startTime: selectedTime }, true);
  const createBooking = useCreateBooking();

  const handleBook = async (roomId?: string) => {
    if (!roomId) return;
    try {
      await createBooking.mutateAsync({
        roomId,
        date: dateStr,
        startTime: selectedTime,
        invitedMembers,
      });
      toast({ title: "Booking created", description: "Room booking successful." });
      refetch();
    } catch (error) {
      toast({
        title: "Booking failed",
        description: error instanceof Error ? error.message : "Unable to create booking",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">Book a Meeting Room</h1>

      <div className="bg-card rounded-xl border border-border shadow-sm p-5 mb-6">
        <div className="flex gap-6">
          <div className="w-64 flex-shrink-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-lg border border-border"
            />
          </div>
          <SlotSelector
            timeSlots={timeSlots}
            bookedSlots={[0, 1, 2]}
            bookingInfo={{ title: "Project Kickoff", time: "9:00 AM - 10:30 AM", people: "2/8 people" }}
          />
        </div>
      </div>

      <div className="flex gap-6">
        <div className="w-64 flex-shrink-0">
          <InviteMembers initialMembers={[]} onMembersChange={setInvitedMembers} />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-foreground mb-4">April 2024</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {rooms.map((room) => (
              <RoomCard
                key={room._id}
                id={room._id}
                name={room.roomNumber}
                type={room.roomType}
                capacity={room.capacity}
                image={getRoomImage(room)}
                booked={room.isAvailable === false ? { time: `${selectedTime} slot`, people: "-", title: "Booked" } : null}
                onBook={handleBook}
                bookingInProgress={createBooking.isPending}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default BookRoom;
