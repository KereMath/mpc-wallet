import { Card, CardHeader, CardTitle, Badge, PageSpinner } from '@/components/common';
import { useClusterNodes, useClusterStatus } from '@/hooks';
import { formatRelativeTime } from '@/utils/formatters';

export function NodesPage() {
  const { data: clusterStatus } = useClusterStatus();
  const { data: nodesData, isLoading } = useClusterNodes({ refetchInterval: 10000 });

  if (isLoading) {
    return <PageSpinner />;
  }

  const nodes = nodesData?.nodes || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Node Management</h1>
        <Badge
          variant={
            clusterStatus?.status === 'healthy'
              ? 'success'
              : clusterStatus?.status === 'degraded'
              ? 'warning'
              : 'danger'
          }
        >
          {clusterStatus?.healthy_nodes || 0}/{clusterStatus?.total_nodes || 5} Healthy
        </Badge>
      </div>

      <p className="text-gray-600">
        Monitor the health and status of all MPC nodes in the cluster. Threshold: {clusterStatus?.threshold || 4}-of-{clusterStatus?.total_nodes || 5}.
      </p>

      {/* Node Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nodes.length > 0 ? (
          nodes.map((node) => (
            <Card key={node.node_id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      node.status === 'active'
                        ? 'bg-green-500'
                        : node.is_banned
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                    }`}
                  />
                  <CardTitle>Node {node.node_id}</CardTitle>
                </div>
                <NodeStatusBadge status={node.status} isBanned={node.is_banned} />
              </CardHeader>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Last Heartbeat</span>
                  <span className="text-gray-700">
                    {formatRelativeTime(node.last_heartbeat)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Seconds Since</span>
                  <span
                    className={`font-medium ${
                      node.seconds_since_heartbeat > 60 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {node.seconds_since_heartbeat.toFixed(0)}s
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Votes</span>
                  <span className="text-gray-700">{node.total_votes}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Violations</span>
                  <span
                    className={`font-medium ${
                      node.total_violations > 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {node.total_violations}
                  </span>
                </div>

                {node.is_banned && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 font-medium">Node is banned</p>
                    <p className="text-xs text-red-600 mt-1">
                      This node has been excluded from signing operations due to violations.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          ))
        ) : (
          // Placeholder nodes when backend is not connected
          [1, 2, 3, 4, 5].map((id) => (
            <Card key={id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                  <CardTitle>Node {id}</CardTitle>
                </div>
                <Badge variant="default">Offline</Badge>
              </CardHeader>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status</span>
                  <span className="text-gray-400">Not connected</span>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-500">
                    Start the backend to see node status
                  </p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Cluster Info */}
      <Card>
        <CardHeader>
          <CardTitle>Cluster Configuration</CardTitle>
        </CardHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Total Nodes</p>
            <p className="text-xl font-semibold">{clusterStatus?.total_nodes || 5}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Healthy Nodes</p>
            <p className="text-xl font-semibold text-green-600">
              {clusterStatus?.healthy_nodes || 0}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Threshold</p>
            <p className="text-xl font-semibold">{clusterStatus?.threshold || 4}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Byzantine Tolerance</p>
            <p className="text-xl font-semibold">
              {(clusterStatus?.total_nodes || 5) - (clusterStatus?.threshold || 4)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function NodeStatusBadge({ status, isBanned }: { status: string; isBanned: boolean }) {
  if (isBanned) return <Badge variant="danger">Banned</Badge>;
  if (status === 'active') return <Badge variant="success">Active</Badge>;
  return <Badge variant="default">Inactive</Badge>;
}
