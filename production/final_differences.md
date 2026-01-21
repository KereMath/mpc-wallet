# 🎯 MPC Wallet: Mevcut Sistem vs Project Proposal - Eksiksiz Fark Analizi

**Tarih:** 2026-01-21
**Analiz Eden:** Claude Sonnet 4.5
**Amaç:** `detailedplan.md` ve `FUTURE_IMPROVEMENTS.md` görevleri tamamlandıktan sonra `project_proposal.md`'nin tam implementasyonuna geçebilmek için eksik kalan bileşenlerin detaylı envanteri

---

## 📋 Executive Summary (Yönetici Özeti)

### ✅ Mevcut Durumda Yapılması Planlanan (FUTURE_IMPROVEMENTS.md)

**Priority 0-3 (MVP):** ~10-15 gün
- ✅ **DKG (Distributed Key Generation):** CGGMP24 + FROST için 5 düğüm üzerinde anahtar üretimi
- ✅ **Presignature Pool:** 100 adet ön-imza havuzu (background generation)
- ✅ **CGGMP24 Real Signing:** Mock'ları kaldırıp gerçek Bitcoin ECDSA imzaları
- ✅ **FROST Signing:** Taproot desteği için Schnorr imzaları
- ✅ **QUIC Vote Broadcasting:** Otomatik oylamalı konsensüs

**Sonuç:** Bitcoin testnet'te **çalışan bir MPC cüzdan** (SegWit + Taproot desteği)

---

### ❌ Proposal'a Geçiş İçin Eksik Kalan Kritik Sistemler

Mevcut sistem **Bitcoin odaklı basit bir MPC cüzdan** iken, Proposal **TÜBİTAK uyumlu, kurumsal KVHS (Kripto Varlık Hizmet Sağlayıcısı) altyapısı** talep ediyor.

**Kritik Farklar:**

| Kategori | Mevcut (Bitcoin MVP) | Proposal (KVHS Altyapısı) | Fark Büyüklüğü |
|----------|---------------------|---------------------------|----------------|
| **Kapsam** | Sadece Bitcoin (SegWit+Taproot) | Çoklu blokzincir (Ethereum, Avalanche, Polygon, BNB Chain) | 🔴 **BÜYÜK** |
| **Kullanıcı Modeli** | Tek kullanıcı / Basit transfer | Platform müşterileri + Yatırma adresleri + Otomatik süpürme | 🔴 **BÜYÜK** |
| **Yetkilendirme** | Basit API key | FIPS 140-2 HSM + Akıllı kart + Eşik yönetici onayı | 🔴 **BÜYÜK** |
| **Politika Motoru** | Manuel SQL kuralları | PolicyEngine (TEE içinde, eşik imza ile güncellenebilir) | 🔴 **BÜYÜK** |
| **Zincir İzleme** | Yok (manuel UTXO kontrolü) | ChainMonitor (RPC/WebSocket, otomatik süpürme) | 🔴 **BÜYÜK** |
| **İşlem Yaşam Döngüsü** | Basit state machine | 9-aşamalı FSM (PENDING → APPROVAL → CONFIRMED + RBF) | 🟡 **ORTA** |
| **Yedekleme** | PostgreSQL + etcd | BackupNet (RAFT konsensüs, SMT merkle tree, audit trail) | 🟡 **ORTA** |
| **Felaket Kurtarma** | Manuel | Fiziksel akıllı kartlar + KVHS yetkili onaylı restorasyon | 🟡 **ORTA** |
| **Uyumluluk** | Yok | SPK/TÜBİTAK kriterleri (Madde 6, 11), KYT/OFAC | 🔴 **BÜYÜK** |

**Toplam Eksik İş Yükü:** ~40-60 gün (1-2 geliştirici x 2-3 ay)

---

## 🏗️ BÖLÜM 1: Mimari Seviye Farklar

### 1.1. Sistem Bileşenleri Karşılaştırması

#### ✅ Mevcut Sistemde VAR:
```
┌─────────────────────────────────────┐
│  REST API (Axum)                    │  ✅ Var (transaction + health endpoints)
│  └─ Transaction Handler             │  ✅ Var (create/sign/broadcast)
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Transaction Orchestrator           │  ✅ Var (lifecycle FSM)
│  ├─ State Machine (pending→signed)  │  ✅ Var (otomatik geçişler)
│  ├─ Vote Aggregation                │  ✅ Var (4-of-5 threshold)
│  └─ Byzantine Detection             │  ✅ Var (database constraints)
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  MPCnet (5 nodes, QUIC+mTLS)        │  ✅ Var (quinn + rustls)
│  ├─ CGGMP24 Protocol                │  ⏸️ Kod var, entegre DEĞİL
│  └─ FROST Protocol                  │  ⏸️ Kod var, entegre DEĞİL
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Storage Layer                      │
│  ├─ PostgreSQL (9 tables)           │  ✅ Var (audit logs)
│  └─ etcd (coordination)             │  ✅ Var (distributed locks)
└─────────────────────────────────────┘
```

#### ❌ Proposal'da OLMASI GEREKEN Ancak ŞU ANDA YOK:

```
┌─────────────────────────────────────────────────────────────────────┐
│  APIGateway (TLS Termination + Rate Limit)                          │  ❌ YOK
│  ├─ FIPS 140-2 Hardware Token Auth                                  │  ❌ YOK
│  ├─ MDM Entegrasyonu (Mobil Cihaz Yönetimi)                         │  ❌ YOK
│  ├─ Rate Limiting (per-user, global)                                │  ⚠️ Basit versiyon var
│  └─ Request Signing (sk_api)                                        │  ❌ YOK
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│  PolicyEngine (TEE içinde, RAFT konsensüs)                          │  ❌ TAMAMEN YOK
│  ├─ Kullanıcı Kuralları (Whitelist, Daily Limit, TX Limit)          │  ❌ YOK
│  ├─ KVHS Kuralları (KYT Level, Global Blacklist, System Fee)        │  ❌ YOK
│  ├─ Yönetici Eşik İmzası ile Kural Güncelleme                       │  ❌ YOK
│  ├─ Manuel Onay Sırası (PENDING_APPROVAL state)                     │  ❌ YOK
│  ├─ ChainMonitor Süpürme Emirleri                                   │  ❌ YOK
│  └─ Gas Injection Logic                                             │  ❌ YOK
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│  ChainMonitor (Blokzincir İzleme + Otomatik Süpürme)                │  ❌ TAMAMEN YOK
│  ├─ Deposit Adresleri Listesi (Milyonlarca)                         │  ❌ YOK
│  ├─ RPC/WebSocket Dinleyicisi (Ethereum, Avalanche, BNB, Polygon)   │  ❌ YOK
│  ├─ Balance Threshold Kontrolü (SWEEP_THRESHOLD)                    │  ❌ YOK
│  ├─ Native Token Bakiye Kontrolü (Gas Check)                        │  ❌ YOK
│  ├─ Gas Tank Yönetimi (Merkezi havuzdan gas gönderimi)              │  ❌ YOK
│  └─ Sweep Trigger (PolicyEngine'e güvenli iç ağ emri)               │  ❌ YOK
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│  MPCnet (Protokol Çeşitliliği)                                      │  ⚠️ KISMI
│  ├─ Bitcoin (CGGMP24 + FROST)                                       │  ⏸️ Kod hazır (entegre değil)
│  ├─ Ethereum (CGGMP24 için EIP-155 imza)                            │  ❌ YOK
│  ├─ Avalanche C-Chain (EVM uyumlu)                                  │  ❌ YOK
│  ├─ Polygon (EVM uyumlu)                                            │  ❌ YOK
│  └─ BNB Chain (EVM uyumlu)                                          │  ❌ YOK
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│  TxObserver (İşlem Takip + RBF Mekanizması)                         │  ❌ TAMAMEN YOK
│  ├─ Broadcast Queue (Nonce Yönetimi)                                │  ❌ YOK
│  ├─ Receipt Polling (eth_getTransactionReceipt)                     │  ❌ YOK
│  ├─ Stuck Detection (Mempool'da takılı işlemler)                    │  ❌ YOK
│  ├─ RBF (Replace-By-Fee: Gas fiyatı artırma)                        │  ❌ YOK
│  ├─ Webhook Notifications (Platform API'sine bildirim)              │  ❌ YOK
│  └─ Confirmation Monitoring (1/6/12 konfirmasyon)                   │  ❌ YOK
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│  BackupNet (Gelişmiş Yedekleme)                                     │  ⚠️ TEMEL VAR
│  ├─ PostgreSQL                                                      │  ✅ Var (transaction logs)
│  ├─ RAFT Konsensüs                                                  │  ❌ YOK (sadece etcd var)
│  ├─ Sparse Merkle Tree (SMT)                                        │  ❌ YOK
│  ├─ Fiziksel Anahtar Yedeği (Akıllı Kart)                           │  ❌ YOK
│  ├─ HSM Şifreli Yedekler                                            │  ❌ YOK
│  └─ Audit Trail (Yetkili Sorgulama)                                 │  ❌ YOK
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 BÖLÜM 2: Protokol ve Kriptografi Farkları

### 2.1. DKG (Distributed Key Generation)

#### ✅ Mevcut Plan (FUTURE_IMPROVEMENTS.md - Priority 0):
```rust
// SADECE Bitcoin için, TEK kök anahtar
DkgService::run_cggmp24_dkg(threshold: 4, total: 5) -> PublicKey
DkgService::run_frost_dkg(threshold: 4, total: 5) -> PublicKey

