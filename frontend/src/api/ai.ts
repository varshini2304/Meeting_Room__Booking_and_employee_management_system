import { apiRequest } from "@/api/client";

export interface PendingIntentCardData {
  intentId: string;
  roomNumber: string;
  roomType: string;
  branch: string;
  block?: string;
  floor?: string;
  date: string;
  startTime: string;
  endTime: string;
  attendeeCount: number;
  requestedAmenities?: string[];
  expiresAt: string;
  action: "CONFIRM_REQUIRED";
  confirmEndpoint: string;
}

export interface CancellationCardData {
  bookingId: string;
  roomNumber: string;
  branch: string;
  date: string;
  startTime: string;
  endTime: string;
  action: "CANCEL_REQUIRED";
  cancelEndpoint: string;
}

export interface AttendanceActionCardData {
  intentId: string;
  action: "PUNCH_IN" | "PUNCH_OUT";
  title: string;
  date: string;
  time: string;
  status: string;
  checkInTime?: string;
  actionText: string;
  confirmEndpoint: string;
}

export interface LeaveRequestCardData {
  intentId: string;
  leaveType: string;
  title: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  isHalfDay?: boolean;
  actionText: string;
  confirmEndpoint: string;
}

export interface NavigationData {
  destination: string;
  path: string;
  label: string;
  actionText?: string;
}

export interface AiChatResponse {
  sessionId: string;
  domain?: string;
  action?: string;
  intent: "BOOK_ROOM" | "SEARCH_ROOMS" | "MY_BOOKINGS" | "CANCEL_BOOKING" | "GENERAL_HELP";
  reply: string;
  pendingIntentCard?: PendingIntentCardData | null;
  cancellationCard?: CancellationCardData | null;
  attendanceActionCard?: AttendanceActionCardData | null;
  leaveRequestCard?: LeaveRequestCardData | null;
  navigation?: NavigationData | null;
  turnCount: number;
}

export interface ConfirmBookingResponse {
  success: boolean;
  booking: {
    bookingId: string;
    roomNumber: string;
    roomType: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
  };
}

export interface CancelBookingResponse {
  success: boolean;
  message: string;
  booking: {
    bookingId: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    canceledAt: string;
  };
}

/**
 * Sends a chat message to the conversational AI endpoint.
 * Note: Natural-language affirmations will NOT confirm bookings;
 * they will return or remind the user of a pendingIntentCard.
 */
export const sendAiChatApi = (payload: { message: string; sessionId?: string }) =>
  apiRequest<AiChatResponse>("/ai/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });

/**
 * Deterministically confirms a staged BookingIntent.
 * Exclusively invoked by clicking the [Confirm Booking] button on a PendingIntentCard.
 */
export const confirmAiBookingApi = (intentId: string) =>
  apiRequest<ConfirmBookingResponse>("/ai/booking/confirm", {
    method: "POST",
    body: JSON.stringify({ intentId }),
  });

/**
 * Deterministically cancels an active booking.
 * Exclusively invoked by clicking [Confirm Cancellation] on a CancellationCard.
 */
export const cancelAiBookingApi = (bookingId: string) =>
  apiRequest<CancelBookingResponse>("/ai/booking/cancel", {
    method: "POST",
    body: JSON.stringify({ bookingId }),
  });

/**
 * Releases or dismisses a staged BookingIntent before confirmation.
 */
export const cancelAiIntentApi = (intentId: string) =>
  apiRequest<{ success: boolean; message: string }>(`/ai/booking/intent/${encodeURIComponent(intentId)}`, {
    method: "DELETE",
  });

export interface ConfirmAttendanceResponse {
  success: boolean;
  message: string;
  action: "PUNCH_IN" | "PUNCH_OUT";
  record: {
    attendanceId: string;
    date: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    status: string;
    workHours: number;
  };
}

/**
 * Deterministically confirms a staged AttendanceAction (Punch In or Punch Out).
 * Exclusively invoked by clicking [Confirm Punch In] / [Confirm Punch Out] on an AttendanceActionCard.
 */
export const confirmAiAttendanceApi = (intentId: string) =>
  apiRequest<ConfirmAttendanceResponse>("/ai/attendance/confirm", {
    method: "POST",
    body: JSON.stringify({ intentId }),
  });

export interface ConfirmLeaveResponse {
  success: boolean;
  message: string;
  leave: {
    leaveId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    status: string;
    reason: string;
    createdAt: string;
  };
}

/**
 * Deterministically confirms a staged LeaveIntent.
 * Exclusively invoked by clicking [Confirm Leave Application] on a LeaveRequestCard.
 */
export const confirmAiLeaveApi = (intentId: string) =>
  apiRequest<ConfirmLeaveResponse>("/ai/leave/confirm", {
    method: "POST",
    body: JSON.stringify({ intentId }),
  });

