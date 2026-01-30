import { useState } from 'react';
import { Card, Badge, PageSpinner, Modal, Button } from '@/components/common';
import { useTransactions, useTransaction } from '@/hooks';
import { formatDate, formatRelativeTime, formatSatoshis, satoshisToBtc } from '@/utils/formatters';
import type { TransactionState } from '@/types';

export function HistoryPage() {
  const [selectedTxid, setSelectedTxid] = useState<string | null>(null);
  const { data, isLoading } = useTransactions({ limit: 50 });
  const { data: selectedTx } = useTransaction(selectedTxid || '');

  if (isLoading) {
    return <PageSpinner />;
  }

  const transactions = data?.transactions || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transaction History</h1>
        <Badge variant="info">{data?.total || 0} total</Badge>
      </div>

      {transactions.length > 0 ? (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <Card
              key={tx.txid}
              className="cursor-pointer hover:border-primary-300 transition-colors"
              padding="sm"
              onClick={() => setSelectedTxid(tx.txid)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Sent</p>
                    <p className="text-xs text-gray-500">{formatRelativeTime(tx.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">-{formatSatoshis(tx.amount_sats)}</p>
                  <TxStatusBadge state={tx.state} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Transactions</h3>
          <p className="text-gray-500">Your transaction history will appear here</p>
        </Card>
      )}

      {/* Transaction Detail Modal */}
      <Modal
        isOpen={selectedTxid !== null}
        onClose={() => setSelectedTxid(null)}
        title="Transaction Details"
      >
        {selectedTx && (
          <div className="space-y-4">
            {/* Status */}
            <div className="text-center py-4">
              <TxStatusIcon state={selectedTx.state} />
              <p className="font-medium mt-2 capitalize">{selectedTx.state.replace('_', ' ')}</p>
            </div>

            {/* Amount */}
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-900">
                -{formatSatoshis(selectedTx.amount_sats)} sats
              </p>
              <p className="text-gray-500">{satoshisToBtc(selectedTx.amount_sats)} BTC</p>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Transaction ID</p>
                <p className="font-mono text-xs break-all bg-gray-50 p-2 rounded">
                  {selectedTx.txid}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Recipient</p>
                <p className="font-mono text-xs break-all bg-gray-50 p-2 rounded">
                  {selectedTx.recipient}
                </p>
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
                  <p className="text-sm text-gray-500">Memo</p>
                  <p className="text-sm bg-gray-50 p-2 rounded">{selectedTx.metadata}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Created</p>
                  <p>{formatDate(selectedTx.created_at)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Updated</p>
                  <p>{formatDate(selectedTx.updated_at)}</p>
                </div>
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
    threshold_reached: { variant: 'info', label: 'Approved' },
    approved: { variant: 'info', label: 'Approved' },
    collecting: { variant: 'warning', label: 'Processing' },
    voting: { variant: 'warning', label: 'Voting' },
    pending: { variant: 'warning', label: 'Pending' },
    failed: { variant: 'danger', label: 'Failed' },
    rejected: { variant: 'danger', label: 'Rejected' },
    aborted_byzantine: { variant: 'danger', label: 'Aborted' },
  };

  const { variant, label } = config[state] || { variant: 'default', label: state };

  return <Badge variant={variant} size="sm">{label}</Badge>;
}

function TxStatusIcon({ state }: { state: TransactionState }) {
  const isSuccess = ['confirmed', 'signed'].includes(state);
  const isFailed = ['failed', 'rejected', 'aborted_byzantine'].includes(state);

  if (isSuccess) {
    return (
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
      <svg className="w-8 h-8 text-yellow-600 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>
  );
}
