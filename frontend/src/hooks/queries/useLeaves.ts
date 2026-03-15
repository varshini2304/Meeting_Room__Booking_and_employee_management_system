import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adjustBalanceApi,
  getAllLeavesApi,
  getEmployeeBalanceApi,
  getMyBalanceApi,
  getMyLeavesApi,
  getTeamCalendarApi,
  approveLeaveApi,
  applyLeaveApi,
  cancelLeaveApi,
  initBalancesApi,
  rejectLeaveApi,
  type LeaveStatus,
  type ApplyLeavePayload,
  type LeaveType,
} from "@/api/leaves";

// ── Employee hooks ────────────────────────────────────────────────────────────

export const useMyLeaves = (year?: number, status?: LeaveStatus) =>
  useQuery({
    queryKey: ["leaves", "my", year, status],
    queryFn: () => getMyLeavesApi(year, status),
  });

export const useMyBalance = (year?: number) =>
  useQuery({
    queryKey: ["leaves", "balance", "my", year],
    queryFn: () => getMyBalanceApi(year),
  });

export const useApplyLeave = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ApplyLeavePayload) => applyLeaveApi(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
};

export const useCancelLeave = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelLeaveApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leaves"] }),
  });
};

// ── Shared hooks ──────────────────────────────────────────────────────────────

export const useTeamCalendar = (month?: number, year?: number) =>
  useQuery({
    queryKey: ["leaves", "calendar", month, year],
    queryFn: () => getTeamCalendarApi(month, year),
  });

// ── Manager hooks ─────────────────────────────────────────────────────────────

export const useAllLeaves = (params?: {
  status?: LeaveStatus;
  from?: string;
  to?: string;
  employeeId?: string;
}) =>
  useQuery({
    queryKey: ["leaves", "all", params],
    queryFn: () => getAllLeavesApi(params),
  });

export const useApproveLeave = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => approveLeaveApi(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
};

export const useRejectLeave = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => rejectLeaveApi(id, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leaves"] }),
  });
};

export const useEmployeeBalance = (userId: string, year?: number) =>
  useQuery({
    queryKey: ["leaves", "balance", userId, year],
    queryFn: () => getEmployeeBalanceApi(userId, year),
    enabled: Boolean(userId),
  });

export const useAdjustBalance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      employeeId,
      year,
      updates,
    }: {
      employeeId: string;
      year: number;
      updates: Partial<Record<LeaveType, { total?: number; used?: number }>>;
    }) => adjustBalanceApi(employeeId, year, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leaves", "balance"] }),
  });
};

export const useInitBalances = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (year: number) => initBalancesApi(year),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leaves"] }),
  });
};
