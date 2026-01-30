import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dkgApi } from '@/api';
import type { DkgInitiateRequest } from '@/types';

export function useDkgStatus() {
  return useQuery({
    queryKey: ['dkg', 'status'],
    queryFn: dkgApi.getStatus,
    refetchInterval: 10000,
  });
}

export function useInitiateDkg() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: DkgInitiateRequest) => dkgApi.initiate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dkg', 'status'] });
    },
  });
}
