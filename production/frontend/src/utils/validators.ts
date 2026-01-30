// Validate Bitcoin address (basic check for testnet and mainnet)
export function validateBitcoinAddress(address: string): boolean {
  if (!address) return false;

  // Mainnet P2PKH (legacy)
  if (/^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return true;

  // Mainnet P2SH
  if (/^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return true;

  // Mainnet Bech32 (native segwit)
  if (/^bc1[a-z0-9]{39,59}$/.test(address)) return true;

  // Testnet P2PKH
  if (/^[mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return true;

  // Testnet P2SH
  if (/^2[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return true;

  // Testnet Bech32
  if (/^tb1[a-z0-9]{39,59}$/.test(address)) return true;

  // Regtest Bech32
  if (/^bcrt1[a-z0-9]{39,59}$/.test(address)) return true;

  return false;
}

// Validate amount in satoshis
export function validateAmount(amount: number, maxAmount: number): string | null {
  if (isNaN(amount) || amount <= 0) {
    return 'Amount must be greater than 0';
  }
  if (amount < 546) {
    return 'Amount is below dust threshold (546 sats)';
  }
  if (amount > maxAmount) {
    return 'Insufficient balance';
  }
  return null;
}

// Validate metadata (OP_RETURN)
export function validateMetadata(metadata: string): string | null {
  if (metadata.length > 80) {
    return 'Metadata must be 80 bytes or less';
  }
  return null;
}
