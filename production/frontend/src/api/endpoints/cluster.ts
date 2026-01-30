import { apiClient } from '../client';
import type { ClusterStatus, NodeInfo } from '@/types';

export const clusterApi = {
  getStatus: async (): Promise<ClusterStatus> => {
    const { data } = await apiClient.get('/api/v1/cluster/status');
    return data;
  },

  getNodes: async (): Promise<{ nodes: NodeInfo[]; total: number }> => {
    const { data } = await apiClient.get('/api/v1/cluster/nodes');
    return data;
  },
};
