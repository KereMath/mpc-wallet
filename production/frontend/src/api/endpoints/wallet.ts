import { apiClient } from '../client';
import type { WalletBalance, WalletAddress } from '@/types';

export const walletApi = {
  getBalance: async (): Promise<WalletBalance> => {
    const { data } = await apiClient.get('/api/v1/wallet/balance');
    return data;
  },

  getAddress: async (): Promise<WalletAddress> => {
    const { data } = await apiClient.get('/api/v1/wallet/address');
    return data;
  },
};
