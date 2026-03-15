import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  checkInApi,
  checkOutApi,
  getLiveBoardApi,
  getMyAttendanceApi,
  getMySummaryApi,
  getReportApi,
  getTodayApi,
  overrideAttendanceApi,
  requestCorrectionApi,
  reviewCorrectionApi,
} from "@/api/attendance";

export const useTodayAttendance = () =>
  useQuery({
    queryKey: ["attendance", "today"],
    queryFn: getTodayApi,
    refetchInterval: 60_000, // refresh every minute
  });

export const useMyAttendance = (month?: number, year?: number) =>
  useQuery({
    queryKey: ["attendance", "my", month, year],
    queryFn: () => getMyAttendanceApi(month, year),
  });

export const useMySummary = (month?: number, year?: number) =>
  useQuery({
    queryKey: ["attendance", "summary", "my", month, year],
    queryFn: () => getMySummaryApi(month, year),
  });

export const useLiveBoard = (date?: string) =>
  useQuery({
    queryKey: ["attendance", "live", date],
    queryFn: () => getLiveBoardApi(date),
    refetchInterval: 30_000, // refresh every 30s — live board
  });

export const useAttendanceReport = (from: string, to: string, employeeId?: string, enabled = true) =>
  useQuery({
    queryKey: ["attendance", "report", from, to, employeeId],
    queryFn: () => getReportApi(from, to, employeeId),
    enabled,
  });

export const useCheckIn = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (location?: string) => checkInApi(location),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
};

export const useCheckOut = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: checkOutApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
};

export const useOverrideAttendance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordId,
      payload,
    }: {
      recordId: string;
      payload: Parameters<typeof overrideAttendanceApi>[1];
    }) => overrideAttendanceApi(recordId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
};

export const useRequestCorrection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: requestCorrectionApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
};

export const useReviewCorrection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, payload }: { recordId: string; payload: Parameters<typeof reviewCorrectionApi>[1] }) =>
      reviewCorrectionApi(recordId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
};
