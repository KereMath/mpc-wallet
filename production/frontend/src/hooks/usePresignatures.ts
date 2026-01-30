import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { presignaturesApi } from '@/api';

export function usePresigStatus(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['presignatures', 'status'],
    queryFn: presignaturesApi.getStatus,
    refetchInterval: options?.refetchInterval ?? 10000,
  });
}

export function useGeneratePresignatures() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (count: number) => presignaturesApi.generate(count),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presignatures', 'status'] });
    },
  });
}
