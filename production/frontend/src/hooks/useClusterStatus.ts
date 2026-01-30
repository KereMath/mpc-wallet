import { useQuery } from '@tanstack/react-query';
import { clusterApi } from '@/api';

export function useClusterStatus(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['cluster', 'status'],
    queryFn: clusterApi.getStatus,
    refetchInterval: options?.refetchInterval ?? 10000,
    staleTime: 5000,
  });
}

export function useClusterNodes(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['cluster', 'nodes'],
    queryFn: clusterApi.getNodes,
    refetchInterval: options?.refetchInterval ?? 30000,
    staleTime: 10000,
  });
}
