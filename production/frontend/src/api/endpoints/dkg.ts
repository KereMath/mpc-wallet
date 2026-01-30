import { apiClient } from '../client';
import type { DkgInitiateRequest, DkgResponse, DkgStatus } from '@/types';

export const dkgApi = {
  initiate: async (payload: DkgInitiateRequest): Promise<DkgResponse> => {
    const { data } = await apiClient.post('/api/v1/dkg/initiate', payload);
    return data;
  },

  join: async (sessionId: string): Promise<DkgResponse> => {
    const { data } = await apiClient.post(`/api/v1/dkg/join/${sessionId}`);
    return data;
  },

  getStatus: async (): Promise<DkgStatus> => {
    const { data } = await apiClient.get('/api/v1/dkg/status');
    return data;
  },
};
