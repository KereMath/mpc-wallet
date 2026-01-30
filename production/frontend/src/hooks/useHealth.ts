import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api';

interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}

export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async (): Promise<HealthResponse> => {
      const { data } = await apiClient.get('/health');
      return data;
    },
    refetchInterval: 10000,
    retry: 1,
    staleTime: 5000,
  });
}

export function useBackendStatus() {
  const { data, isError, isLoading } = useHealthCheck();

  return {
    isConnected: !isError && !!data,
    isLoading,
    status: data?.status || 'offline',
  };
}
