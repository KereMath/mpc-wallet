import { apiClient } from '../client';
import type { AuxInfoGenerateRequest, AuxInfoStatus } from '@/types';

export const auxInfoApi = {
  generate: async (payload?: AuxInfoGenerateRequest): Promise<{ success: boolean; session_id: string }> => {
    const defaultPayload = payload || {
      num_parties: 5,
      participants: [1, 2, 3, 4, 5],
    };
    const { data } = await apiClient.post('/api/v1/aux-info/generate', defaultPayload);
    return data;
  },

  getStatus: async (): Promise<AuxInfoStatus> => {
    const { data } = await apiClient.get('/api/v1/aux-info/status');
    return data;
  },
};
