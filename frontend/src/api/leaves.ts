import { apiRequest } from "@/api/client";

export type LeaveType =
  | "casual"
  | "sick"
  | "earned"
  | "menstrual"
  | "relocation"
  | "unpaid"
  | "maternity"
  | "paternity";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveRequest {
  _id: string;
  employeeId: string | { _id: string; name: string; email: string; employeeId: string; department?: string };
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: string | { name: string } | null;
  reviewedAt?: string | null;
  reviewNotes?: string;
  isHalfDay: boolean;
  halfDayPeriod?: string;
  createdAt: string;
}

export interface LeaveQuota {
  total: number;
  used: number;
  pending: number;
  remaining: number;
}

export interface LeaveBalance {
  year: number;
  casual: LeaveQuota;
  sick: LeaveQuota;
  earned: LeaveQuota;
  menstrual: LeaveQuota;
  relocation: LeaveQuota;
  unpaid: LeaveQuota;
  maternity: LeaveQuota;
  paternity: LeaveQuota;
}

export interface TeamCalendarEntry {
  _id: string;
  employeeId: { _id: string; name: string; employeeId: string; department?: string };
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
}

export interface ApplyLeavePayload {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  isHalfDay?: boolean;
  halfDayPeriod?: string;
}

// ── Employee ──────────────────────────────────────────────────────────────────
export const applyLeaveApi = (payload: ApplyLeavePayload) =>
  apiRequest<LeaveRequest>("/leaves", { method: "POST", body: JSON.stringify(payload) });

export const getMyLeavesApi = (year?: number, status?: LeaveStatus) => {
  const p = new URLSearchParams();
  if (year)   p.set("year",   String(year));
  if (status) p.set("status", status);
  const qs = p.toString();
  return apiRequest<LeaveRequest[]>(`/leaves/my${qs ? `?${qs}` : ""}`);
};

export const getMyBalanceApi = (year?: number) =>
  apiRequest<LeaveBalance>(`/leaves/balance${year ? `?year=${year}` : ""}`);

export const cancelLeaveApi = (id: string) =>
  apiRequest<LeaveRequest>(`/leaves/${id}`, { method: "DELETE" });

// ── Shared ────────────────────────────────────────────────────────────────────
export const getTeamCalendarApi = (month?: number, year?: number) => {
  const p = new URLSearchParams();
  if (month) p.set("month", String(month));
  if (year)  p.set("year",  String(year));
  const qs = p.toString();
  return apiRequest<TeamCalendarEntry[]>(`/leaves/calendar${qs ? `?${qs}` : ""}`);
};

// ── Manager ───────────────────────────────────────────────────────────────────
export const getAllLeavesApi = (params?: {
  status?: LeaveStatus;
  from?: string;
  to?: string;
  employeeId?: string;
}) => {
  const p = new URLSearchParams();
  if (params?.status)     p.set("status",     params.status);
  if (params?.from)       p.set("from",        params.from);
  if (params?.to)         p.set("to",          params.to);
  if (params?.employeeId) p.set("employeeId",  params.employeeId);
  const qs = p.toString();
  return apiRequest<LeaveRequest[]>(`/leaves${qs ? `?${qs}` : ""}`);
};

export const approveLeaveApi = (id: string, notes?: string) =>
  apiRequest<LeaveRequest>(`/leaves/${id}/approve`, { method: "PUT", body: JSON.stringify({ notes: notes || "" }) });

export const rejectLeaveApi = (id: string, notes: string) =>
  apiRequest<LeaveRequest>(`/leaves/${id}/reject`, { method: "PUT", body: JSON.stringify({ notes }) });

export const getEmployeeBalanceApi = (userId: string, year?: number) =>
  apiRequest<LeaveBalance>(`/leaves/balance/${userId}${year ? `?year=${year}` : ""}`);

export const adjustBalanceApi = (employeeId: string, year: number, updates: Partial<Record<LeaveType, { total?: number; used?: number }>>) =>
  apiRequest<LeaveBalance>("/leaves/balance/adjust", { method: "POST", body: JSON.stringify({ employeeId, year, updates }) });

export const initBalancesApi = (year: number) =>
  apiRequest<{ message: string; year: number }>("/leaves/balance/init", { method: "POST", body: JSON.stringify({ year }) });
