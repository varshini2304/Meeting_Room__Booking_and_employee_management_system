import { apiRequest } from "@/api/client";
import type { AuthResponse, User, UserRole } from "@/api/types";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  email: string;
  password: string;
  name?: string;
  employeeId?: string;
  role?: UserRole;
}

export const loginApi = (payload: LoginPayload) =>
  apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });

export const signupApi = (payload: SignupPayload) =>
  apiRequest<AuthResponse>("/auth/signup", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });

export const logoutApi = () =>
  apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
  });

export const getMeApi = () => apiRequest<User>("/auth/me");

