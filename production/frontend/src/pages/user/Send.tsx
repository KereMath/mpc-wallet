import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Modal } from '@/components/common';
import { useWalletBalance, useCreateTransaction } from '@/hooks';
import { useUiStore } from '@/stores/uiStore';
import { formatSatoshis, satoshisToBtc, btcToSatoshis } from '@/utils/formatters';
import { validateBitcoinAddress, validateAmount } from '@/utils/validators';

export function SendPage() {
  const navigate = useNavigate();
  const { data: balance } = useWalletBalance();
  const createTransaction = useCreateTransaction();
  const { addToast } = useUiStore();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [amountUnit, setAmountUnit] = useState<'sats' | 'btc'>('sats');
  const [metadata, setMetadata] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const [recipientError, setRecipientError] = useState('');
  const [amountError, setAmountError] = useState('');

  // Convert amount to satoshis
  const amountInSats = amountUnit === 'btc'
    ? btcToSatoshis(parseFloat(amount) || 0)
    : parseInt(amount) || 0;

  // Estimated fee
  const estimatedFee = 1500;

  // Validate recipient
  useEffect(() => {
    if (recipient && !validateBitcoinAddress(recipient)) {
      setRecipientError('Invalid Bitcoin address');
    } else {
      setRecipientError('');
    }
  }, [recipient]);

  // Validate amount
  useEffect(() => {
    if (amount) {
      const error = validateAmount(amountInSats, (balance?.confirmed || 0) - estimatedFee);
      setAmountError(error || '');
    } else {
      setAmountError('');
    }
  }, [amount, amountInSats, balance]);

  const isValid =
    recipient &&
    !recipientError &&
    amountInSats > 0 &&
    !amountError;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      setShowConfirm(true);
    }
  };

  const handleConfirm = async () => {
    try {
      await createTransaction.mutateAsync({
        recipient,
        amount_sats: amountInSats,
        metadata: metadata || undefined,
      });

      addToast({ message: 'Transaction submitted successfully!', type: 'success' });
      navigate('/user/history');
    } catch {
      addToast({ message: 'Failed to create transaction', type: 'error' });
    }
    setShowConfirm(false);
  };

  const setMaxAmount = () => {
    const maxSats = (balance?.confirmed || 0) - estimatedFee;
    if (maxSats > 0) {
      if (amountUnit === 'sats') {
        setAmount(maxSats.toString());
      } else {
        setAmount(satoshisToBtc(maxSats));
      }
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Send Bitcoin</h1>

      {/* Balance Card */}
      <Card className="bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Available Balance</p>
            <p className="text-xl font-bold text-gray-900">
              {formatSatoshis(balance?.confirmed || 0)} sats
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={setMaxAmount}>
            Max
          </Button>
        </div>
      </Card>

      {/* Send Form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient */}
          <Input
            label="Recipient Address"
            placeholder="bc1q... or tb1q..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            error={recipientError}
            className="font-mono text-sm"
          />

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Amount</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={`px-2 py-1 text-xs rounded ${
                    amountUnit === 'sats'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  onClick={() => {
                    if (amountUnit === 'btc' && amount) {
                      setAmount(btcToSatoshis(parseFloat(amount)).toString());
                    }
                    setAmountUnit('sats');
                  }}
                >
                  Sats
                </button>
                <button
                  type="button"
                  className={`px-2 py-1 text-xs rounded ${
                    amountUnit === 'btc'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  onClick={() => {
                    if (amountUnit === 'sats' && amount) {
                      setAmount(satoshisToBtc(parseInt(amount)));
                    }
                    setAmountUnit('btc');
                  }}
                >
                  BTC
                </button>
              </div>
            </div>
            <Input
              type="number"
              placeholder={amountUnit === 'sats' ? '10000' : '0.0001'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={amountError}
              step={amountUnit === 'btc' ? '0.00000001' : '1'}
              min="0"
            />
            {amountUnit === 'btc' && amount && !amountError && (
              <p className="text-xs text-gray-500 mt-1">
                = {formatSatoshis(amountInSats)} sats
              </p>
            )}
          </div>

          {/* Metadata */}
          <Input
            label="Memo (optional)"
            placeholder="OP_RETURN data (max 80 bytes)"
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
            maxLength={80}
            helperText={`${metadata.length}/80 bytes`}
          />

          {/* Fee Display */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Amount</span>
              <span>{formatSatoshis(amountInSats)} sats</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Network Fee (estimated)</span>
              <span>{formatSatoshis(estimatedFee)} sats</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t">
              <span>Total</span>
              <span>{formatSatoshis(amountInSats + estimatedFee)} sats</span>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            fullWidth
            disabled={!isValid}
            loading={createTransaction.isPending}
          >
            Review Transaction
          </Button>
        </form>
      </Card>

      {/* Confirmation Modal */}
      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title="Confirm Transaction">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">To</p>
            <p className="font-mono text-sm break-all bg-gray-50 p-2 rounded">{recipient}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <p className="font-bold text-lg">{formatSatoshis(amountInSats)} sats</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fee</p>
              <p className="font-medium">{formatSatoshis(estimatedFee)} sats</p>
            </div>
          </div>

          {metadata && (
            <div>
              <p className="text-sm text-gray-500">Memo</p>
              <p className="text-sm bg-gray-50 p-2 rounded">{metadata}</p>
            </div>
          )}

          <div className="bg-primary-50 p-4 rounded-lg">
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{formatSatoshis(amountInSats + estimatedFee)} sats</span>
            </div>
            <p className="text-xs text-primary-600 mt-1">
              {satoshisToBtc(amountInSats + estimatedFee)} BTC
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowConfirm(false)} fullWidth>
              Cancel
            </Button>
            <Button onClick={handleConfirm} loading={createTransaction.isPending} fullWidth>
              Confirm & Send
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
