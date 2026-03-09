import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelBookingApi,
  confirmOccupancyApi,
  createBookingApi,
  getAllBookingsApi,
  getBookingHistoryApi,
  getMyBookingsApi,
} from "@/api/bookings";

export const useMyBookings = () =>
  useQuery({
    queryKey: ["bookings", "my"],
    queryFn: getMyBookingsApi,
  });

export const useBookingHistory = () =>
  useQuery({
    queryKey: ["bookings", "history"],
    queryFn: getBookingHistoryApi,
  });

export const useAllBookings = () =>
  useQuery({
    queryKey: ["bookings", "all"],
    queryFn: getAllBookingsApi,
  });

export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBookingApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["rooms", "availability"] });
    },
  });
};

export const useCancelBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelBookingApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });
};

export const useConfirmOccupancy = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: confirmOccupancyApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });
};

