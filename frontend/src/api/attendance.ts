import { apiRequest } from "@/api/client";

export interface AttendanceRecord {
  _id: string;
  employeeId: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: "present" | "absent" | "late" | "half-day" | "on-leave";
  workHours: number;
  location: string;
  notes: string;
  isManualOverride: boolean;
  correctionRequest?: {
    status: "pending" | "approved" | "rejected";
    requestedCheckInTime?: string | null;
    requestedCheckOutTime?: string | null;
    reason?: string;
    requestedAt?: string;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    reviewerNotes?: string;
  } | null;
  createdAt: string;
}

export interface TodayRecord {
  status: "present" | "absent" | "late" | "half-day" | "on-leave";
  date: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  workHours?: number;
  _id?: string;
}

export interface MonthlySummary {
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  onLeave: number;
  totalWorkHours: number;
  avgWorkHours: number;
  records: AttendanceRecord[];
}

export interface LiveBoardEntry {
  employee: {
    _id: string;
    name: string;
    email: string;
    employeeId: string;
    department: string;
    designation: string;
  };
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: "present" | "absent" | "late" | "half-day" | "on-leave" | "weekend";
  workHours: number;
  recordId: string | null;
  correctionRequest?: {
    status: "pending" | "approved" | "rejected";
    requestedCheckInTime?: string | null;
    requestedCheckOutTime?: string | null;
    reason?: string;
    requestedAt?: string;
  } | null;
}

export const checkInApi = (location?: string) =>
  apiRequest<AttendanceRecord>("/attendance/check-in", {
    method: "POST",
    body: JSON.stringify({ location: location || "" }),
  });

export const checkOutApi = () =>
  apiRequest<AttendanceRecord>("/attendance/check-out", {
    method: "POST",
    body: JSON.stringify({}),
  });

export const getTodayApi = () =>
  apiRequest<TodayRecord>("/attendance/today");

export const getMyAttendanceApi = (month?: number, year?: number) => {
  const params = new URLSearchParams();
  if (month) params.set("month", String(month));
  if (year) params.set("year", String(year));
  const qs = params.toString();
  return apiRequest<AttendanceRecord[]>(`/attendance/my${qs ? `?${qs}` : ""}`);
};

export const getMySummaryApi = (month?: number, year?: number) => {
  const params = new URLSearchParams();
  if (month) params.set("month", String(month));
  if (year) params.set("year", String(year));
  const qs = params.toString();
  return apiRequest<MonthlySummary>(`/attendance/my/summary${qs ? `?${qs}` : ""}`);
};

export const getLiveBoardApi = (date?: string) =>
  apiRequest<LiveBoardEntry[]>(
    `/attendance${date ? `?date=${encodeURIComponent(date)}` : ""}`
  );

export const getReportApi = (from: string, to: string, employeeId?: string) => {
  const params = new URLSearchParams({ from, to });
  if (employeeId) params.set("employeeId", employeeId);
  return apiRequest<AttendanceRecord[]>(`/attendance/report?${params.toString()}`);
};

export const overrideAttendanceApi = (
  recordId: string,
  payload: {
    status: string;
    notes?: string;
    checkInTime?: string;
    checkOutTime?: string;
    employeeId?: string;
    date?: string;
  }
) =>
  apiRequest<AttendanceRecord>(`/attendance/override/${recordId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const requestCorrectionApi = (payload: {
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  reason?: string;
}) =>
  apiRequest<AttendanceRecord>("/attendance/request-correction", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const reviewCorrectionApi = (recordId: string, payload: { action: "approve" | "reject"; notes?: string }) =>
  apiRequest<AttendanceRecord>(`/attendance/request/${recordId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
