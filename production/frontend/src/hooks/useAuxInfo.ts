import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auxInfoApi } from '@/api';

export function useAuxInfoStatus() {
  return useQuery({
    queryKey: ['auxInfo', 'status'],
    queryFn: auxInfoApi.getStatus,
    refetchInterval: 10000,
  });
}

export function useGenerateAuxInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => auxInfoApi.generate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auxInfo', 'status'] });
    },
  });
}
