import { useQuery } from "@tanstack/react-query";
import { fetchRegistrationAvailability } from "../api/auth";

export function useRegistrationAvailability() {
  return useQuery({
    queryKey: ["registration-availability"],
    queryFn: fetchRegistrationAvailability,
    staleTime: 30_000,
    retry: false,
  });
}
