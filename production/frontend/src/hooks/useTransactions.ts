import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi } from '@/api';
import type { CreateTransactionRequest } from '@/types';

export function useTransactions(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => transactionsApi.list(params),
    refetchInterval: 15000,
  });
}

export function useTransaction(txid: string) {
  return useQuery({
    queryKey: ['transaction', txid],
    queryFn: () => transactionsApi.getById(txid),
    refetchInterval: 5000,
    enabled: !!txid,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTransactionRequest) => transactionsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
    },
  });
}
