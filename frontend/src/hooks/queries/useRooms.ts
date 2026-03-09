import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRoomApi, getRoomAvailabilityApi, getRoomsApi, updateRoomApi, type RoomFilters } from "@/api/rooms";

export const useRooms = (filters: RoomFilters = {}) =>
  useQuery({
    queryKey: ["rooms", filters],
    queryFn: () => getRoomsApi(filters),
  });

export const useRoomAvailability = (filters: RoomFilters, enabled = true) =>
  useQuery({
    queryKey: ["rooms", "availability", filters],
    queryFn: () => getRoomAvailabilityApi(filters),
    enabled,
  });

export const useCreateRoom = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRoomApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
};

export const useUpdateRoom = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateRoomApi>[1] }) => updateRoomApi(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
};

