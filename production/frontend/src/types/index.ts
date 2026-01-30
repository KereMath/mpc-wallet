// Auth types
export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  createdAt?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// Cluster types
export interface ClusterStatus {
  total_nodes: number;
  healthy_nodes: number;
  threshold: number;
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
}

export interface NodeInfo {
  node_id: number;
  status: 'active' | 'inactive' | 'banned';
  last_heartbeat: string;
  total_votes: number;
  total_violations: number;
  seconds_since_heartbeat: number;
  is_banned: boolean;
}

// Wallet types
export interface WalletBalance {
  confirmed: number;
  unconfirmed: number;
  total: number;
}

export interface WalletAddress {
  address: string;
  address_type: 'p2wpkh' | 'p2tr';
}

// Transaction types
export type TransactionState =
  | 'pending'
  | 'voting'
  | 'collecting'
  | 'threshold_reached'
  | 'approved'
  | 'rejected'
  | 'signing'
  | 'signed'
  | 'submitted'
  | 'broadcasting'
  | 'confirmed'
  | 'failed'
  | 'aborted_byzantine';

export interface Transaction {
  txid: string;
  state: TransactionState;
  recipient: string;
  amount_sats: number;
  fee_sats: number;
  metadata?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionRequest {
  recipient: string;
  amount_sats: number;
  metadata?: string;
}

export interface CreateTransactionResponse {
  txid: string;
  state: TransactionState;
  recipient: string;
  amount_sats: number;
  fee_sats: number;
  metadata?: string;
  created_at: string;
}

export interface ListTransactionsResponse {
  transactions: Transaction[];
  total: number;
}

// DKG types
export interface DkgInitiateRequest {
  protocol: 'cggmp24' | 'frost';
  threshold: number;
  total_nodes: number;
}

export interface DkgResponse {
  success: boolean;
  session_id: string;
  protocol: string;
  public_key?: string;
  address?: string;
  threshold: number;
  total_nodes: number;
}

export interface DkgStatus {
  active_ceremonies: number;
  total_completed: number;
  cggmp24_public_key?: string;
  frost_public_key?: string;
  cggmp24_address?: string;
  frost_address?: string;
}

// Aux Info types
export interface AuxInfoGenerateRequest {
  num_parties: number;
  participants: number[];
}

export interface AuxInfoStatus {
  has_aux_info: boolean;
  latest_session_id?: string;
  aux_info_size_bytes: number;
  total_ceremonies: number;
}

// Presignature types
export interface PresigStatus {
  current_size: number;
  target_size: number;
  max_size: number;
  utilization: number;
  is_healthy: boolean;
  is_critical: boolean;
  hourly_usage: number;
  total_generated: number;
  total_used: number;
}

export interface GeneratePresigRequest {
  count: number;
}

export interface GeneratePresigResponse {
  generated: number;
  new_pool_size: number;
  duration_ms: number;
}