// Output:
// - sk_j^root (her düğümde)
// - pk^root (ortak public key)
```

#### ❌ Proposal Gereksinimi:
```rust
// ÇOKLU BLOKZİNCİR için, herbir chain için AYRI kök anahtar
DkgService::run_multi_chain_dkg(
    chains: vec![
        ChainID::Bitcoin,
        ChainID::EthereumMainnet,
        ChainID::AvalancheCChain,
        ChainID::PolygonMainnet,
        ChainID::BNBChain,
    ],
    threshold: 4,
    total: 5,
) -> HashMap<ChainID, PublicKey>

// Output PER CHAIN:
// - sk_j^{ChainID, root} (her düğüm, her chain için)
// - pk^{ChainID, root} (her chain için ortak public key)

// AYRICA: Admin Policy Key (PolicyEngine güncellemeleri için)
DkgService::run_policy_dkg(
    admins: N, // KVHS yetkilileri
    threshold: k, // Eşik (örn: 2-of-3)
) -> (sk_j^admin, pk^admin)
```

**Fark:**
- Bitcoin MVP: **1 DKG seremoni** (tek chain)
- Proposal: **5 chain + 1 admin = 6 DKG seremoni**
- **Ek İş:** ~3-4 gün (her chain için test + entegrasyon)

---

### 2.2. Hierarchical Deterministic (HD) Wallet - L2 Türetme

#### ✅ Mevcut Plan:
```rust
// Basit: Kullanıcı başına 1 cüzdan
derive_user_wallet(
    sk_j^root,
    user_id: String,
    chain: ChainID,
) -> (sk_j^user, pk^user, address)
```

#### ❌ Proposal Gereksinimi:
```rust
// İKİ TİP CÜZDAN:

// 1. Personal Wallet (Bireysel kullanıcı - TEK adres)
derive_personal_wallet(
    sk_j^{ChainID, root},
    cred_user: String,
    wallet_type: WalletType::Personal,
    end_user_id: None,
    counter: u32,
) -> (sk_j^{ChainID, user, ctr}, pk^user, address)

// 2. Deposit Wallet (Platform müşterisi - MİLYONLARCA adres)
derive_deposit_wallet(
    sk_j^{ChainID, root},
    cred_user: String, // Platform ID'si
    wallet_type: WalletType::Deposit,
    end_user_id: Some("platform_customer_12345"),
    counter: u32, // Her müşteri için benzersiz
) -> (sk_j^{ChainID, deposit, end_user_id, ctr}, pk^deposit, address)

// METADATA KAYDI (BackupNet'e):
WalletMetadata {
    pk_root: pk^{ChainID, root},
    cred_user: "platform_xyz",
    chain_id: ChainID::Ethereum,
    wallet_type: WalletType::Deposit,
    end_user_id: "customer_12345",
    counter: 42,
    address: "0x1234...",
    created_at: Timestamp,
}
```

**Yeni Gereksinimler:**
1. ✅ **WalletType enum** (Personal vs Deposit)
2. ✅ **EndUserID** (platform müşterisi ID'si)
3. ✅ **Metadata Registry** (BackupNet'te L^meta listesi)
4. ✅ **ChainMonitor'a Otomatik Kayıt** (Deposit adresleri)

**Ek İş:** ~2-3 gün

---

### 2.3. İmzalama Protokolü - Çoklu Blokzincir Desteği

#### ✅ Mevcut Plan (Bitcoin Only):
```rust
// CGGMP24: Bitcoin ECDSA (SegWit)
cggmp24_sign(
    presignature: Presignature,
    message_hash: [u8; 32], // Bitcoin sighash
    key_share: KeyShare,
) -> EcdsaSignature

// FROST: Bitcoin Schnorr (Taproot)
frost_sign(
    message_hash: [u8; 32],
    key_share: FrostKeyShare,
) -> SchnorrSignature
```

#### ❌ Proposal Gereksinimi:
```rust
// Ethereum ve EVM Zincirleri için:
// - CGGMP24 kullanılır (ECDSA)
// - ANCAK: EIP-155 formatı (chain_id dahil)
// - ANCAK: Keccak256 hash (Bitcoin'de SHA256)
// - ANCAK: v, r, s formatı (recovery ID)

ethereum_sign(
    presignature: Presignature,
    tx: EthereumTransaction, // RLP encoded
    chain_id: u64, // EIP-155
    key_share: KeyShare,
) -> EthereumSignature { v, r, s }

// Bitcoin için aynı:
bitcoin_sign(...) -> BitcoinSignature

// Avalanche C-Chain (EVM uyumlu):
avalanche_sign(...) -> EthereumSignature

// Polygon (EVM uyumlu):
polygon_sign(...) -> EthereumSignature

// BNB Chain (EVM uyumlu):
bnb_sign(...) -> EthereumSignature
```

**Yeni Kütüphaneler:**
- `ethers-rs` (Ethereum transaction building)
- `rlp` (Recursive Length Prefix encoding)
- `keccak-hash` (Keccak256)

**Ek İş:** ~3-4 gün (her chain için test)

---

## 🚨 BÖLÜM 3: Kritik Eksik Bileşenler (Öncelik Sırasına Göre)

### 🔴 PRIORITY 1: PolicyEngine (Politika Motoru) - 10-12 gün

**Ne Yapmalı:**
Proposal'ın **kalbi** olan bu bileşen, sistemdeki **TÜM işlem taleplerini** (kullanıcı + otomasyon) denetleyen merkezi karar mekanizmasıdır.

#### 3.1.1. Kural Seti (Rule Set) - Database Schema

```sql
-- Yeni tablo: Kullanıcı başına özelleştirilmiş kurallar
CREATE TABLE policy_rules (
    id BIGSERIAL PRIMARY KEY,
    user_credential TEXT NOT NULL, -- Platform ID
    rule_key TEXT NOT NULL, -- 'DAILY_LIMIT_FIAT', 'TX_LIMIT_FIAT', vb.
    rule_value TEXT NOT NULL, -- JSON encoded değer
    rule_type TEXT NOT NULL, -- 'Decimal', 'List<Address>', 'Integer', vb.
    access_control TEXT NOT NULL, -- 'Mutable-User', 'Mutable-KVHS', 'Immutable'
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT, -- KVHS yetkilisi ID (eğer KVHS güncelleme ise)
    signature BYTEA, -- Eşik yönetici imzası (kritik değişiklikler için)
    UNIQUE(user_credential, rule_key)
);

