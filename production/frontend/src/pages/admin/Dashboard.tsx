import { Card, CardHeader, CardTitle, Badge, PageSpinner } from '@/components/common';
import { useClusterStatus, useClusterNodes, usePresigStatus, useTransactions } from '@/hooks';
import { formatRelativeTime, truncateTxid } from '@/utils/formatters';
import type { TransactionState } from '@/types';

export function AdminDashboard() {
  const { data: clusterStatus, isLoading: clusterLoading } = useClusterStatus();
  const { data: nodesData } = useClusterNodes();
  const { data: presigStatus } = usePresigStatus();
  const { data: txData } = useTransactions({ limit: 5 });

  if (clusterLoading) {
    return <PageSpinner />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cluster Status */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Cluster Status</p>
              <p className="text-2xl font-bold mt-1">
                {clusterStatus?.healthy_nodes || 0}/{clusterStatus?.total_nodes || 5}
              </p>
            </div>
            <StatusBadge status={clusterStatus?.status || 'critical'} />
          </div>
        </Card>

        {/* Threshold */}
        <Card>
          <div>
            <p className="text-sm text-gray-500">Threshold</p>
            <p className="text-2xl font-bold mt-1">
              {clusterStatus?.threshold || 4}-of-{clusterStatus?.total_nodes || 5}
            </p>
          </div>
        </Card>

        {/* Presig Pool */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Presig Pool</p>
              <p className="text-2xl font-bold mt-1">
                {presigStatus?.current_size || 0}
              </p>
            </div>
            <PoolHealthBadge
              isHealthy={presigStatus?.is_healthy ?? false}
              isCritical={presigStatus?.is_critical ?? true}
            />
          </div>
        </Card>

        {/* Transactions */}
        <Card>
          <div>
            <p className="text-sm text-gray-500">Total Transactions</p>
            <p className="text-2xl font-bold mt-1">{txData?.total || 0}</p>
          </div>
        </Card>
      </div>

      {/* Nodes Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Node Status</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {(nodesData?.nodes || []).map((node) => (
            <div
              key={node.node_id}
              className={`p-4 rounded-lg border-2 ${
                node.status === 'active'
                  ? 'border-green-200 bg-green-50'
                  : node.is_banned
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Node {node.node_id}</span>
                <div
                  className={`w-3 h-3 rounded-full ${
                    node.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
              </div>
              <p className="text-xs text-gray-500">
                Last seen: {formatRelativeTime(node.last_heartbeat)}
              </p>
              {node.total_violations > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  {node.total_violations} violations
                </p>
              )}
            </div>
          ))}
          {(!nodesData?.nodes || nodesData.nodes.length === 0) && (
            <>
              {[1, 2, 3, 4, 5].map((id) => (
                <div key={id} className="p-4 rounded-lg border-2 border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Node {id}</span>
                    <div className="w-3 h-3 rounded-full bg-gray-300" />
                  </div>
                  <p className="text-xs text-gray-400">Offline</p>
                </div>
              ))}
            </>
          )}
        </div>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        {txData?.transactions && txData.transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3 font-medium">TxID</th>
                  <th className="pb-3 font-medium">Recipient</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {txData.transactions.map((tx) => (
                  <tr key={tx.txid} className="text-sm">
                    <td className="py-3 font-mono">{truncateTxid(tx.txid)}</td>
                    <td className="py-3 font-mono text-gray-600">
                      {truncateTxid(tx.recipient, 6)}
                    </td>
                    <td className="py-3">{tx.amount_sats.toLocaleString()} sats</td>
                    <td className="py-3">
                      <TxStatusBadge state={tx.state} />
                    </td>
                    <td className="py-3 text-gray-500">
                      {formatRelativeTime(tx.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No transactions yet</p>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'success' | 'warning' | 'danger'> = {
    healthy: 'success',
    degraded: 'warning',
    critical: 'danger',
  };

  return (
    <Badge variant={variants[status] || 'danger'}>
      {status}
    </Badge>
  );
}

function PoolHealthBadge({ isHealthy, isCritical }: { isHealthy: boolean; isCritical: boolean }) {
  if (isCritical) return <Badge variant="danger">Critical</Badge>;
  if (isHealthy) return <Badge variant="success">Healthy</Badge>;
  return <Badge variant="warning">Low</Badge>;
}

function TxStatusBadge({ state }: { state: TransactionState }) {
  const variants: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
    confirmed: 'success',
    signed: 'success',
    broadcasting: 'info',
    signing: 'info',
    pending: 'warning',
    voting: 'warning',
    failed: 'danger',
    rejected: 'danger',
    aborted_byzantine: 'danger',
  };

  return (
    <Badge variant={variants[state] || 'default'} size="sm">
      {state.replace('_', ' ')}
    </Badge>
  );
}
