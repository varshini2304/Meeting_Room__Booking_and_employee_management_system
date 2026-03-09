import { RoomForm } from "@/components/rooms/RoomForm";
import { useNavigate } from "react-router-dom";
import { useCreateRoom } from "@/hooks/queries/useRooms";
import { useToast } from "@/hooks/use-toast";

const CreateRoom = () => {
  const navigate = useNavigate();
  const createRoom = useCreateRoom();
  const { toast } = useToast();

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">Create Meeting Room</h1>
      <RoomForm
        submitLabel="Create Room"
        onCancel={() => navigate("/manager/manage-rooms")}
        onSubmit={async (values) => {
          try {
            await createRoom.mutateAsync(values);
            toast({ title: "Room created", description: "Meeting room created successfully." });
            navigate("/manager/manage-rooms");
          } catch (error) {
            toast({
              title: "Create room failed",
              description: error instanceof Error ? error.message : "Unable to create room",
              variant: "destructive",
            });
          }
        }}
      />
    </>
  );
};

export default CreateRoom;