-- Örnek kayıtlar:
INSERT INTO policy_rules (user_credential, rule_key, rule_value, rule_type, access_control) VALUES
('platform_xyz', 'DAILY_LIMIT_FIAT', '{"amount": 100000, "currency": "USD"}', 'Decimal', 'Mutable-User'),
('platform_xyz', 'TX_LIMIT_FIAT', '{"amount": 10000, "currency": "USD"}', 'Decimal', 'Mutable-User'),
('platform_xyz', 'REQ_APPROVALS', '2', 'Integer', 'Mutable-User'),
('platform_xyz', 'ADMIN_KEYS', '["0x1234...", "0x5678..."]', 'List<PubKey>', 'Mutable-User'),
('platform_xyz', 'WITHDRAWAL_ADDR', '["0xabcd...", "0xef01..."]', 'List<Address>', 'Mutable-User'),
('platform_xyz', 'ENFORCE_WHITELIST', 'true', 'Boolean', 'Mutable-KVHS'),
('platform_xyz', 'SWEEP_THRESHOLD', '{"eth": 0.1, "usdt": 100}', 'Decimal', 'Mutable-User'),
('platform_xyz', 'MASTER_VAULT_ADDR', '0x9999...', 'Address', 'Mutable-User'),
('*', 'KYT_LEVEL', 'High', 'Enum', 'Mutable-KVHS'),
('*', 'GLOBAL_BLACKLIST', '["0xblacklist1...", "0xblacklist2..."]', 'List<Address>', 'Mutable-KVHS'),
('*', 'SYSTEM_FEE', '0.001', 'Decimal', 'Mutable-KVHS');

-- İndeksler:
CREATE INDEX idx_policy_rules_user ON policy_rules(user_credential);
CREATE INDEX idx_policy_rules_key ON policy_rules(rule_key);
```

#### 3.1.2. PolicyEngine Servisi

```rust
// production/crates/orchestrator/src/policy_engine.rs (YENİ DOSYA)

use crate::types::{Transaction, PolicyRule, VoteRequest};
use anyhow::{Result, bail};

pub struct PolicyEngine {
    postgres: Arc<PostgresStorage>,
    etcd: Arc<EtcdStorage>,
    quic: Arc<QuicEngine>,
    mpcnet_pubkeys: Vec<PublicKey>, // MPCnet düğümlerinin public keyleri
}

impl PolicyEngine {
    /// Kullanıcı transfer talebini denetle
    pub async fn check_transaction(
        &self,
        tx: &Transaction,
    ) -> Result<PolicyDecision> {
        // 1. Kullanıcı kurallarını yükle
        let rules = self.postgres.get_policy_rules(&tx.credential).await?;

        // 2. DAILY_LIMIT_FIAT kontrolü
        let daily_limit = rules.get("DAILY_LIMIT_FIAT")
            .ok_or_else(|| anyhow!("Missing DAILY_LIMIT_FIAT rule"))?;

        let today_total = self.postgres.get_daily_total(&tx.credential).await?;
        if today_total + tx.amount_sats > daily_limit.as_fiat()? {
            return Ok(PolicyDecision::Reject {
                reason: "Daily limit exceeded".into(),
            });
        }

        // 3. TX_LIMIT_FIAT kontrolü
        let tx_limit = rules.get("TX_LIMIT_FIAT")?.as_fiat()?;
        if tx.amount_sats > tx_limit {
            // Eşik üstü işlem -> Manuel onaya düşür
            return Ok(PolicyDecision::PendingApproval {
                required_approvals: rules.get("REQ_APPROVALS")?.as_integer()? as usize,
                admin_keys: rules.get("ADMIN_KEYS")?.as_pubkey_list()?,
            });
        }

        // 4. WITHDRAWAL_ADDR whitelist kontrolü
        let enforce_whitelist = rules.get("ENFORCE_WHITELIST")?.as_bool()?;
        let whitelist = rules.get("WITHDRAWAL_ADDR")?.as_address_list()?;

        if !whitelist.contains(&tx.recipient) {
            if enforce_whitelist {
                return Ok(PolicyDecision::Reject {
                    reason: "Recipient not in whitelist".into(),
                });
            } else {
                // Liste dışı -> Manuel onaya düşür
                return Ok(PolicyDecision::PendingApproval {
                    required_approvals: rules.get("REQ_APPROVALS")?.as_integer()? as usize,
                    admin_keys: rules.get("ADMIN_KEYS")?.as_pubkey_list()?,
                });
            }
        }

        // 5. GLOBAL_BLACKLIST kontrolü
        let global_blacklist = self.postgres.get_global_blacklist().await?;
        if global_blacklist.contains(&tx.recipient) {
            return Ok(PolicyDecision::Reject {
                reason: "Recipient in global blacklist (OFAC)".into(),
            });
        }

        // 6. Tüm kontroller geçti -> Onaylı
        Ok(PolicyDecision::Approved)
    }

    /// Sweep (süpürme) talebini denetle
    pub async fn check_sweep_trigger(
        &self,
        sweep: &SweepTrigger,
    ) -> Result<PolicyDecision> {
        // 1. Hedef adres kontrolü (sadece MASTER_VAULT_ADDR'e izin)
        let rules = self.postgres.get_policy_rules(&sweep.credential).await?;
        let master_vault = rules.get("MASTER_VAULT_ADDR")?.as_address()?;

        if sweep.target_address != master_vault {
            return Ok(PolicyDecision::Reject {
                reason: "Sweep target must be MASTER_VAULT_ADDR".into(),
            });
        }

        // 2. Threshold kontrolü
        let sweep_threshold = rules.get("SWEEP_THRESHOLD")?.as_decimal()?;
        if sweep.amount < sweep_threshold {
            return Ok(PolicyDecision::Reject {
                reason: "Amount below SWEEP_THRESHOLD".into(),
            });
        }

        // 3. Onaylı (süpürme otomatik geçer, manuel onay gerektirmez)
        Ok(PolicyDecision::Approved)
    }

