import { useMutation } from "@tanstack/react-query";
import { createUserApi } from "@/api/users";

export const useCreateUser = () =>
  useMutation({
    mutationFn: createUserApi,
  });

