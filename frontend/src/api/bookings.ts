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
export const getDayBookingsApi = (date: string) =>
  apiRequest<Booking[]>(`/bookings/day?date=${encodeURIComponent(date)}`);

export const cancelBookingApi = (id: string) =>
  apiRequest<{ message: string; booking: Booking }>(`/bookings/${id}`, {
    method: "DELETE",
  });

export const confirmOccupancyApi = (id: string) =>
  apiRequest<{ message: string; booking: Booking }>(`/bookings/${id}/confirm-occupancy`, {
    method: "PUT",
  });

export interface CheckInDetails {
  bookingId: string;
  status: "booked" | "cancelled";
  date: string;
  startTime: string;
  endTime: string;
  occupancyConfirmedAt?: string | null;
  cutoffAt: string;
  canCheckIn: boolean;
  owner: {
    name: string;
    email: string;
    employeeId: string;
  } | null;
  room: {
    roomNumber: string;
    roomType: string;
    capacity: number;
    country: string;
    branch: string;
    block: string;
    floor: string;
  } | null;
  participants: Array<{ name: string; email: string }>;
}

export const getCheckInDetailsApi = (token: string) =>
  apiRequest<CheckInDetails>(`/bookings/check-in/details?token=${encodeURIComponent(token)}`, {
    auth: false,
  });

export const checkInWithTokenApi = (token: string) =>
  apiRequest<{ message: string; booking: Booking }>(`/bookings/check-in?token=${encodeURIComponent(token)}`, {
    method: "POST",
    auth: false,
  });