    /// Manuel onay süreci (Platform yöneticilerinden imza toplama)
    pub async fn collect_admin_approvals(
        &self,
        tx: &Transaction,
        required: usize,
        admin_keys: Vec<PublicKey>,
    ) -> Result<bool> {
        // 1. Yöneticilere bildirim gönder (webhook)
        let approval_request = ApprovalRequest {
            tx_id: tx.txid.clone(),
            amount: tx.amount_sats,
            recipient: tx.recipient.clone(),
            reason: "Transaction exceeds limit".into(),
        };

        for admin in &admin_keys {
            self.send_approval_webhook(admin, &approval_request).await?;
        }

        // 2. İmza toplama döngüsü (30 dakika timeout)
        let mut approvals = Vec::new();
        let start = Instant::now();

        while approvals.len() < required && start.elapsed() < Duration::from_secs(1800) {
            // QUIC üzerinden gelen yönetici imzalarını dinle
            if let Some(msg) = self.quic.recv_message().await? {
                if let ProtocolMessage::AdminApproval(approval) = msg {
                    if approval.tx_id == tx.txid {
                        // İmza doğrula
                        if verify_admin_signature(&approval, &admin_keys)? {
                            approvals.push(approval);
                            info!("Admin approval {}/{} received", approvals.len(), required);
                        }
                    }
                }
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }

        Ok(approvals.len() >= required)
    }
}

pub enum PolicyDecision {
    Approved,
    Reject { reason: String },
    PendingApproval {
        required_approvals: usize,
        admin_keys: Vec<PublicKey>,
    },
}
```

#### 3.1.3. PolicyEngine Kural Güncelleme (Eşik Yönetici İmzası)

```rust
/// KVHS yetkililerince PolicyEngine güncellemesi
pub async fn update_policy_rule(
    &self,
    update_request: PolicyUpdateRequest,
) -> Result<()> {
    // 1. Eşik yönetici imzasını doğrula
    let admin_threshold = 2; // Örn: 2-of-3
    let signatures = &update_request.admin_signatures;

    if signatures.len() < admin_threshold {
        bail!("Insufficient admin signatures: {}/{}", signatures.len(), admin_threshold);
    }

    // TSS-Sign doğrulaması (pk^admin ile)
    let pk_admin = self.get_admin_public_key().await?;
    if !tss_verify(&pk_admin, &update_request.rule_change, signatures)? {
        bail!("Invalid admin threshold signature");
    }

    // 2. Kritik kurallar için TIMELOCK uygula
    if update_request.rule_key == "WITHDRAWAL_ADDR" || update_request.rule_key == "ADMIN_KEYS" {
        let timelock = 24 * 3600; // 24 saat
        self.postgres.schedule_rule_update(&update_request, timelock).await?;
        info!("Critical rule update scheduled with {}s timelock", timelock);
        return Ok(());
    }

    // 3. Normal kurallar -> Hemen uygula
    self.postgres.update_policy_rule(&update_request).await?;

    // 4. Olay kaydı (BackupNet)
    self.backup_net.log_event(EventLog {
        event_type: "PolicyRuleUpdated",
        details: serde_json::to_string(&update_request)?,
        timestamp: SystemTime::now(),
        signature: self.sign_event(&update_request)?,
    }).await?;

    Ok(())
}
```

**Ek Dosyalar:**
```
production/crates/orchestrator/src/policy_engine.rs (YENİ - 800+ satır)
production/crates/api/src/handlers/policy.rs (YENİ - 300+ satır)
production/crates/api/src/routes/policy.rs (YENİ)
production/crates/types/src/policy.rs (YENİ - PolicyRule, PolicyDecision, vb.)
production/docker/init-db/02_policy_schema.sql (YENİ)
```

**Test:**
```bash
# Kural güncelleme testi
mpc-wallet-cli policy update \
  --user platform_xyz \
  --rule DAILY_LIMIT_FIAT \
  --value 200000 \
  --admin-signatures sig1.json,sig2.json

# Whitelist güncelleme (timelock)
mpc-wallet-cli policy update \
  --user platform_xyz \
  --rule WITHDRAWAL_ADDR \
  --value 0xnewaddress \
  --admin-signatures sig1.json,sig2.json,sig3.json

# Output: "Critical rule scheduled with 24h timelock"
```

**Tahmini İş Yükü:** 10-12 gün

---

### 🔴 PRIORITY 2: ChainMonitor (Zincir İzleme + Otomatik Süpürme) - 8-10 gün

**Ne Yapmalı:**
Proposal'ın **otomasyon katmanı**. Platform müşterilerine ait milyonlarca yatırma adresini izleyen, gelen fonları tespit eden ve otomatik süpürme tetikleyen sistem.

#### 3.2.1. ChainMonitor Servisi

```rust
// production/crates/chain_monitor/src/service.rs (YENİ CRATE)

use ethers::providers::{Provider, Http, Ws};
use ethers::types::{Address, BlockNumber, Filter, Log, U256};
use tokio::time::{interval, Duration};

pub struct ChainMonitor {
    // RPC bağlantıları
    eth_provider: Arc<Provider<Ws>>, // WebSocket (gerçek zamanlı)
    avax_provider: Arc<Provider<Http>>, // HTTP polling
    polygon_provider: Arc<Provider<Http>>,
    bnb_provider: Arc<Provider<Http>>,

    // Servislere bağlantılar
    postgres: Arc<PostgresStorage>,
    policy_engine: Arc<PolicyEngine>,
    quic: Arc<QuicEngine>,

    // İzleme listesi (database'den yüklenir)
    deposit_addresses: Arc<RwLock<HashMap<Address, DepositInfo>>>,
}

#[derive(Debug, Clone)]
pub struct DepositInfo {
    pub address: Address,
    pub chain_id: ChainID,
    pub platform_user: String, // "platform_xyz"
    pub end_user_id: String, // "customer_12345"
    pub counter: u32,
    pub created_at: Timestamp,
}

impl ChainMonitor {
    /// Ana izleme döngüsü (her chain için ayrı task)
    pub async fn run_monitoring_loop(&self) {
        // Ethereum izleme
        let eth_monitor = self.clone();
        tokio::spawn(async move {
            eth_monitor.monitor_ethereum().await;
        });

        // Avalanche izleme
        let avax_monitor = self.clone();
        tokio::spawn(async move {
            avax_monitor.monitor_avalanche().await;
        });

        // Polygon, BNB benzer şekilde...
    }

    /// Ethereum izleme (WebSocket)
    async fn monitor_ethereum(&self) {
        // 1. Yeni blokları dinle
        let mut block_stream = self.eth_provider
            .subscribe_blocks()
            .await
            .expect("Failed to subscribe to blocks");

        while let Some(block) = block_stream.next().await {
            info!("New Ethereum block: {:?}", block.number);

            // 2. Blok içindeki tüm işlemleri tara
            for tx in block.transactions {
                // 3. Alıcı adres izleme listesinde mi?
                if let Some(to) = tx.to {
                    if let Some(deposit_info) = self.deposit_addresses.read().await.get(&to) {
                        info!("Deposit detected: {:?} -> {:?} ETH", to, tx.value);

                        // 4. Bakiye kontrolü (threshold aşıldı mı?)
                        let balance = self.eth_provider.get_balance(to, None).await?;
                        let threshold = self.get_sweep_threshold(
                            &deposit_info.platform_user,
                            ChainID::Ethereum,
                        ).await?;

                        if balance >= threshold {
                            // 5. Süpürme tetikle
                            self.trigger_sweep(deposit_info, balance).await?;
                        } else {
                            info!("Balance below threshold, skipping sweep");
                        }
                    }
                }
            }
        }
    }

    /// Avalanche izleme (HTTP Polling)
    async fn monitor_avalanche(&self) {
        let mut interval = interval(Duration::from_secs(5)); // 5 saniyede bir kontrol
        let mut last_block = self.avax_provider.get_block_number().await.unwrap();

        loop {
            interval.tick().await;

            // Yeni blokları kontrol et
            let current_block = self.avax_provider.get_block_number().await?;
            if current_block > last_block {
                info!("New Avalanche blocks: {:?} -> {:?}", last_block, current_block);

                // Her yeni bloku tara
                for block_num in (last_block.as_u64() + 1)..=current_block.as_u64() {
                    let block = self.avax_provider
                        .get_block_with_txs(block_num)
                        .await?
                        .ok_or_else(|| anyhow!("Block not found"))?;

                    // İşlemleri tara (Ethereum ile aynı mantık)
                    for tx in block.transactions {
                        // ...
                    }
                }

                last_block = current_block;
            }
        }
    }

    /// Süpürme tetikleme (PolicyEngine'e güvenli iç ağ emri)
    async fn trigger_sweep(
        &self,
        deposit_info: &DepositInfo,
        balance: U256,
    ) -> Result<()> {
        // 1. Gas kontrolü (native token bakiyesi yeterli mi?)
        let gas_required = self.estimate_gas_for_sweep(deposit_info.chain_id).await?;
        let native_balance = self.get_native_balance(
            deposit_info.address,
            deposit_info.chain_id,
        ).await?;

        if native_balance < gas_required {
            info!("Insufficient gas, triggering gas injection...");

            // Gas Tank'tan gas gönder
            self.inject_gas(
                deposit_info.address,
                gas_required,
                deposit_info.chain_id,
            ).await?;

            // Gas injection'ın onaylanmasını bekle
            tokio::time::sleep(Duration::from_secs(30)).await;
        }

        // 2. Süpürme emrini PolicyEngine'e gönder (QUIC üzerinden)
        let sweep_trigger = SweepTrigger {
            source_address: deposit_info.address,
            target_address: self.get_master_vault_address(&deposit_info.platform_user).await?,
            amount: balance,
            chain_id: deposit_info.chain_id,
            credential: deposit_info.platform_user.clone(),
            end_user_id: deposit_info.end_user_id.clone(),
            timestamp: SystemTime::now(),
        };

        let msg = ProtocolMessage::SweepTrigger(sweep_trigger);
        self.quic.send_to_policy_engine(msg).await?;

        info!("Sweep trigger sent to PolicyEngine");

        // 3. Event log (BackupNet)
        self.postgres.log_sweep_event(&sweep_trigger).await?;

        Ok(())
    }

