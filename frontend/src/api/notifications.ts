import { apiRequest } from "@/api/client";
import type { Notification } from "@/api/types";

export const getNotificationsApi = () => apiRequest<Notification[]>("/notifications");

export const markNotificationReadApi = (id: string) =>
  apiRequest<Notification>(`/notifications/${id}/read`, {
    method: "PUT",
  });

