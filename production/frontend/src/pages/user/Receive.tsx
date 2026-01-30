import { QRCodeSVG } from 'qrcode.react';
import { Card, Button, Badge, PageSpinner } from '@/components/common';
import { useWalletAddress } from '@/hooks';
import { useUiStore } from '@/stores/uiStore';

export function ReceivePage() {
  const { data: addressInfo, isLoading } = useWalletAddress();
  const { addToast } = useUiStore();

  const copyAddress = async () => {
    if (addressInfo?.address) {
      try {
        await navigator.clipboard.writeText(addressInfo.address);
        addToast({ message: 'Address copied to clipboard!', type: 'success' });
      } catch {
        addToast({ message: 'Failed to copy address', type: 'error' });
      }
    }
  };

  if (isLoading) {
    return <PageSpinner />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Receive Bitcoin</h1>

      <Card className="text-center">
        {/* QR Code */}
        <div className="inline-block p-4 bg-white rounded-2xl shadow-inner mb-4">
          {addressInfo?.address ? (
            <QRCodeSVG
              value={`bitcoin:${addressInfo.address}`}
              size={200}
              level="H"
              includeMargin
            />
          ) : (
            <div className="w-[200px] h-[200px] bg-gray-100 rounded flex items-center justify-center">
              <p className="text-gray-400">No address available</p>
            </div>
          )}
        </div>

        {/* Address Type */}
        <div className="mb-4">
          <Badge variant={addressInfo?.address_type === 'p2tr' ? 'info' : 'default'}>
            {addressInfo?.address_type === 'p2tr' ? 'Taproot (P2TR)' : 'Native SegWit (P2WPKH)'}
          </Badge>
        </div>

        {/* Address */}
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">Your Bitcoin Address</p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-mono text-sm break-all">
              {addressInfo?.address || 'Address not available'}
            </p>
          </div>
        </div>

        {/* Copy Button */}
        <Button onClick={copyAddress} fullWidth disabled={!addressInfo?.address}>
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Copy Address
        </Button>
      </Card>

      {/* Testnet Faucet */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="font-medium text-blue-800 mb-1">Get Testnet Bitcoin</h3>
            <p className="text-sm text-blue-700 mb-3">
              For testing, get free testnet BTC from these faucets:
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://coinfaucet.eu/en/btc-testnet/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm font-medium rounded-lg transition-colors"
              >
                Coinfaucet.eu
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <a
                href="https://bitcoinfaucet.uo1.net/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm font-medium rounded-lg transition-colors"
              >
                Bitcoin Faucet
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <a
                href="https://testnet-faucet.mempool.co/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm font-medium rounded-lg transition-colors"
              >
                Mempool Faucet
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </Card>

      {/* Info Card */}
      <Card className="bg-yellow-50 border-yellow-200">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-yellow-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="font-medium text-yellow-800 mb-1">Important Information</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>Only send Bitcoin (BTC) to this address</li>
              <li>Minimum confirmations: 1 for display, 6 for full security</li>
              <li>This is a threshold wallet requiring multi-party signing</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* How it Works */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-3">How MPC Wallet Works</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex gap-3">
            <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-xs flex-shrink-0">
              1
            </div>
            <p>Your Bitcoin is secured by distributed key shares across multiple nodes</p>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-xs flex-shrink-0">
              2
            </div>
            <p>Transactions require threshold signatures (4-of-5 nodes must agree)</p>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-xs flex-shrink-0">
              3
            </div>
            <p>No single node can access your funds - true decentralized security</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