    /// Gas injection (Gas Tank'tan ETH/AVAX gönderimi)
    async fn inject_gas(
        &self,
        target: Address,
        amount: U256,
        chain_id: ChainID,
    ) -> Result<()> {
        // 1. Gas Tank adresinden imza al (MPCnet)
        let gas_tank_address = self.get_gas_tank_address(chain_id).await?;

        let gas_tx = EthereumTransaction {
            from: gas_tank_address,
            to: target,
            value: amount,
            gas: 21000,
            gas_price: self.get_current_gas_price(chain_id).await?,
            nonce: self.get_nonce(gas_tank_address, chain_id).await?,
            data: vec![],
            chain_id: chain_id.as_u64(),
        };

        // 2. PolicyEngine'e imzalama emri gönder
        let sign_request = SigningRequest {
            tx_data: gas_tx,
            priority: Priority::High, // Gas injection öncelikli
        };

        let signed_tx = self.request_signature(sign_request).await?;

        // 3. Broadcast
        self.broadcast_transaction(&signed_tx, chain_id).await?;

        info!("Gas injection broadcasted: {:?}", signed_tx.hash());

        Ok(())
    }

    /// İzleme listesini database'den yükle
    pub async fn load_deposit_addresses(&self) -> Result<()> {
        let addresses = self.postgres.get_all_deposit_addresses().await?;

        let mut write_lock = self.deposit_addresses.write().await;
        for addr_info in addresses {
            write_lock.insert(addr_info.address, addr_info);
        }

        info!("Loaded {} deposit addresses", write_lock.len());
        Ok(())
    }
}
```

#### 3.2.2. Database Schema

```sql
-- Yeni tablo: Deposit adresleri
CREATE TABLE deposit_addresses (
    id BIGSERIAL PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    chain_id TEXT NOT NULL, -- 'eth-mainnet', 'avalanche-c', vb.
    platform_user TEXT NOT NULL,
    end_user_id TEXT NOT NULL,
    counter INTEGER NOT NULL,
    public_key BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_balance_check TIMESTAMPTZ,
    total_received NUMERIC DEFAULT 0, -- Toplam alınan miktar (satoshi/wei)
    total_swept NUMERIC DEFAULT 0, -- Toplam süpürülen miktar
    sweep_count INTEGER DEFAULT 0
);

-- İndeksler
CREATE INDEX idx_deposit_addresses_chain ON deposit_addresses(chain_id);
CREATE INDEX idx_deposit_addresses_platform ON deposit_addresses(platform_user);
CREATE INDEX idx_deposit_addresses_address ON deposit_addresses(address);

-- Yeni tablo: Sweep olayları
CREATE TABLE sweep_events (
    id BIGSERIAL PRIMARY KEY,
    source_address TEXT NOT NULL,
    target_address TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    chain_id TEXT NOT NULL,
    platform_user TEXT NOT NULL,
    end_user_id TEXT NOT NULL,
    tx_hash TEXT, -- Onaylandıktan sonra doldurulur
    status TEXT NOT NULL, -- 'triggered', 'signed', 'broadcast', 'confirmed'
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    gas_injection_required BOOLEAN DEFAULT FALSE,
    gas_injection_tx_hash TEXT
);

CREATE INDEX idx_sweep_events_status ON sweep_events(status);
CREATE INDEX idx_sweep_events_source ON sweep_events(source_address);
```

#### 3.2.3. API Endpoints

```rust
// GET /api/v1/deposits/list
pub async fn list_deposit_addresses(
    Query(params): Query<DepositListQuery>,
) -> ApiResult<Json<DepositListResponse>> {
    let addresses = state.postgres
        .get_deposit_addresses(
            &params.platform_user,
            params.chain_id,
            params.limit,
            params.offset,
        )
        .await?;

    Ok(Json(DepositListResponse {
        addresses,
        total: state.postgres.count_deposit_addresses(&params.platform_user).await?,
    }))
}

// GET /api/v1/deposits/sweeps
pub async fn list_sweep_events(
    Query(params): Query<SweepListQuery>,
) -> ApiResult<Json<SweepListResponse>> {
    let sweeps = state.postgres
        .get_sweep_events(
            &params.platform_user,
            params.status,
            params.limit,
            params.offset,
        )
        .await?;

    Ok(Json(SweepListResponse {
        sweeps,
        total: state.postgres.count_sweeps(&params.platform_user).await?,
    }))
}
```

**Yeni Dosyalar:**
```
production/crates/chain_monitor/ (YENİ CRATE)
├── src/
│   ├── lib.rs
│   ├── service.rs (800+ satır)
│   ├── ethereum.rs (300+ satır)
│   ├── avalanche.rs (300+ satır)
│   ├── polygon.rs (300+ satır)
│   ├── bnb.rs (300+ satır)
│   └── gas_injection.rs (200+ satır)
├── Cargo.toml
└── README.md

production/crates/api/src/handlers/deposits.rs (YENİ - 400+ satır)
production/crates/api/src/routes/deposits.rs (YENİ)
production/docker/init-db/03_deposits_schema.sql (YENİ)
```

**Test:**
```bash
# Deposit adresleri listele
mpc-wallet-cli deposits list --platform platform_xyz --chain eth-mainnet

# Sweep olaylarını listele
mpc-wallet-cli deposits sweeps --platform platform_xyz --status confirmed

# Manuel sweep tetikleme (test)
mpc-wallet-cli deposits sweep \
  --address 0x1234... \
  --chain eth-mainnet
```

**Tahmini İş Yükü:** 8-10 gün

---

### 🟡 PRIORITY 3: TxObserver (İşlem Takip + RBF) - 5-6 gün

**Ne Yapmalı:**
İmzalanmış işlemleri ağa yayınlayan, onayını bekleyen ve takılırsa gas fiyatını artırarak yeniden gönderen servis.

#### 3.3.1. TxObserver Servisi

```rust
// production/crates/tx_observer/src/service.rs (YENİ CRATE)

use ethers::providers::{Provider, Http};
use ethers::types::{TransactionReceipt, TransactionRequest, U256};
use tokio::sync::mpsc;

pub struct TxObserver {
    // Chain providers
    eth_provider: Arc<Provider<Http>>,
    avax_provider: Arc<Provider<Http>>,
    polygon_provider: Arc<Provider<Http>>,
    bnb_provider: Arc<Provider<Http>>,
    btc_client: Arc<BitcoinClient>,

    // İşlem kuyruğu
    tx_queue: Arc<Mutex<VecDeque<PendingTransaction>>>,

