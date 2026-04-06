import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InsertSupplement, SelectSupplement } from "@db/schema";
import { useUser } from "./use-user";

export function useSupplements() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const today = new Date().toISOString().split('T')[0];

  // Query for active supplements
  const supplements = useQuery<SelectSupplement[]>({
    queryKey: ["/api/supplements", user?.id],
    queryFn: async () => {
      const response = await fetch("/api/supplements", {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error('Failed to fetch supplements');
      }
      return response.json();
    },
    enabled: !!user,
    retry: 2,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const addSupplement = useMutation<SelectSupplement, Error, InsertSupplement>({
    mutationFn: async (supplement) => {
      const res = await fetch("/api/supplements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplement),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplements"] });
      queryClient.invalidateQueries({ queryKey: ['supplement-logs', today] });
    },
  });

  const updateSupplement = useMutation<
    SelectSupplement,
    Error,
    { id: number; data: Partial<InsertSupplement> }
  >({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/supplements/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplements"] });
      queryClient.invalidateQueries({ queryKey: ['supplement-logs', today] });
    },
  });

  const deleteSupplement = useMutation<void, Error, number>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/supplements/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete supplement");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplements"] });
      queryClient.invalidateQueries({ queryKey: ['supplement-logs', today] });
    },
  });

  return {
    supplements: supplements.data ?? [],
    isLoading: supplements.isLoading,
    error: supplements.error,
    addSupplement: addSupplement.mutateAsync,
    updateSupplement: updateSupplement.mutateAsync,
    deleteSupplement: deleteSupplement.mutateAsync,
  };
}
