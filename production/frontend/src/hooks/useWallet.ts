import { useQuery } from '@tanstack/react-query';
import { walletApi } from '@/api';

export function useWalletBalance(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: walletApi.getBalance,
    refetchInterval: options?.refetchInterval ?? 30000,
    staleTime: 10000,
  });
}

export function useWalletAddress() {
  return useQuery({
    queryKey: ['wallet', 'address'],
    queryFn: walletApi.getAddress,
    staleTime: 60000 * 5, // 5 minutes - address rarely changes
  });
}
