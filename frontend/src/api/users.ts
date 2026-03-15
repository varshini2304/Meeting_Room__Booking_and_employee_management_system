import { getMeApi } from "@/api/auth";
import { apiRequest } from "@/api/client";
import type { Gender, User, UserRole } from "@/api/types";

export const getProfileApi = getMeApi;

export interface CreateUserPayload {
  employeeId: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  gender?: Gender;
  country?: string;
  branch?: string;
  block?: string;
  floor?: string;
}

export const createUserApi = (payload: CreateUserPayload) =>
  apiRequest<{ message: string; user: User }>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });

