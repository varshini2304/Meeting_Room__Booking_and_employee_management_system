import { useQuery } from "@tanstack/react-query";
import { getProfileApi } from "@/api/users";

export const useProfile = () =>
  useQuery({
    queryKey: ["profile"],
    queryFn: getProfileApi,
  });

