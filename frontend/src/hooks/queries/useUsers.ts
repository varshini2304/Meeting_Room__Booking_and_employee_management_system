import { useMutation, useQuery } from "@tanstack/react-query";
import { createUserApi, getUsersApi } from "@/api/users";
import type { UserRole } from "@/api/types";

export const useCreateUser = () =>
  useMutation({
    mutationFn: createUserApi,
  });

export const useUsers = (params?: { role?: UserRole; isActive?: boolean }) =>
  useQuery({
    queryKey: ["users", params],
    queryFn: () => getUsersApi(params),
  });
