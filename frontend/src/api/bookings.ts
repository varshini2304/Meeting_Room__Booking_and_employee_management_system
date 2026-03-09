import { apiRequest } from "@/api/client";
import type { Booking } from "@/api/types";

export interface CreateBookingPayload {
  roomId: string;
  date: string;
  startTime: string;
  invitedMembers?: string[];
}

export const createBookingApi = (payload: CreateBookingPayload) =>
  apiRequest<Booking>("/bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getMyBookingsApi = () => apiRequest<Booking[]>("/bookings/my");
export const getBookingHistoryApi = () => apiRequest<Booking[]>("/bookings/history");
export const getAllBookingsApi = () => apiRequest<Booking[]>("/bookings");

export const cancelBookingApi = (id: string) =>
  apiRequest<{ message: string; booking: Booking }>(`/bookings/${id}`, {
    method: "DELETE",
  });

export const confirmOccupancyApi = (id: string) =>
  apiRequest<{ message: string; booking: Booking }>(`/bookings/${id}/confirm-occupancy`, {
    method: "PUT",
  });

