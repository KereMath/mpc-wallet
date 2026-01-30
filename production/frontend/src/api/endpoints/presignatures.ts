import { apiClient } from '../client';
import type { PresigStatus, GeneratePresigResponse } from '@/types';

export const presignaturesApi = {
  getStatus: async (): Promise<PresigStatus> => {
    const { data } = await apiClient.get('/api/v1/presignatures/status');
    return data;
  },

  generate: async (count: number): Promise<GeneratePresigResponse> => {
    const { data } = await apiClient.post('/api/v1/presignatures/generate', { count });
    return data;
  },
};
