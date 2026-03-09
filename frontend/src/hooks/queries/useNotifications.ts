import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotificationsApi, markNotificationReadApi } from "@/api/notifications";

export const useNotifications = () =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: getNotificationsApi,
  });

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationReadApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
};