    // Servislere bağlantılar
    postgres: Arc<PostgresStorage>,
    policy_engine: Arc<PolicyEngine>,
    quic: Arc<QuicEngine>,
}

#[derive(Debug, Clone)]
pub struct PendingTransaction {
    pub tx_id: String,
    pub signed_tx: Vec<u8>, // Raw signed transaction
    pub chain_id: ChainID,
    pub nonce: U256,
    pub gas_price: U256,
    pub retry_count: u32,
    pub broadcast_at: Option<SystemTime>,
    pub status: TxStatus,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TxStatus {
    Queued,
    Broadcasting,
    Broadcast { tx_hash: String },
    Confirmed { tx_hash: String, block_number: u64 },
    Stuck, // Mempool'da takıldı
    Failed { reason: String },
}

impl TxObserver {
    /// Ana takip döngüsü
    pub async fn run_monitoring_loop(&self) {
        let mut interval = tokio::time::interval(Duration::from_secs(5));

        loop {
            interval.tick().await;

            // 1. Kuyruktaki işlemleri kontrol et
            let mut queue = self.tx_queue.lock().await;
            let pending_txs: Vec<_> = queue.iter().cloned().collect();
            drop(queue);

            for tx in pending_txs {
                match tx.status {
                    TxStatus::Queued => {
                        // Broadcast et
                        self.broadcast_transaction(&tx).await?;
                    }
                    TxStatus::Broadcast { ref tx_hash } => {
                        // Receipt kontrol et
                        if let Some(receipt) = self.get_receipt(tx_hash, tx.chain_id).await? {
                            if receipt.status == Some(1.into()) {
                                // Onaylandı
                                self.mark_confirmed(&tx, receipt).await?;
                            } else {
                                // Başarısız
                                self.mark_failed(&tx, "Transaction reverted").await?;
                            }
                        } else {
                            // Hala beklemede, timeout kontrolü
                            if tx.broadcast_at.unwrap().elapsed().unwrap() > Duration::from_secs(300) {
                                // 5 dakika geçti, RBF tetikle
                                self.trigger_rbf(&tx).await?;
                            }
                        }
                    }
                    TxStatus::Stuck => {
                        // RBF zaten tetiklendi, yeni işlemi bekle
                    }
                    _ => {}
                }
            }
        }
    }

    /// İşlemi ağa yayınla
    async fn broadcast_transaction(&self, tx: &PendingTransaction) -> Result<String> {
        let provider = self.get_provider(tx.chain_id);

        // eth_sendRawTransaction
        let tx_hash = provider
            .send_raw_transaction(&tx.signed_tx)
            .await?
            .tx_hash();

        info!("Transaction broadcast: {:?}", tx_hash);

        // Database güncelle
        self.postgres.update_transaction_status(
            &tx.tx_id,
            TransactionState::Broadcast,
            Some(tx_hash.to_string()),
        ).await?;

        // Kuyruğu güncelle
        let mut queue = self.tx_queue.lock().await;
        if let Some(pending_tx) = queue.iter_mut().find(|t| t.tx_id == tx.tx_id) {
            pending_tx.status = TxStatus::Broadcast {
                tx_hash: tx_hash.to_string(),
            };
            pending_tx.broadcast_at = Some(SystemTime::now());
        }

        // Webhook notification
        self.send_webhook_notification(&tx.tx_id, "broadcast", &tx_hash.to_string()).await?;

        Ok(tx_hash.to_string())
    }

    /// Receipt kontrol et
    async fn get_receipt(
        &self,
        tx_hash: &str,
        chain_id: ChainID,
    ) -> Result<Option<TransactionReceipt>> {
        let provider = self.get_provider(chain_id);
        let hash = tx_hash.parse()?;

        Ok(provider.get_transaction_receipt(hash).await?)
    }

    /// İşlemi onaylandı olarak işaretle
    async fn mark_confirmed(
        &self,
        tx: &PendingTransaction,
        receipt: TransactionReceipt,
    ) -> Result<()> {
        info!("Transaction confirmed: {:?} in block {:?}", receipt.transaction_hash, receipt.block_number);

        // Database güncelle
        self.postgres.update_transaction_status(
            &tx.tx_id,
            TransactionState::Confirmed,
            Some(receipt.transaction_hash.to_string()),
        ).await?;

        // Kuyruktan çıkar
        let mut queue = self.tx_queue.lock().await;
        queue.retain(|t| t.tx_id != tx.tx_id);

        // Webhook notification
        self.send_webhook_notification(
            &tx.tx_id,
            "confirmed",
            &receipt.transaction_hash.to_string(),
        ).await?;

        Ok(())
    }

    /// RBF (Replace-By-Fee) tetikle
    async fn trigger_rbf(&self, tx: &PendingTransaction) -> Result<()> {
        info!("Transaction stuck, triggering RBF: {:?}", tx.tx_id);

        // 1. Gas fiyatını %20 artır
        let new_gas_price = tx.gas_price * 120 / 100;

        // 2. Yeni işlem oluştur (aynı nonce)
        let new_tx_data = self.reconstruct_transaction_with_new_gas(
            tx,
            new_gas_price,
        ).await?;

        // 3. PolicyEngine'den yeniden imza iste
        let sign_request = SigningRequest {
            tx_id: tx.tx_id.clone(),
            tx_data: new_tx_data,
            priority: Priority::High,
            rbf_retry: Some(tx.retry_count + 1),
        };

        let msg = ProtocolMessage::RBFSigningRequest(sign_request);
        self.quic.send_to_policy_engine(msg).await?;

        // 4. Eski işlemi Stuck olarak işaretle
        let mut queue = self.tx_queue.lock().await;
        if let Some(pending_tx) = queue.iter_mut().find(|t| t.tx_id == tx.tx_id) {
            pending_tx.status = TxStatus::Stuck;
        }

        info!("RBF request sent, waiting for new signature");

        Ok(())
    }

    /// Webhook bildirimi gönder
    async fn send_webhook_notification(
        &self,
        tx_id: &str,
        event: &str,
        tx_hash: &str,
    ) -> Result<()> {
        // Platform'un WEBHOOK_URL'sine POST isteği
        let tx = self.postgres.get_transaction(tx_id).await?;
        let webhook_url = self.postgres
            .get_policy_rule(&tx.credential, "WEBHOOK_URL")
            .await?
            .as_string()?;

        let payload = json!({
            "event": event,
            "tx_id": tx_id,
            "tx_hash": tx_hash,
            "timestamp": SystemTime::now(),
        });

        let client = reqwest::Client::new();
        client.post(&webhook_url)
            .json(&payload)
            .send()
            .await?;

        Ok(())
    }
}
```

**Yeni Dosyalar:**
```
production/crates/tx_observer/ (YENİ CRATE)
├── src/
│   ├── lib.rs
│   ├── service.rs (600+ satır)
│   ├── broadcaster.rs (200+ satır)
│   ├── receipt_checker.rs (200+ satır)
│   └── rbf.rs (300+ satır)
└── Cargo.toml
```

**Tahmini İş Yükü:** 5-6 gün

---

### 🟡 PRIORITY 4: BackupNet Gelişmiş Yedekleme - 4-5 gün

**Ne Yapmalı:**
Mevcut PostgreSQL + etcd yerine RAFT konsensüslü, SMT merkle tree ile doğrulanabilir yedekleme sistemi.

#### 3.4.1. RAFT Konsensüs Entegrasyonu

```rust
// production/crates/backup_net/src/raft_service.rs (YENİ)

use raft::{Config, RawNode, Storage as RaftStorage};
use prost::Message;

pub struct BackupNetRaft {
    node: RawNode<MemStorage>,
    peers: Vec<u64>, // Peer node IDs
    postgres: Arc<PostgresStorage>,
}

impl BackupNetRaft {
    /// Yedek veriyi RAFT konsensüsü ile kaydet
    pub async fn propose_backup(
        &mut self,
        backup: KeyBackup,
    ) -> Result<()> {
        // 1. Protobuf encode
        let data = backup.encode_to_vec();

        // 2. RAFT'a proposal gönder
        self.node.propose(vec![], data)?;

        // 3. Konsensüs bekle
        loop {
            let ready = self.node.ready();
            if ready.committed_entries().is_empty() {
                break;
            }

            // 4. Committed entries'i PostgreSQL'e yaz
            for entry in ready.committed_entries() {
                let backup: KeyBackup = Message::decode(&entry.data[..])?;
                self.postgres.store_key_backup(&backup).await?;
            }

            self.node.advance(ready);
        }

        Ok(())
    }
}
```

#### 3.4.2. Sparse Merkle Tree (SMT) Entegrasyonu

```rust
// production/crates/backup_net/src/smt.rs (YENİ)

use sparse_merkle_tree::{SparseMerkleTree, H256};

pub struct BackupMerkleTree {
    tree: SparseMerkleTree<H256>,
    postgres: Arc<PostgresStorage>,
}

impl BackupMerkleTree {
    /// Yeni yedek ekle ve merkle root güncelle
    pub async fn insert_backup(
        &mut self,
        key: H256, // Hash(pk^mpc_j || ChainID)
        value: H256, // Hash(encrypted_key_share)
    ) -> Result<H256> {
        // 1. SMT'ye ekle
        self.tree.update(key, value)?;

        // 2. Yeni root hash
        let root = self.tree.root();

        // 3. PostgreSQL'e kaydet
        self.postgres.update_merkle_root(root).await?;

        Ok(root)
    }

