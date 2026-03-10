import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { SlotSelector } from "@/components/booking/SlotSelector";
import { InviteMembers } from "@/components/booking/InviteMembers";
import { RoomCard } from "@/components/booking/RoomCard";
import { useDayBookings } from "@/hooks/queries/useBookings";
import { useRoomAvailability } from "@/hooks/queries/useRooms";
import type { Room } from "@/api/types";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useNavigate } from "react-router-dom";

import roomA from "@/assets/room-a.jpg";
import roomB from "@/assets/room-b.jpg";
import conferenceRoom from "@/assets/conference-room.jpg";
import boardroom from "@/assets/boardroom.jpg";

const pad = (value: number) => String(value).padStart(2, "0");
const toLocalDateKey = (value: Date) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const generateTimeSlots = (startHour = 8, endHour = 20) => {
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h += 1) {
    slots.push(`${pad(h)}:00`);
    slots.push(`${pad(h)}:30`);
  }
  return slots;
};
const getRoomImage = (room: Room) => {
  if (room.imageUrl) return room.imageUrl;
  if (room.roomNumber?.toLowerCase().includes("a")) return roomA;
  if (room.roomNumber?.toLowerCase().includes("b")) return roomB;
  if (room.roomType?.toLowerCase().includes("conference")) return conferenceRoom;
  if (room.roomType?.toLowerCase().includes("board")) return boardroom;
  return roomA;
};

const BookRoom = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [invitedMembers, setInvitedMembers] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const isManagerRoute = location.pathname.startsWith("/manager");
  const timeSlots = useMemo(() => generateTimeSlots(8, 20), []);
  const dateStr = toLocalDateKey(date || new Date());
  const { data: dayBookings = [] } = useDayBookings(dateStr, Boolean(dateStr));
  const { data: rooms = [] } = useRoomAvailability({ date: dateStr, startTime: selectedTime }, Boolean(selectedTime));

  const bookedSlots = useMemo(
    () => [...new Set(dayBookings.map((booking) => booking.startTime))],
    [dayBookings],
  );
  const slotSummary = useMemo(() => {
    const summary: Record<string, { count: number; rooms: string[] }> = {};
    dayBookings.forEach((booking) => {
      const room = booking.roomId as Room;
      const key = booking.startTime;
      if (!summary[key]) summary[key] = { count: 0, rooms: [] };
      summary[key].count += 1;
      if (room?.roomNumber) summary[key].rooms.push(room.roomNumber);
    });
    return summary;
  }, [dayBookings]);

  const handleBook = (roomId?: string) => {
    if (!roomId) return;
    if (!selectedTime || !dateStr) {
      toast({
        title: "Select date and time",
        description: "Date and time are required to continue booking.",
        variant: "destructive",
      });
      return;
    }
    const room = rooms.find((value) => value._id === roomId);
    navigate(isManagerRoute ? "/manager/confirm-booking" : "/confirm-booking", {
      state: {
        roomId,
        room,
        date: dateStr,
        startTime: selectedTime,
        invitedMembers,
      },
    });
  };

  return (
    <>
      <div className="mx-auto w-full max-w-[1280px]">
      <h1 className="text-2xl font-bold text-foreground mb-4">Book a Meeting Room</h1>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4 mb-4">
        <div className="space-y-4">
          <div className="w-full lg:w-72">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-lg border border-border"
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-card-foreground mb-2">Select Time Slot</h3>
            <SlotSelector
              timeSlots={timeSlots}
              bookedSlots={bookedSlots}
              slotSummary={slotSummary}
              selectedTime={selectedTime}
              onSelectTime={setSelectedTime}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="w-full lg:w-72 flex-shrink-0">
          <InviteMembers initialMembers={[]} onMembersChange={setInvitedMembers} />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-foreground mb-3">
            {(date || new Date()).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            {selectedTime ? ` at ${selectedTime}` : " (Select a time slot)"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {rooms.map((room) => (
              <RoomCard
                key={room._id}
                id={room._id}
                name={room.roomNumber}
                type={room.roomType}
                capacity={room.capacity}
                image={getRoomImage(room)}
                amenities={room.amenities}
                booked={room.isAvailable === false ? { time: `${selectedTime} slot`, people: "-", title: "Booked" } : null}
                onBook={handleBook}
                bookingInProgress={false}
              />
            ))}
          </div>
          {selectedTime && rooms.length === 0 && (
            <p className="text-sm text-muted-foreground mt-4">No rooms available for the selected date and time.</p>
          )}
        </div>
      </div>
      </div>
    </>
  );
};

export default BookRoom;
