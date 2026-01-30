import { Link } from 'react-router-dom';
import { Card, Badge, PageSpinner } from '@/components/common';
import { useWalletBalance, useWalletAddress, useTransactions } from '@/hooks';
import { formatSatoshis, satoshisToBtc, formatRelativeTime } from '@/utils/formatters';
import type { TransactionState } from '@/types';

export function UserDashboard() {
  const { data: balance, isLoading: balanceLoading } = useWalletBalance();
  const { data: address } = useWalletAddress();
  const { data: txData } = useTransactions({ limit: 5 });

  if (balanceLoading) {
    return <PageSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-primary-600 to-primary-700 text-white">
        <div className="text-center py-4">
          <p className="text-primary-100 text-sm mb-1">Total Balance</p>
          <p className="text-4xl font-bold mb-1">
            {formatSatoshis(balance?.total || 0)} <span className="text-xl">sats</span>
          </p>
          <p className="text-primary-200">
            {satoshisToBtc(balance?.total || 0)} BTC
          </p>

          {(balance?.unconfirmed || 0) > 0 && (
            <div className="mt-4 pt-4 border-t border-primary-500">
              <div className="flex justify-center gap-8 text-sm">
                <div>
                  <p className="text-primary-200">Confirmed</p>
                  <p className="font-medium">{formatSatoshis(balance?.confirmed || 0)}</p>
                </div>
                <div>
                  <p className="text-primary-200">Pending</p>
                  <p className="font-medium">{formatSatoshis(balance?.unconfirmed || 0)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/user/send">
          <Card className="hover:border-primary-300 transition-colors cursor-pointer">
            <div className="flex flex-col items-center py-2">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-2">
                <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </div>
              <p className="font-medium text-gray-900">Send</p>
              <p className="text-xs text-gray-500">Transfer Bitcoin</p>
            </div>
          </Card>
        </Link>

        <Link to="/user/receive">
          <Card className="hover:border-primary-300 transition-colors cursor-pointer">
            <div className="flex flex-col items-center py-2">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
              </div>
              <p className="font-medium text-gray-900">Receive</p>
              <p className="text-xs text-gray-500">Get your address</p>
            </div>
          </Card>
        </Link>
      </div>

      {/* Wallet Address */}
      {address && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">Your Address</p>
            <Badge variant={address.address_type === 'p2tr' ? 'info' : 'default'} size="sm">
              {address.address_type === 'p2tr' ? 'Taproot' : 'SegWit'}
            </Badge>
          </div>
          <p className="font-mono text-sm bg-gray-50 p-3 rounded-lg break-all">
            {address.address}
          </p>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Recent Activity</h3>
          <Link to="/user/history" className="text-sm text-primary-600 hover:text-primary-700">
            View All
          </Link>
        </div>

        {txData?.transactions && txData.transactions.length > 0 ? (
          <div className="space-y-3">
            {txData.transactions.map((tx) => (
              <Link
                key={tx.txid}
                to={`/user/history`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500">No transactions yet</p>
            <p className="text-sm text-gray-400">Your transaction history will appear here</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function TxStatusBadge({ state }: { state: TransactionState }) {
  const variants: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    confirmed: 'success',
    signed: 'success',
    broadcasting: 'info',
    signing: 'info',
    pending: 'warning',
    voting: 'warning',
    failed: 'danger',
    rejected: 'danger',
  };

  return (
    <Badge variant={variants[state] || 'default'} size="sm">
      {state}
    </Badge>
  );
}
