import { apiClient } from '../client';
import type {
  Transaction,
  CreateTransactionRequest,
  CreateTransactionResponse,
  ListTransactionsResponse,
} from '@/types';

export const transactionsApi = {
  create: async (payload: CreateTransactionRequest): Promise<CreateTransactionResponse> => {
    const { data } = await apiClient.post('/api/v1/transactions', payload);
    return data;
  },

  getById: async (txid: string): Promise<Transaction> => {
    const { data } = await apiClient.get(`/api/v1/transactions/${txid}`);
    return data;
  },

  list: async (params?: { limit?: number; offset?: number }): Promise<ListTransactionsResponse> => {
    const { data } = await apiClient.get('/api/v1/transactions', { params });
    return data;
  },
};
