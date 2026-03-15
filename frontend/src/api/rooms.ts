import { apiRequest } from "@/api/client";
import type { Room } from "@/api/types";

export interface RoomFilters {
  country?: string;
  branch?: string;
  block?: string;
  floor?: string;
  roomNumber?: string;
  roomType?: string;
  capacity?: number;
  date?: string;
  startTime?: string;
}

const toQuery = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const s = query.toString();
  return s ? `?${s}` : "";
};

export const getRoomsApi = (filters: RoomFilters = {}) => apiRequest<Room[]>(`/rooms${toQuery(filters)}`);

export const getRoomAvailabilityApi = (filters: RoomFilters) =>
  apiRequest<Room[]>(`/rooms/availability${toQuery(filters)}`);

export const createRoomApi = (payload: Partial<Room>) =>
  apiRequest<Room>("/rooms", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateRoomApi = (id: string, payload: Partial<Room>) =>
  apiRequest<Room>(`/rooms/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteRoomApi = (id: string) =>
  apiRequest<void>(`/rooms/${id}`, {
    method: "DELETE",
  });

export interface RoomCheckInPayload {
  roomNumber: string;
  email: string;
  secretCode: string;
}

export const checkInRoomApi = (payload: RoomCheckInPayload) =>
  apiRequest<{ message: string; bookingId: string; occupancyConfirmedAt: string }>("/rooms/check-in", {
    method: "POST",
    body: JSON.stringify(payload),
    auth: false,
  });

