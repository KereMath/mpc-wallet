import { useState } from 'react';
import { Card, CardHeader, CardTitle, Badge, PageSpinner, Modal, Button } from '@/components/common';
import { useTransactions, useTransaction } from '@/hooks';
import { formatDate, formatRelativeTime, truncateTxid, truncateAddress, formatSatoshis } from '@/utils/formatters';
import type { TransactionState } from '@/types';

export function TransactionsPage() {
  const [selectedTxid, setSelectedTxid] = useState<string | null>(null);
  const { data, isLoading } = useTransactions({ limit: 100 });
  const { data: selectedTx } = useTransaction(selectedTxid || '');

  if (isLoading) {
    return <PageSpinner />;
  }

  const transactions = data?.transactions || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <Badge variant="info">{data?.total || 0} total</Badge>
      </div>

      <p className="text-gray-600">
        View and monitor all transactions across the MPC wallet cluster.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold mt-1">{data?.total || 0}</p>
          </div>
        </Card>
        <Card>
          <div>
            <p className="text-sm text-gray-500">Confirmed</p>
            <p className="text-2xl font-bold mt-1 text-green-600">
              {transactions.filter((t) => t.state === 'confirmed').length}
            </p>
          </div>
        </Card>
        <Card>
          <div>
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold mt-1 text-yellow-600">
              {transactions.filter((t) => ['pending', 'voting', 'signing'].includes(t.state)).length}
            </p>
          </div>
        </Card>
        <Card>
          <div>
            <p className="text-sm text-gray-500">Failed</p>
            <p className="text-2xl font-bold mt-1 text-red-600">
              {transactions.filter((t) => ['failed', 'rejected', 'aborted_byzantine'].includes(t.state)).length}
            </p>
          </div>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
        </CardHeader>

        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3 font-medium">TxID</th>
                  <th className="pb-3 font-medium">Recipient</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Fee</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Created</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((tx) => (
                  <tr key={tx.txid} className="text-sm hover:bg-gray-50">
                    <td className="py-3 font-mono">{truncateTxid(tx.txid)}</td>
                    <td className="py-3 font-mono text-gray-600">{truncateAddress(tx.recipient, 6)}</td>
                    <td className="py-3">{formatSatoshis(tx.amount_sats)} sats</td>
                    <td className="py-3 text-gray-500">{formatSatoshis(tx.fee_sats)} sats</td>
                    <td className="py-3">
                      <TxStatusBadge state={tx.state} />
                    </td>
                    <td className="py-3 text-gray-500">{formatRelativeTime(tx.created_at)}</td>
                    <td className="py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTxid(tx.txid)}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <svg
              className="w-12 h-12 text-gray-300 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-gray-500">No transactions yet</p>
            <p className="text-sm text-gray-400 mt-1">Transactions will appear here once created</p>
          </div>
        )}
      </Card>

      {/* Transaction Detail Modal */}
      <Modal
        isOpen={selectedTxid !== null}
        onClose={() => setSelectedTxid(null)}
        title="Transaction Details"
        size="lg"
      >
        {selectedTx && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Transaction ID</p>
              <p className="font-mono text-sm break-all">{selectedTx.txid}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <TxStatusBadge state={selectedTx.state} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Amount</p>
                <p className="font-medium">{formatSatoshis(selectedTx.amount_sats)} sats</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500">Recipient</p>
              <p className="font-mono text-sm break-all">{selectedTx.recipient}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Fee</p>
                <p className="font-medium">{formatSatoshis(selectedTx.fee_sats)} sats</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="font-medium">
                  {formatSatoshis(selectedTx.amount_sats + selectedTx.fee_sats)} sats
                </p>
              </div>
            </div>

            {selectedTx.metadata && (
              <div>
                <p className="text-sm text-gray-500">Metadata (OP_RETURN)</p>
                <p className="font-mono text-sm bg-gray-100 p-2 rounded">{selectedTx.metadata}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-sm">{formatDate(selectedTx.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Updated</p>
                <p className="text-sm">{formatDate(selectedTx.updated_at)}</p>
              </div>
            </div>

            <Button variant="secondary" onClick={() => setSelectedTxid(null)} fullWidth>
              Close
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TxStatusBadge({ state }: { state: TransactionState }) {
  const config: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; label: string }> = {
    confirmed: { variant: 'success', label: 'Confirmed' },
    signed: { variant: 'success', label: 'Signed' },
    broadcasting: { variant: 'info', label: 'Broadcasting' },
    submitted: { variant: 'info', label: 'Submitted' },
    signing: { variant: 'info', label: 'Signing' },
    threshold_reached: { variant: 'info', label: 'Threshold Reached' },
    approved: { variant: 'info', label: 'Approved' },
    collecting: { variant: 'warning', label: 'Collecting' },
    voting: { variant: 'warning', label: 'Voting' },
    pending: { variant: 'warning', label: 'Pending' },
    failed: { variant: 'danger', label: 'Failed' },
    rejected: { variant: 'danger', label: 'Rejected' },
    aborted_byzantine: { variant: 'danger', label: 'Aborted (Byzantine)' },
  };

  const { variant, label } = config[state] || { variant: 'default', label: state };

  return <Badge variant={variant}>{label}</Badge>;
}