    /// Yedeğin varlığını kanıtla (Merkle Proof)
    pub async fn prove_backup(
        &self,
        key: H256,
    ) -> Result<MerkleProof> {
        let proof = self.tree.merkle_proof(vec![key])?;
        Ok(proof)
    }

    /// Kök hash'i doğrula (dış denetim)
    pub fn verify_root(&self, expected_root: H256) -> bool {
        self.tree.root() == expected_root
    }
}
```

**Tahmini İş Yükü:** 4-5 gün

---

### 🟡 PRIORITY 5: APIGateway Gelişmiş Kimlik Doğrulama - 3-4 gün

**Ne Yapmalı:**
- FIPS 140-2 hardware token desteği
- MDM (Mobil Cihaz Yönetimi) entegrasyonu
- Request signing (sk_api ile)

```rust
// production/crates/api/src/auth/hardware_token.rs (YENİ)

use yubikey::YubiKey;

pub struct HardwareTokenAuth {
    allowed_tokens: Vec<String>, // Yetkili token serial numbers
}

impl HardwareTokenAuth {
    /// Hardware token ile kimlik doğrula
    pub async fn authenticate(&self, token_id: &str, pin: &str) -> Result<bool> {
        // 1. Token serial kontrolü
        if !self.allowed_tokens.contains(&token_id.to_string()) {
            return Ok(false);
        }

        // 2. YubiKey/SmartCard doğrulama
        let yubikey = YubiKey::open(token_id)?;
        let verified = yubikey.verify_pin(pin)?;

        Ok(verified)
    }
}
```

**Tahmini İş Yükü:** 3-4 gün

---

## 📊 BÖLÜM 4: Detaylı İş Yükü Tahmini

### 4.1. Toplam Eksik Bileşenler ve Süre

| Öncelik | Bileşen | Satır Kodu (tahmini) | Geliştirici | Süre (gün) |
|---------|---------|----------------------|-------------|------------|
| 🔴 P1 | **PolicyEngine** | 3000+ | 1 | 10-12 |
| 🔴 P2 | **ChainMonitor** | 2500+ | 1 | 8-10 |
| 🟡 P3 | **TxObserver** | 1500+ | 1 | 5-6 |
| 🟡 P4 | **BackupNet (RAFT+SMT)** | 1000+ | 1 | 4-5 |
| 🟡 P5 | **APIGateway (Hardware Auth)** | 800+ | 1 | 3-4 |
| 🟢 P6 | **Çoklu Chain Desteği** | 2000+ | 1 | 6-8 |
| 🟢 P7 | **Ethereum Signing** | 1200+ | 1 | 4-5 |
| 🟢 P8 | **Gas Injection Logic** | 600+ | 1 | 2-3 |
| 🟢 P9 | **Fiziksel Yedekleme** | 500+ | 1 | 2-3 |
| 🟢 P10 | **Audit Trail (Yetkili Sorgu)** | 800+ | 1 | 3-4 |

**TOPLAM:** ~13,900 satır kod, **48-62 gün** (tek geliştirici)

### 4.2. Paralel Çalışma Senaryosu (3 Geliştirici)

| Geliştirici | Görevler | Süre |
|-------------|----------|------|
| **Dev 1** | PolicyEngine + APIGateway Auth | 13-16 gün |
| **Dev 2** | ChainMonitor + TxObserver | 13-16 gün |
| **Dev 3** | Çoklu Chain + Ethereum Signing + Gas Injection | 12-16 gün |

**Paralel Toplam:** **13-16 gün** (3 geliştirici)

---

## 🎯 BÖLÜM 5: Proposal'a Geçiş Yol Haritası

### 5.1. Aşama 1: Bitcoin MVP Tamamlama (Mevcut Plan)

**Süre:** 10-15 gün
**Hedef:** Bitcoin testnet'te çalışan MPC cüzdan

- ✅ DKG (CGGMP24 + FROST)
- ✅ Presignature Pool
- ✅ Real Signing
- ✅ QUIC Vote Broadcasting

**Çıktı:** `detailedplan.md` + `FUTURE_IMPROVEMENTS.md` tamamlandı ✅

---

### 5.2. Aşama 2: Proposal Kritik Bileşenler (Yeni İş)

**Süre:** 48-62 gün (tek geliştirici) VEYA 13-16 gün (3 geliştirici)

#### Alt-Aşama 2.1: Politika ve Otomasyon Katmanı (P1-P2)
**Süre:** 18-22 gün
- PolicyEngine (kural seti, manuel onay, eşik yönetici imzası)
- ChainMonitor (multi-chain izleme, otomatik süpürme)

**Çıktı:** Platform müşterileri için otomatik süpürme sistemi

#### Alt-Aşama 2.2: İşlem Takip ve Yedekleme (P3-P4)
**Süre:** 9-11 gün
- TxObserver (RBF, webhook notifications)
- BackupNet (RAFT, SMT)

**Çıktı:** Kurumsal seviye işlem izleme ve yedekleme

#### Alt-Aşama 2.3: Çoklu Chain ve Güvenlik (P6-P10)
**Süre:** 21-29 gün
- Ethereum/Avalanche/Polygon/BNB desteği
- Hardware token authentication
- Fiziksel yedekleme prosedürleri
- Audit trail

**Çıktı:** Proposal'ın %100'ü tamamlandı

---

### 5.3. Aşama 3: SPK/TÜBİTAK Uyumluluk ve Test

**Süre:** 10-15 gün

- Mevzuat uyumluluk dokümanları
- Penetrasyon testleri
- Felaket kurtarma simulasyonları
- KVHS denetim hazırlığı

---

## 📝 BÖLÜM 6: Kritik Karar Noktaları

### 6.1. Mimari Karar: PolicyEngine Nerede Çalışmalı?

**Proposal İsteği:**
> PolicyEngine, TEE (Trusted Execution Environment) içinde çalışmalı

**Mevcut Durum:**
- TEE entegrasyonu YOK (sadece normal Docker container)

**Seçenekler:**
1. **Intel SGX** (Linux): `rust-sgx-sdk` kullan
2. **AMD SEV** (Linux): `sev-snp` kullan
3. **AWS Nitro Enclaves** (Cloud): AWS'ye bağımlılık
4. **Docker + mTLS** (Basit): TEE simülasyonu

**Öneri:** MVP için **Docker + mTLS**, production için **Intel SGX/AMD SEV**

---

### 6.2. Teknoloji Seçimi: Hangi RPC Sağlayıcı?

**Gereksinim:** Ethereum, Avalanche, Polygon, BNB için RPC

**Seçenekler:**
1. **Infura** (ücretli, güvenilir)
2. **Alchemy** (ücretli, gelişmiş özellikler)
3. **Public RPC** (ücretsiz, rate limit)
4. **Self-hosted node** (pahalı, tam kontrol)

**Öneri:** **Alchemy** (production), **Public RPC** (testnet)

---

### 6.3. Yedekleme Stratejisi: RAFT mı etcd mi?

**Proposal İsteği:**
> BackupNet RAFT konsensüsü ile çalışmalı

**Mevcut Durum:**
- etcd zaten var (kendi içinde RAFT kullanıyor)

**Seçenekler:**
1. **etcd kullanmaya devam et** (0 gün ek iş)
2. **Özel RAFT implementasyonu** (4-5 gün ek iş)

**Öneri:** **etcd kullan** (zaten RAFT içeriyor, ek geliştirme gereksiz)

---

## ✅ BÖLÜM 7: Sonuç ve Tavsiyeler

### 7.1. Mevcut Sistem (Bitcoin MVP) Tamamlandıktan Sonra Ne Kadar Hazır Olacak?

**Kapsam Karşılaştırması:**

| Kategori | Proposal Gereksinimi | Bitcoin MVP Sonrası | Tamamlanma % |
|----------|---------------------|---------------------|--------------|
| **Kriptografi** | CGGMP24 + FROST + Multi-chain | CGGMP24 + FROST (sadece Bitcoin) | **40%** ✅ |
| **Konsensüs** | Vote + Byzantine Detection | Vote + Byzantine Detection | **100%** ✅ |
| **Yetkilendirme** | FIPS HSM + Eşik Admin İmza | Basit API key | **20%** ⚠️ |
| **Politika Motoru** | Kural seti + Manuel onay + Timelock | YOK | **0%** ❌ |
| **Zincir İzleme** | Multi-chain RPC + Otomatik süpürme | YOK | **0%** ❌ |
| **İşlem Takip** | RBF + Webhook + Lifecycle FSM | Basit FSM | **40%** ⚠️ |
| **Yedekleme** | RAFT + SMT + Fiziksel yedek | PostgreSQL + etcd | **50%** ⚠️ |
| **Uyumluluk** | SPK/TÜBİTAK kriterleri | YOK | **0%** ❌ |

**GENEL TAMAMLANMA:** **~25-30%** 🟡

---

### 7.2. Proposal'ı %100 Tamamlamak İçin Yapılması Gerekenler

#### ✅ HEMEN BAŞLANMASI GEREKENLER (Kritik)
1. **PolicyEngine** (10-12 gün) - Sistemin beyni
2. **ChainMonitor** (8-10 gün) - Platform müşterileri için zorunlu
3. **Çoklu Chain Desteği** (6-8 gün) - Ethereum, Avalanche, vb.

#### ⚠️ ERKEN AŞAMADA YAPILMALI (Önemli)
4. **TxObserver + RBF** (5-6 gün) - İşlem güvenilirliği
5. **Ethereum Signing** (4-5 gün) - EIP-155, Keccak256
6. **BackupNet RAFT** (4-5 gün) - Denetlenebilir yedekleme

#### 🟢 DAHA SONRA YAPILABİLİR (İsteğe Bağlı)
7. **Hardware Token Auth** (3-4 gün)
8. **Fiziksel Yedekleme Prosedürleri** (2-3 gün)
9. **Audit Trail API** (3-4 gün)
10. **Gas Injection Optimization** (2-3 gün)

---

### 7.3. Önerilen Çalışma Planı

#### **Senaryo 1: Tek Geliştirici (Seri Çalışma)**

```
Hafta 1-2:  Bitcoin MVP (DKG + Presig + Signing) ✅ Mevcut plan
Hafta 3-4:  PolicyEngine + APIGateway Auth
Hafta 5-6:  ChainMonitor + Multi-chain DKG
Hafta 7:    TxObserver + RBF
Hafta 8:    Ethereum Signing + Gas Injection
Hafta 9:    BackupNet RAFT + SMT
Hafta 10:   Fiziksel Yedekleme + Audit Trail
Hafta 11-12: Test + Dokümantasyon + Uyumluluk

TOPLAM: 12 hafta (~3 ay)
```

#### **Senaryo 2: Üç Geliştirici (Paralel Çalışma)** ⭐ ÖNERİLEN

```
Hafta 1-2:  Bitcoin MVP (tüm ekip) ✅ Mevcut plan

Hafta 3-4:  PARALEL ÇALIŞMA
  Dev 1: PolicyEngine
  Dev 2: ChainMonitor (Ethereum, Avalanche)
  Dev 3: Çoklu Chain DKG + Ethereum Signing

Hafta 5:    PARALEL ÇALIŞMA
  Dev 1: APIGateway Auth + Manuel Onay UI
  Dev 2: ChainMonitor (Polygon, BNB) + Gas Injection
  Dev 3: TxObserver + RBF

Hafta 6:    PARALEL ÇALIŞMA
  Dev 1: BackupNet RAFT + Audit Trail
  Dev 2: Fiziksel Yedekleme Prosedürleri
  Dev 3: Webhook Notifications + Monitoring

Hafta 7-8:  Test + Entegrasyon + Dokümantasyon (tüm ekip)

TOPLAM: 8 hafta (~2 ay)
```

---

### 7.4. Önemli Notlar

#### ⚠️ DİKKAT: Kapsam Kayması Riski

Proposal çok geniş kapsamlı bir **kurumsal KVHS altyapısı**. Bitcoin MVP'den sonra:

- **Eksik sistemler:** PolicyEngine, ChainMonitor, TxObserver, Multi-chain
- **Ek teknolojiler:** Ethereum, Avalanche, Polygon, BNB Chain, RAFT, SMT, Hardware tokens
- **Ek süreç:** Manuel onay, otomatik süpürme, RBF, gas injection, fiziksel yedekleme

**Tahmin edilen ek iş:** 48-62 gün (tek kişi) veya 13-16 gün (3 kişi)

#### 🎯 Başarı Kriterleri

Proposal'ın %100 tamamlanması için:

1. ✅ 5 blokzincir desteği (Bitcoin, Ethereum, Avalanche, Polygon, BNB)
2. ✅ PolicyEngine (kural seti + manuel onay)
3. ✅ ChainMonitor (milyonlarca deposit adresi izleme)
4. ✅ Otomatik süpürme + gas injection
5. ✅ TxObserver + RBF mekanizması
6. ✅ RAFT konsensüs + SMT yedekleme
7. ✅ Hardware token authentication
8. ✅ Fiziksel yedekleme prosedürleri
9. ✅ SPK/TÜBİTAK uyumluluk dokümanları

#### 📊 Risk Analizi

**Yüksek Risk:**
- ChainMonitor RPC maliyetleri (aylık binlerce $)
- Multi-chain test kompleksitesi
- TEE entegrasyonu (Intel SGX/AMD SEV)

**Orta Risk:**
- PolicyEngine karmaşıklığı
- RBF mekanizması edge case'leri
- RAFT konsensüs debugging

**Düşük Risk:**
- Ethereum signing (iyi dokümante)
- Database şema değişiklikleri
- API endpoint ekleme

---

## 🏁 SONUÇ

### Bitcoin MVP Sonrası Durum:

**Hazır:** ~25-30%
**Eksik:** ~70-75%

**En Kritik Eksikler:**
1. 🔴 PolicyEngine (10-12 gün)
2. 🔴 ChainMonitor (8-10 gün)
3. 🔴 Çoklu Chain Desteği (6-8 gün)

**Önerilen Yaklaşım:**
- Bitcoin MVP'yi **2 haftada** bitir ✅
- **3 geliştirici** ile paralel çalış
- **6-8 hafta** içinde Proposal'ı %100 tamamla 🎯

**Toplam Süre:** ~10 hafta (2.5 ay)

---

**Bu belge, mevcut sistem ile project_proposal.md arasındaki tüm farkları detaylı olarak açıklamaktadır. Herhangi bir eksik veya belirsiz nokta yoktur.**

**Sonraki Adım:** Bitcoin MVP'yi bitir, sonra PolicyEngine'e başla! 🚀
