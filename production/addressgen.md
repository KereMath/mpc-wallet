# User-Specific HD Address Derivation - TAM UYGULAMA PLANI

**Versiyon**: 2.0 (Proposal Uyumlu)
**Tarih**: 2026-01-30

---

## Genel Bakış

Her kullanıcının (user1, user2) kendi Bitcoin adreslerini türetebileceği bir sistem.

### Temel Özellikler
- Kullanıcılar "Yeni Adres Üret" butonuna basarak yeni adres alabilir
- Her kullanıcı birden fazla adrese sahip olabilir
- Adresler kalıcı olarak veritabanında saklanır
- Tüm adresler aynı MPC public key'den **Proposal-uyumlu HD derivation** ile türetilir
- **Derived adreslerden harcama yapılabilir (signing tweak ile)**

### Desteklenen Adres Tipleri

| Adres Tipi | Protokol | İmza | Durum |
|------------|----------|------|-------|
| **SegWit (P2WPKH)** | CGGMP24 | ECDSA | ✅ **AKTİF** |
| Taproot (P2TR) | FROST | Schnorr | 🔒 **YAKINDA** (DKG yok) |

---

## ⚠️ UNUTMA: Transaction Flow'da Ne Değişiyor?

### Değişmeyen Kısımlar (Flow aynı kalıyor):
- **Voting** → Aynı, 4/5 oylama sistemi değişmiyor
- **Signature Combination** → Aynı, 4 imza birleştirme değişmiyor
- **Broadcast** → Aynı, Bitcoin'e gönderme değişmiyor

### Değişen Kısımlar:

**1. Transaction Oluşturma (Küçük değişiklik)**
```
Şimdi: { recipient, amount_sats }
Sonra: { recipient, amount_sats, source_address }  ← Hangi adresten gönderiyorsun
```
Database'e `derivation_index` ve `user_id` de kaydedilecek.

**2. Her Node'da İmzalama (Asıl değişiklik)**

Şu an node şunu yapıyor:
```
key_share ile imzala → signature
```

Sonra node şunu yapacak:
```
if (derivation_index var) {
    tweak = SHA512(root_pubkey || user_id || "bitcoin" || index)[0:32]
    adjusted_share = key_share + tweak   ← TEK FARK BU
}
adjusted_share ile imzala → signature
```

### 🎯 Özet: Tek Satırlık Fark

**Derived address için imzalarken, her node kendi key_share'ine tweak ekliyor.**

```
Normal (root):  signature = sign(key_share, message)
Derived:        signature = sign(key_share + tweak, message)
```

Bu kadar. Flow'un geri kalanı (voting, signature birleştirme, broadcast) hiç değişmiyor.

---

## BÖLÜM 1: PROPOSAL-UYUMLU DERİVASYON FORMÜLÜ

### 1.1 Project Proposal'daki Formül

```
(ρ, chaincode) ← H(pk_root, Cred_user, ChainID, WalletType, EndUserID, ctr)
```

### 1.2 Bizim Uyarladığımız Formül

```rust
/// Proposal-compliant derivation tweak calculation
///
/// Formül: tweak = SHA512(root_pubkey || user_id || chain_id || index)[0:32]
///
/// Parametreler:
/// - root_pubkey: DKG'den gelen 33-byte compressed public key
/// - user_id: Kullanıcı ID'si (string, örn: "user1")
/// - chain_id: "bitcoin" (hardcoded, ileride multi-chain için değiştirilebilir)
/// - index: Derivation counter (u32)
pub fn calculate_proposal_tweak(
    root_pubkey: &[u8],     // 33 bytes
    user_id: &str,          // "user1", "user2", etc.
    index: u32,
) -> Result<[u8; 32], MpcWalletError> {
    use sha2::{Sha512, Digest};

    const CHAIN_ID: &[u8] = b"bitcoin";

    if root_pubkey.len() != 33 {
        return Err(MpcWalletError::InvalidPublicKey(
            format!("Expected 33 bytes, got {}", root_pubkey.len())
        ));
    }

    let mut hasher = Sha512::new();
    hasher.update(root_pubkey);           // 33 bytes
    hasher.update(user_id.as_bytes());    // variable length
    hasher.update(CHAIN_ID);              // "bitcoin"
    hasher.update(&index.to_be_bytes());  // 4 bytes

    let result = hasher.finalize();

    // İlk 32 byte = tweak (signing için)
    // Son 32 byte = chaincode (isteğe bağlı, şimdilik kullanılmıyor)
    let mut tweak = [0u8; 32];
    tweak.copy_from_slice(&result[0..32]);

    Ok(tweak)
}
```

### 1.3 Neden Bu Formül?

| Parametre | Açıklama | Örnek |
|-----------|----------|-------|
| `root_pubkey` | MPC kök anahtarı | `03a1b2c3...` (33 byte) |
| `user_id` | Kullanıcı kimliği | `"user1"` |
| `chain_id` | Blockchain türü | `"bitcoin"` (hardcoded) |
| `index` | Derivation sayacı | `0, 1, 2, ...` |

**Güvenlik özellikleri:**
- Aynı user + aynı index = aynı adres (deterministic)
- Farklı user + aynı index = farklı adres (user isolation)
- Aynı user + farklı index = farklı adres (address generation)
- İleride `chain_id` değiştirilerek multi-chain desteklenebilir

---

## BÖLÜM 2: VERİTABANI

### 2.1 Migration: `docker/init-db/04_user_addresses.sql` ✅ YAZILDI

**Tablolar:**
- `users` - user1, user2, admin
- `user_addresses` - derivation_index, address, user_id, address_type
- `wallet_state` - next_derivation_index counter

**Fonksiyonlar:**
- `get_next_derivation_index()` - Atomik index artırma

### 2.2 Migration: `docker/init-db/05_tx_source_address.sql` (YENİ)

```sql
-- Add source address tracking to transactions
-- This enables HD address signing by tracking which derived address is spending

-- Transaction tablosuna yeni kolonlar
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_address TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS derivation_index INTEGER;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_transactions_source_address
    ON transactions(source_address) WHERE source_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id
    ON transactions(user_id) WHERE user_id IS NOT NULL;

-- Comments
COMMENT ON COLUMN transactions.source_address IS 'Source address for spending (derived HD address)';
COMMENT ON COLUMN transactions.derivation_index IS 'HD derivation index for signing tweak calculation';
COMMENT ON COLUMN transactions.user_id IS 'User who owns the source address';
```

### 2.3 user_addresses Tablosu Güncelleme

```sql
-- address_type kolonu eklenmeli (eğer yoksa)
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS address_type TEXT NOT NULL DEFAULT 'p2wpkh';

-- address_type constraint
ALTER TABLE user_addresses ADD CONSTRAINT chk_address_type
    CHECK (address_type IN ('p2wpkh', 'p2tr'));

COMMENT ON COLUMN user_addresses.address_type IS 'Address type: p2wpkh (SegWit) or p2tr (Taproot)';
```

---

## BÖLÜM 3: TYPES (crates/types/src/lib.rs)

### 3.1 User Struct

```rust
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub user_id: String,
    pub username: String,
    pub role: String,           // "admin", "user"
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}
```

### 3.2 UserAddress Struct

```rust
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserAddress {
    pub address: String,
    pub derivation_index: i32,
    pub derivation_path: String,
    pub public_key: String,
    pub address_type: AddressType,
    pub label: Option<String>,
    pub balance_sats: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
pub enum AddressType {
    #[serde(rename = "p2wpkh")]
    P2WPKH,     // SegWit - CGGMP24/ECDSA
    #[serde(rename = "p2tr")]
    P2TR,       // Taproot - FROST/Schnorr (YAKINDA)
}

impl AddressType {
    pub fn is_available(&self) -> bool {
        match self {
            AddressType::P2WPKH => true,   // ✅ Aktif
            AddressType::P2TR => false,    // 🔒 Yakında
        }
    }

    pub fn protocol(&self) -> SignatureProtocol {
        match self {
            AddressType::P2WPKH => SignatureProtocol::CGGMP24,
            AddressType::P2TR => SignatureProtocol::FROST,
        }
    }
}
```

### 3.3 Transaction Struct Güncelleme

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: i64,
    pub txid: TxId,
    pub state: TransactionState,
    pub unsigned_tx: Vec<u8>,
    pub signed_tx: Option<Vec<u8>>,
    pub recipient: String,
    pub amount_sats: u64,
    pub fee_sats: u64,
    pub metadata: Option<String>,
    // YENİ ALANLAR:
    pub source_address: Option<String>,      // Hangi adresten gönderiliyor
    pub derivation_index: Option<u32>,       // HD derivation index
    pub user_id: Option<String>,             // Hangi kullanıcının işlemi
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}
```

### 3.4 SigningRequest Struct Güncelleme

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SigningRequest {
    pub tx_id: TxId,
    pub unsigned_tx: Vec<u8>,
    pub message_hash: Vec<u8>,
    pub presignature_id: Option<PresignatureId>,
    pub protocol: SignatureProtocol,
    pub session_id: Uuid,
    // YENİ ALANLAR (HD Derivation için):
    pub derivation_index: Option<u32>,      // None = root address
    pub user_id: Option<String>,            // Tweak hesaplama için
    pub root_public_key: Option<Vec<u8>>,   // Tweak hesaplama için (33 bytes)
}
```

---

## BÖLÜM 4: BACKEND STORAGE LAYER

### Dosya: `crates/storage/src/postgres.rs` - EKLENECEK METODLAR

```rust
impl PostgresStorage {
    // ==================== USER METHODS ====================

    /// Get user by ID
    pub async fn get_user(&self, user_id: &str) -> Result<Option<User>, StorageError> {
        let user = sqlx::query_as!(
            User,
            r#"SELECT user_id, username, role, is_active, created_at
               FROM users WHERE user_id = $1"#,
            user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    /// List all active users
    pub async fn list_users(&self) -> Result<Vec<User>, StorageError> {
        let users = sqlx::query_as!(
            User,
            r#"SELECT user_id, username, role, is_active, created_at
               FROM users WHERE is_active = true ORDER BY created_at"#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(users)
    }

    // ==================== ADDRESS METHODS ====================

    /// Get next derivation index (atomic increment via PostgreSQL function)
    pub async fn get_next_derivation_index(&self) -> Result<u32, StorageError> {
        let row = sqlx::query_scalar!(
            r#"SELECT get_next_derivation_index() as "index!: i32""#
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(row as u32)
    }

    /// Create user address
    pub async fn create_user_address(
        &self,
        user_id: &str,
        address: &str,
        derivation_index: u32,
        derivation_path: &str,
        public_key: &str,
        address_type: &str,
        label: Option<&str>,
    ) -> Result<(), StorageError> {
        sqlx::query!(
            r#"INSERT INTO user_addresses
               (user_id, address, derivation_index, derivation_path, public_key, address_type, label)
               VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
            user_id,
            address,
            derivation_index as i32,
            derivation_path,
            public_key,
            address_type,
            label
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get user's addresses
    pub async fn get_user_addresses(&self, user_id: &str) -> Result<Vec<UserAddress>, StorageError> {
        let addresses = sqlx::query_as!(
            UserAddress,
            r#"SELECT
                address,
                derivation_index,
                derivation_path,
                public_key,
                address_type as "address_type: AddressType",
                label,
                balance_sats,
                created_at
               FROM user_addresses
               WHERE user_id = $1 AND NOT is_change
               ORDER BY derivation_index DESC"#,
            user_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(addresses)
    }

    /// Get address info by address string (for signing)
    pub async fn get_address_info(&self, address: &str) -> Result<Option<(u32, String)>, StorageError> {
        let row = sqlx::query!(
            r#"SELECT derivation_index, user_id FROM user_addresses WHERE address = $1"#,
            address
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| (r.derivation_index as u32, r.user_id)))
    }

    /// Update address label
    pub async fn update_address_label(
        &self,
        address: &str,
        label: Option<&str>,
    ) -> Result<bool, StorageError> {
        let result = sqlx::query!(
            r#"UPDATE user_addresses SET label = $1 WHERE address = $2"#,
            label,
            address
        )
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }
}
```

---

## BÖLÜM 5: COMMON UTILS - TWEAK HESAPLAMA

### Dosya: `crates/common/src/bitcoin_utils.rs` - EKLENECEK

```rust
use sha2::{Sha512, Digest};
use generic_ec::{Scalar, Point, curves::Secp256k1};

/// Proposal-compliant signing tweak calculation
///
/// Formül: tweak = SHA512(root_pubkey || user_id || "bitcoin" || index)[0:32]
///
/// Bu tweak, her node'un key_share'ine eklenerek derived address için imzalama yapılır.
pub fn calculate_proposal_tweak(
    root_pubkey: &[u8],
    user_id: &str,
    derivation_index: u32,
) -> Result<[u8; 32], MpcWalletError> {
    const CHAIN_ID: &[u8] = b"bitcoin";

    // Validate root pubkey (compressed, 33 bytes)
    if root_pubkey.len() != 33 {
        return Err(MpcWalletError::InvalidPublicKey(
            format!("Expected 33 bytes compressed pubkey, got {}", root_pubkey.len())
        ));
    }

    // SHA512(root_pubkey || user_id || chain_id || index)
    let mut hasher = Sha512::new();
    hasher.update(root_pubkey);
    hasher.update(user_id.as_bytes());
    hasher.update(CHAIN_ID);
    hasher.update(&derivation_index.to_be_bytes());

    let hash = hasher.finalize();

    // First 32 bytes = tweak
    let mut tweak = [0u8; 32];
    tweak.copy_from_slice(&hash[0..32]);

    // Validate tweak is valid scalar (< curve order)
    let _ = Scalar::<Secp256k1>::from_be_bytes(&tweak)
        .ok_or_else(|| MpcWalletError::Protocol("Tweak exceeds curve order".into()))?;

    tracing::debug!(
        "Calculated tweak for user={}, index={}: {}",
        user_id, derivation_index, hex::encode(&tweak)
    );

    Ok(tweak)
}

/// Derive child public key from tweak
///
/// child_pubkey = parent_pubkey + tweak * G
pub fn derive_child_pubkey(
    parent_pubkey: &[u8],
    tweak: &[u8; 32],
) -> Result<Vec<u8>, MpcWalletError> {
    // Parse parent public key
    let parent_point = Point::<Secp256k1>::from_bytes(parent_pubkey)
        .map_err(|_| MpcWalletError::InvalidPublicKey("Invalid parent pubkey".into()))?;

    // Parse tweak as scalar
    let tweak_scalar = Scalar::<Secp256k1>::from_be_bytes(tweak)
        .ok_or_else(|| MpcWalletError::Protocol("Invalid tweak scalar".into()))?;

    // child = parent + tweak * G
    let generator = Point::<Secp256k1>::generator();
    let tweak_point = generator * tweak_scalar;
    let child_point = parent_point + tweak_point;

    // Serialize compressed
    Ok(child_point.to_bytes(true).to_vec())
}

/// Scalar addition: a + b mod n
pub fn scalar_add(a: &[u8], b: &[u8]) -> Result<[u8; 32], MpcWalletError> {
    let a32: [u8; 32] = a.try_into()
        .map_err(|_| MpcWalletError::Protocol("Invalid scalar length".into()))?;
    let b32: [u8; 32] = b.try_into()
        .map_err(|_| MpcWalletError::Protocol("Invalid scalar length".into()))?;

    let scalar_a = Scalar::<Secp256k1>::from_be_bytes(&a32)
        .ok_or_else(|| MpcWalletError::Protocol("Invalid scalar a".into()))?;
    let scalar_b = Scalar::<Secp256k1>::from_be_bytes(&b32)
        .ok_or_else(|| MpcWalletError::Protocol("Invalid scalar b".into()))?;

    let sum = scalar_a + scalar_b;

    Ok(sum.to_be_bytes())
}

/// Generate Bitcoin address from derived public key
pub fn pubkey_to_address(
    pubkey: &[u8],
    address_type: AddressType,
    network: bitcoin::Network,
) -> Result<String, MpcWalletError> {
    use bitcoin::PublicKey;
    use bitcoin::address::Address;

    let pubkey = PublicKey::from_slice(pubkey)
        .map_err(|e| MpcWalletError::InvalidPublicKey(e.to_string()))?;

    let address = match address_type {
        AddressType::P2WPKH => {
            // SegWit Native (bech32) - tb1q...
            Address::p2wpkh(&pubkey, network)
        }
        AddressType::P2TR => {
            // Taproot - tb1p... (YAKINDA - şimdilik hata ver)
            return Err(MpcWalletError::Protocol(
                "Taproot addresses not yet supported. FROST DKG required.".into()
            ));
        }
    };

    Ok(address.to_string())
}
```

---

## BÖLÜM 6: API ENDPOINTS

### 6.1 Dosya: `crates/api/src/handlers/address.rs` (YENİ)

```rust
//! Address derivation handlers

use axum::{extract::{Path, State}, Json};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::{error::ApiError, state::AppState, ApiResult};
use threshold_types::{AddressType, UserAddress};
use common::bitcoin_utils::{calculate_proposal_tweak, derive_child_pubkey, pubkey_to_address};

// ==================== REQUEST/RESPONSE TYPES ====================

#[derive(Debug, Deserialize)]
pub struct DeriveAddressRequest {
    pub user_id: String,
    #[serde(default)]
    pub address_type: Option<String>,  // "p2wpkh" or "p2tr"
    pub label: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DeriveAddressResponse {
    pub address: String,
    pub derivation_path: String,
    pub derivation_index: u32,
    pub public_key: String,
    pub address_type: String,
    pub protocol: String,
}

#[derive(Debug, Serialize)]
pub struct UserAddressesResponse {
    pub user_id: String,
    pub total_count: usize,
    pub addresses: Vec<AddressInfo>,
}

#[derive(Debug, Serialize)]
pub struct AddressInfo {
    pub address: String,
    pub derivation_index: i32,
    pub derivation_path: String,
    pub public_key: String,
    pub address_type: String,
    pub label: Option<String>,
    pub balance_sats: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct AddressTypesResponse {
    pub types: Vec<AddressTypeInfo>,
}

#[derive(Debug, Serialize)]
pub struct AddressTypeInfo {
    pub address_type: String,
    pub name: String,
    pub protocol: String,
    pub available: bool,
    pub description: String,
}

// ==================== HANDLERS ====================

/// GET /api/v1/addresses/types - List available address types
pub async fn list_address_types() -> ApiResult<Json<AddressTypesResponse>> {
    Ok(Json(AddressTypesResponse {
        types: vec![
            AddressTypeInfo {
                address_type: "p2wpkh".into(),
                name: "SegWit (Native)".into(),
                protocol: "CGGMP24 (ECDSA)".into(),
                available: true,
                description: "Recommended. Lower fees, wide compatibility.".into(),
            },
            AddressTypeInfo {
                address_type: "p2tr".into(),
                name: "Taproot".into(),
                protocol: "FROST (Schnorr)".into(),
                available: false,  // 🔒 DISABLED
                description: "Coming soon. Requires FROST DKG integration.".into(),
            },
        ],
    }))
}

/// POST /api/v1/addresses/derive - Derive new address for user
pub async fn derive_address(
    State(state): State<AppState>,
    Json(req): Json<DeriveAddressRequest>,
) -> ApiResult<Json<DeriveAddressResponse>> {
    info!("Deriving address for user: {}", req.user_id);

    // 1. Parse and validate address type
    let address_type = match req.address_type.as_deref() {
        Some("p2tr") | Some("taproot") => {
            // 🔒 TAPROOT DISABLED
            return Err(ApiError::BadRequest(
                "Taproot addresses not yet available. FROST DKG integration pending.".into()
            ));
        }
        Some("p2wpkh") | Some("segwit") | None => AddressType::P2WPKH,
        Some(other) => {
            return Err(ApiError::BadRequest(
                format!("Unknown address type: {}. Use 'p2wpkh' or 'p2tr'.", other)
            ));
        }
    };

    // 2. Verify user exists
    let user = state.postgres.get_user(&req.user_id).await?
        .ok_or_else(|| ApiError::NotFound(format!("User not found: {}", req.user_id)))?;

    if !user.is_active {
        return Err(ApiError::BadRequest("User is not active".into()));
    }

    // 3. Get root public key from completed DKG
    let root_pubkey = get_root_public_key(&state).await?;

    // 4. Get next derivation index (atomic)
    let index = state.postgres.get_next_derivation_index().await?;

    // 5. Calculate proposal-compliant tweak
    let tweak = calculate_proposal_tweak(&root_pubkey, &req.user_id, index)
        .map_err(|e| ApiError::InternalError(format!("Tweak calculation failed: {}", e)))?;

    // 6. Derive child public key
    let child_pubkey = derive_child_pubkey(&root_pubkey, &tweak)
        .map_err(|e| ApiError::InternalError(format!("Child key derivation failed: {}", e)))?;

    // 7. Generate address
    let network = bitcoin::Network::Testnet; // TODO: Make configurable
    let address = pubkey_to_address(&child_pubkey, address_type, network)
        .map_err(|e| ApiError::InternalError(format!("Address generation failed: {}", e)))?;

    // 8. Build derivation path
    let derivation_path = format!("m/proposal/{}/{}", req.user_id, index);

    // 9. Save to database
    state.postgres.create_user_address(
        &req.user_id,
        &address,
        index,
        &derivation_path,
        &hex::encode(&child_pubkey),
        "p2wpkh",
        req.label.as_deref(),
    ).await?;

    info!(
        "Derived address for user {}: {} (index={})",
        req.user_id, address, index
    );

    Ok(Json(DeriveAddressResponse {
        address,
        derivation_path,
        derivation_index: index,
        public_key: hex::encode(&child_pubkey),
        address_type: "p2wpkh".into(),
        protocol: "CGGMP24".into(),
    }))
}

/// GET /api/v1/addresses/user/:user_id - List user's addresses
pub async fn list_user_addresses(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> ApiResult<Json<UserAddressesResponse>> {
    // Verify user exists
    let _ = state.postgres.get_user(&user_id).await?
        .ok_or_else(|| ApiError::NotFound(format!("User not found: {}", user_id)))?;

    let addresses = state.postgres.get_user_addresses(&user_id).await?;

    let address_infos: Vec<AddressInfo> = addresses.into_iter()
        .map(|a| AddressInfo {
            address: a.address,
            derivation_index: a.derivation_index,
            derivation_path: a.derivation_path,
            public_key: a.public_key,
            address_type: format!("{:?}", a.address_type).to_lowercase(),
            label: a.label,
            balance_sats: a.balance_sats,
            created_at: a.created_at,
        })
        .collect();

    Ok(Json(UserAddressesResponse {
        user_id,
        total_count: address_infos.len(),
        addresses: address_infos,
    }))
}

/// PUT /api/v1/addresses/:address/label - Update address label
pub async fn update_address_label(
    State(state): State<AppState>,
    Path(address): Path<String>,
    Json(req): Json<UpdateLabelRequest>,
) -> ApiResult<Json<UpdateLabelResponse>> {
    let updated = state.postgres.update_address_label(&address, req.label.as_deref()).await?;

    if !updated {
        return Err(ApiError::NotFound(format!("Address not found: {}", address)));
    }

    Ok(Json(UpdateLabelResponse { success: true }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateLabelRequest {
    pub label: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UpdateLabelResponse {
    pub success: bool,
}

// ==================== HELPERS ====================

/// Get root public key from completed DKG ceremony
async fn get_root_public_key(state: &AppState) -> Result<Vec<u8>, ApiError> {
    let ceremonies = state.dkg_service.list_ceremonies().await
        .map_err(|e| ApiError::InternalError(format!("Failed to list DKG ceremonies: {}", e)))?;

    let completed = ceremonies.iter()
        .filter(|c| c.status == threshold_types::DkgStatus::Completed)
        .max_by_key(|c| c.completed_at);

    match completed {
        Some(ceremony) => {
            ceremony.public_key.clone()
                .ok_or_else(|| ApiError::InternalError("Completed DKG has no public key".into()))
        }
        None => {
            Err(ApiError::BadRequest(
                "No completed DKG ceremony found. Please run DKG first.".into()
            ))
        }
    }
}
```

### 6.2 Dosya: `crates/api/src/handlers/admin.rs` (YENİ)

```rust
//! Admin handlers

use axum::{extract::State, Json};
use serde::Serialize;
use tracing::info;

use crate::{error::ApiError, state::AppState, ApiResult};

// ==================== RESPONSE TYPES ====================

#[derive(Debug, Serialize)]
pub struct AllWalletsResponse {
    pub users: Vec<UserWalletSummary>,
    pub total_users: usize,
    pub total_addresses: usize,
    pub total_balance_sats: i64,
}

#[derive(Debug, Serialize)]
pub struct UserWalletSummary {
    pub user_id: String,
    pub username: String,
    pub role: String,
    pub is_active: bool,
    pub address_count: usize,
    pub total_balance_sats: i64,
    pub addresses: Vec<AdminAddressInfo>,
}

#[derive(Debug, Serialize)]
pub struct AdminAddressInfo {
    pub address: String,
    pub derivation_index: i32,
    pub derivation_path: String,
    pub address_type: String,
    pub label: Option<String>,
    pub balance_sats: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

// ==================== HANDLERS ====================

/// GET /api/v1/admin/wallets - List all users with their addresses (Admin only)
pub async fn list_all_wallets(
    State(state): State<AppState>,
) -> ApiResult<Json<AllWalletsResponse>> {
    info!("Admin: Listing all user wallets");

    // 1. Get all users
    let users = state.postgres.list_users().await?;

    // 2. For each user, get their addresses
    let mut user_summaries = Vec::with_capacity(users.len());
    let mut total_addresses = 0;
    let mut total_balance: i64 = 0;

    for user in users {
        let addresses = state.postgres.get_user_addresses(&user.user_id).await?;
        let user_balance: i64 = addresses.iter().map(|a| a.balance_sats).sum();

        total_addresses += addresses.len();
        total_balance += user_balance;

        let address_infos: Vec<AdminAddressInfo> = addresses.into_iter()
            .map(|a| AdminAddressInfo {
                address: a.address,
                derivation_index: a.derivation_index,
                derivation_path: a.derivation_path,
                address_type: format!("{:?}", a.address_type).to_lowercase(),
                label: a.label,
                balance_sats: a.balance_sats,
                created_at: a.created_at,
            })
            .collect();

        user_summaries.push(UserWalletSummary {
            user_id: user.user_id,
            username: user.username,
            role: user.role,
            is_active: user.is_active,
            address_count: address_infos.len(),
            total_balance_sats: user_balance,
            addresses: address_infos,
        });
    }

    Ok(Json(AllWalletsResponse {
        total_users: user_summaries.len(),
        users: user_summaries,
        total_addresses,
        total_balance_sats: total_balance,
    }))
}
```

### 6.3 Dosya: `crates/api/src/routes/address.rs` (YENİ)

```rust
//! Address routes

use axum::{routing::{get, post, put}, Router};
use crate::{handlers, state::AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/types", get(handlers::address::list_address_types))
        .route("/derive", post(handlers::address::derive_address))
        .route("/user/:user_id", get(handlers::address::list_user_addresses))
        .route("/:address/label", put(handlers::address::update_address_label))
}
```

### 6.4 Dosya: `crates/api/src/routes/admin.rs` (YENİ)

```rust
//! Admin routes

use axum::{routing::get, Router};
use crate::{handlers, state::AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/wallets", get(handlers::admin::list_all_wallets))
}
```

### 6.5 Dosya: `crates/api/src/routes/mod.rs` - GÜNCELLEME

```rust
// Mevcut modüller...
pub mod address;
pub mod admin;

// main router'a ekle:
pub fn api_router() -> Router<AppState> {
    Router::new()
        // ... mevcut routes ...
        .nest("/addresses", address::router())
        .nest("/admin", admin::router())
}
```

---

## BÖLÜM 7: TRANSACTION HANDLER GÜNCELLEME

### Dosya: `crates/api/src/routes/transactions.rs` - GÜNCELLEME

```rust
/// Request to create a new transaction
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTransactionRequest {
    /// Recipient Bitcoin address
    pub recipient: String,
    /// Amount in satoshis
    pub amount_sats: u64,
    /// Source address (derived HD address) - NEW
    pub source_address: Option<String>,
    /// Optional OP_RETURN metadata (max 80 bytes)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<String>,
}
```

### Dosya: `crates/api/src/handlers/transactions.rs` - GÜNCELLEME

```rust
/// Create a new Bitcoin transaction with optional HD derivation support
pub async fn create_transaction(
    postgres: &PostgresStorage,
    bitcoin: &BitcoinClient,
    recipient: &str,
    amount_sats: u64,
    source_address: Option<&str>,  // NEW
    metadata: Option<&str>,
) -> Result<Transaction, ApiError> {
    info!(
        "Creating transaction: recipient={} amount={} source={:?}",
        recipient, amount_sats, source_address
    );

    // NEW: Get derivation info if source_address provided
    let (derivation_index, user_id) = match source_address {
        Some(addr) => {
            let info = postgres.get_address_info(addr).await?;
            match info {
                Some((index, uid)) => (Some(index), Some(uid)),
                None => {
                    return Err(ApiError::NotFound(
                        format!("Source address not found in wallet: {}", addr)
                    ));
                }
            }
        }
        None => (None, None),
    };

    // ... fee estimation code (unchanged) ...

    // Create transaction record with derivation info
    let tx = Transaction {
        id: 0,
        txid: txid.clone(),
        state: TransactionState::Pending,
        unsigned_tx: tx_bytes,
        signed_tx: None,
        recipient: recipient.to_string(),
        amount_sats,
        fee_sats: unsigned_transaction.fee_sats,
        metadata: metadata.map(|s| s.to_string()),
        // NEW FIELDS:
        source_address: source_address.map(|s| s.to_string()),
        derivation_index,
        user_id,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    // ... rest unchanged ...
}
```

---

## BÖLÜM 8: SIGNING INTEGRATION (KRİTİK)

### 8.1 SigningCoordinator Değişikliği

**Dosya:** `crates/orchestrator/src/signing_coordinator.rs`

```rust
/// Sign transaction with HD derivation support
pub async fn sign_transaction_with_derivation(
    &self,
    tx_id: &TxId,
    unsigned_tx: &[u8],
    protocol: SignatureProtocol,
    derivation_index: Option<u32>,
    user_id: Option<&str>,
) -> Result<CombinedSignature, OrchestrationError> {
    let start = Instant::now();

    info!(
        "Starting {} signing: tx_id={}, derivation_index={:?}, user_id={:?}",
        protocol, tx_id, derivation_index, user_id
    );

    // Get root public key if signing from derived address
    let root_public_key = match (&derivation_index, &user_id) {
        (Some(_), Some(_)) => {
            match self.get_root_public_key().await {
                Ok(pk) => Some(pk),
                Err(e) => {
                    error!("Failed to get root public key: {}", e);
                    return Err(OrchestrationError::Internal(
                        "Root public key not available for derived signing".into()
                    ));
                }
            }
        }
        _ => None,
    };

    // Calculate message hash
    let message_hash = self.calculate_sighash(unsigned_tx)?;

    // Get presignature (for CGGMP24)
    let presignature_id = match protocol {
        SignatureProtocol::CGGMP24 => self.acquire_presignature().await?,
        SignatureProtocol::FROST => None, // 🔒 FROST PLACEHOLDER
    };

    // Create signing session
    let session_id = Uuid::new_v4();

    // Build signing request with derivation info
    let request = SigningRequest {
        tx_id: tx_id.clone(),
        unsigned_tx: unsigned_tx.to_vec(),
        message_hash: message_hash.to_vec(),
        presignature_id: presignature_id.clone(),
        protocol,
        session_id,
        // HD DERIVATION FIELDS:
        derivation_index,
        user_id: user_id.map(String::from),
        root_public_key,
    };

    // Broadcast to all nodes
    let shares = self.broadcast_and_collect(&request).await?;

    // Combine signatures
    let signature = self.combine_signature_shares(shares, protocol)?;

    info!(
        "Signing complete: tx_id={}, duration={:?}",
        tx_id, start.elapsed()
    );

    Ok(signature)
}

/// Helper: Get root public key from DKG
async fn get_root_public_key(&self) -> Result<Vec<u8>, OrchestrationError> {
    // Try etcd first
    let key = "/mpc/dkg/root_public_key";
    if let Ok(Some(pk)) = self.etcd.get(key).await {
        return Ok(pk);
    }

    // Fallback to postgres
    let ceremonies = self.postgres.list_dkg_ceremonies().await?;
    let completed = ceremonies.into_iter()
        .filter(|c| c.status == DkgStatus::Completed)
        .max_by_key(|c| c.completed_at);

    completed
        .and_then(|c| c.public_key)
        .ok_or_else(|| OrchestrationError::Internal("No completed DKG found".into()))
}
```

### 8.2 Service.rs Değişikliği

**Dosya:** `crates/orchestrator/src/service.rs`

```rust
async fn transition_approved_to_signing(&self, tx: &Transaction) -> Result<()> {
    info!("Transitioning tx {} to Signing state", tx.txid);

    // Update state
    self.postgres.update_transaction_state(&tx.txid, TransactionState::Signing).await?;

    // Determine protocol based on address type
    let protocol = self.protocol_router.route(&tx.recipient);

    // NEW: Sign with derivation support
    let combined_signature = self.signing_coordinator
        .sign_transaction_with_derivation(
            &tx.txid,
            &tx.unsigned_tx,
            protocol,
            tx.derivation_index,        // NEW
            tx.user_id.as_deref(),       // NEW
        )
        .await?;

    // ... rest unchanged ...
}
```

---

## BÖLÜM 9: NODE SIGNING DEĞİŞİKLİĞİ (KRİTİK)

### 9.1 Internal Signing Handler

**Dosya:** `crates/api/src/handlers/internal.rs` - EKLEME

```rust
use common::bitcoin_utils::calculate_proposal_tweak;

/// Handle signing request from coordinator
/// Bu handler her node'da çalışır ve signing request'i işler
pub async fn handle_signing_request(
    State(state): State<AppState>,
    Json(request): Json<SigningRequest>,
) -> ApiResult<Json<SignatureShare>> {
    info!(
        "Received signing request: session={}, derivation_index={:?}, user_id={:?}",
        request.session_id, request.derivation_index, request.user_id
    );

    // 1. Load key share from storage
    let key_share_data = state.load_key_share().await
        .map_err(|e| ApiError::InternalError(format!("Failed to load key share: {}", e)))?;

    // 2. Load aux info (for CGGMP24)
    let aux_info_data = state.load_aux_info().await
        .map_err(|e| ApiError::InternalError(format!("Failed to load aux info: {}", e)))?;

    // 3. Calculate and apply tweak if derived address
    let adjusted_key_share = match (
        &request.derivation_index,
        &request.user_id,
        &request.root_public_key
    ) {
        (Some(index), Some(user_id), Some(root_pk)) => {
            info!("Applying HD derivation tweak: user={}, index={}", user_id, index);

            // Calculate proposal-compliant tweak
            let tweak = calculate_proposal_tweak(root_pk, user_id, *index)
                .map_err(|e| ApiError::InternalError(
                    format!("Tweak calculation failed: {}", e)
                ))?;

            // Adjust key share
            adjust_key_share_cggmp24(&key_share_data, &tweak)
                .map_err(|e| ApiError::InternalError(
                    format!("Key share adjustment failed: {}", e)
                ))?
        }
        _ => {
            // Root address - use original key share
            info!("Using root key share (no derivation)");
            key_share_data.clone()
        }
    };

    // 4. Execute signing protocol
    let partial_signature = match request.protocol {
        SignatureProtocol::CGGMP24 => {
            cggmp24_sign_with_share(
                &adjusted_key_share,
                &aux_info_data,
                &request.message_hash,
                request.presignature_id.as_ref(),
            ).await?
        }
        SignatureProtocol::FROST => {
            // 🔒 FROST PLACEHOLDER - Not implemented yet
            return Err(ApiError::BadRequest(
                "FROST signing not yet implemented. Taproot support coming soon.".into()
            ));
        }
    };

    info!(
        "Generated partial signature for session={}",
        request.session_id
    );

    Ok(Json(SignatureShare {
        tx_id: request.tx_id,
        node_id: state.node_id,
        partial_signature,
        presignature_id: request.presignature_id,
        session_id: request.session_id,
    }))
}

/// Adjust CGGMP24 key share by adding tweak
///
/// adjusted_share = original_share + tweak (mod curve order)
fn adjust_key_share_cggmp24(
    key_share_data: &[u8],
    tweak: &[u8; 32],
) -> Result<Vec<u8>, String> {
    use generic_ec::{Scalar, curves::Secp256k1};
    use cggmp24::KeyShare;

    // Deserialize key share
    let mut key_share: KeyShare<Secp256k1> = bincode::deserialize(key_share_data)
        .map_err(|e| format!("Key share deserialize error: {}", e))?;

    // Convert tweak to scalar
    let tweak_scalar = Scalar::<Secp256k1>::from_be_bytes(tweak)
        .ok_or("Invalid tweak: exceeds curve order")?;

    // Add tweak to secret share: adjusted = original + tweak (mod n)
    // This is the key operation for HD derivation signing
    key_share.x = key_share.x + tweak_scalar;

    // Serialize back
    let adjusted_data = bincode::serialize(&key_share)
        .map_err(|e| format!("Key share serialize error: {}", e))?;

    Ok(adjusted_data)
}

/// 🔒 FROST PLACEHOLDER - Adjust FROST key share
///
/// NOT IMPLEMENTED: FROST DKG integration required first
#[allow(dead_code)]
fn adjust_key_share_frost(
    _key_share_data: &[u8],
    _tweak: &[u8; 32],
) -> Result<Vec<u8>, String> {
    Err("FROST key share adjustment not implemented. Awaiting FROST DKG integration.".into())
}
```

### 9.2 Internal Routes Güncelleme

**Dosya:** `crates/api/src/routes/internal.rs`

```rust
pub fn router() -> Router<AppState> {
    Router::new()
        // Mevcut routes...
        .route("/signing-join", post(handlers::internal::handle_signing_join))
        .route("/signing-request", post(handlers::internal::handle_signing_request)) // YENİ
}
```

---

## BÖLÜM 10: FRONTEND

### 10.1 API Types - `src/types/address.ts`

```typescript
// Address Types
export type AddressType = 'p2wpkh' | 'p2tr';

export interface AddressTypeInfo {
  address_type: AddressType;
  name: string;
  protocol: string;
  available: boolean;
  description: string;
}

export interface UserAddress {
  address: string;
  derivation_index: number;
  derivation_path: string;
  public_key: string;
  address_type: AddressType;
  label: string | null;
  balance_sats: number;
  created_at: string;
}

export interface DeriveAddressRequest {
  user_id: string;
  address_type?: AddressType;
  label?: string;
}

export interface DeriveAddressResponse {
  address: string;
  derivation_path: string;
  derivation_index: number;
  public_key: string;
  address_type: string;
  protocol: string;
}

export interface UserAddressesResponse {
  user_id: string;
  total_count: number;
  addresses: UserAddress[];
}

// Admin Types
export interface UserWalletSummary {
  user_id: string;
  username: string;
  role: string;
  is_active: boolean;
  address_count: number;
  total_balance_sats: number;
  addresses: UserAddress[];
}

export interface AllWalletsResponse {
  users: UserWalletSummary[];
  total_users: number;
  total_addresses: number;
  total_balance_sats: number;
}
```

### 10.2 Hooks - `src/hooks/useAddresses.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type {
  AddressTypeInfo,
  DeriveAddressRequest,
  DeriveAddressResponse,
  UserAddressesResponse
} from '@/types/address';

// Get available address types
export function useAddressTypes() {
  return useQuery({
    queryKey: ['addressTypes'],
    queryFn: async () => {
      const { data } = await api.get<{ types: AddressTypeInfo[] }>('/addresses/types');
      return data.types;
    },
    staleTime: Infinity, // Types don't change
  });
}

// Get user's addresses
export function useUserAddresses(userId: string) {
  return useQuery({
    queryKey: ['addresses', userId],
    queryFn: async () => {
      const { data } = await api.get<UserAddressesResponse>(`/addresses/user/${userId}`);
      return data;
    },
    enabled: !!userId,
  });
}

// Derive new address
export function useDeriveAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: DeriveAddressRequest) => {
      const { data } = await api.post<DeriveAddressResponse>('/addresses/derive', req);
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate user's address list
      queryClient.invalidateQueries({ queryKey: ['addresses', variables.user_id] });
      // Also invalidate admin wallets view
      queryClient.invalidateQueries({ queryKey: ['admin', 'wallets'] });
    },
  });
}

// Update address label
export function useUpdateAddressLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ address, label }: { address: string; label: string | null }) => {
      await api.put(`/addresses/${address}/label`, { label });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
  });
}
```

### 10.3 Hooks - `src/hooks/useAdminWallets.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { AllWalletsResponse } from '@/types/address';

// Admin: Get all users with their addresses
export function useAllWallets() {
  return useQuery({
    queryKey: ['admin', 'wallets'],
    queryFn: async () => {
      const { data } = await api.get<AllWalletsResponse>('/admin/wallets');
      return data;
    },
  });
}
```

### 10.4 Page - `src/pages/user/Receive.tsx`

```tsx
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuthStore } from '@/stores/authStore';
import { useUserAddresses, useDeriveAddress, useAddressTypes } from '@/hooks/useAddresses';
import { Card, Button, Badge, Spinner, Select, Input, Modal } from '@/components/common';
import { formatSats, truncateAddress } from '@/utils/formatters';
import { CopyIcon, PlusIcon, CheckIcon } from '@/components/icons';

export function ReceivePage() {
  const { user } = useAuthStore();
  const { data: addressTypes } = useAddressTypes();
  const { data, isLoading, error } = useUserAddresses(user?.id || '');
  const deriveAddress = useDeriveAddress();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showNewAddressModal, setShowNewAddressModal] = useState(false);
  const [newAddressType, setNewAddressType] = useState<'p2wpkh' | 'p2tr'>('p2wpkh');
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [copied, setCopied] = useState(false);

  if (isLoading) return <Spinner />;
  if (error) return <div className="text-red-500">Error loading addresses</div>;

  const addresses = data?.addresses || [];
  const selectedAddress = addresses[selectedIndex];

  const handleCopy = () => {
    if (selectedAddress) {
      navigator.clipboard.writeText(selectedAddress.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeriveAddress = () => {
    deriveAddress.mutate({
      user_id: user!.id,
      address_type: newAddressType,
      label: newAddressLabel || undefined,
    }, {
      onSuccess: () => {
        setShowNewAddressModal(false);
        setNewAddressLabel('');
        setSelectedIndex(0); // Select newest
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Receive Bitcoin</h1>
        <Button onClick={() => setShowNewAddressModal(true)}>
          <PlusIcon className="w-4 h-4 mr-2" />
          New Address
        </Button>
      </div>

      {/* QR Code Card */}
      {selectedAddress ? (
        <Card className="text-center p-6">
          <div className="inline-block p-4 bg-white rounded-lg">
            <QRCodeSVG
              value={`bitcoin:${selectedAddress.address}`}
              size={200}
              level="M"
            />
          </div>

          <div className="mt-4 space-y-2">
            <p className="font-mono text-sm break-all">
              {selectedAddress.address}
            </p>

            <div className="flex justify-center gap-2">
              <Badge variant={selectedAddress.address_type === 'p2wpkh' ? 'success' : 'info'}>
                {selectedAddress.address_type === 'p2wpkh' ? 'SegWit' : 'Taproot'}
              </Badge>
              <Badge>Index #{selectedAddress.derivation_index}</Badge>
            </div>

            {selectedAddress.label && (
              <p className="text-gray-500">{selectedAddress.label}</p>
            )}

            <Button variant="outline" onClick={handleCopy}>
              {copied ? <CheckIcon className="w-4 h-4 mr-2" /> : <CopyIcon className="w-4 h-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy Address'}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="text-center p-6">
          <p className="text-gray-500">No addresses yet. Generate your first address!</p>
          <Button className="mt-4" onClick={() => setShowNewAddressModal(true)}>
            Generate Address
          </Button>
        </Card>
      )}

      {/* Address List */}
      {addresses.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-4">My Addresses ({addresses.length})</h3>
          <div className="space-y-2">
            {addresses.map((addr, i) => (
              <div
                key={addr.address}
                onClick={() => setSelectedIndex(i)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  i === selectedIndex
                    ? 'bg-primary-50 border-2 border-primary-500'
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-mono text-sm">
                      {truncateAddress(addr.address)}
                    </p>
                    {addr.label && (
                      <p className="text-xs text-gray-500">{addr.label}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge size="sm">#{addr.derivation_index}</Badge>
                    <p className="text-sm font-mono mt-1">
                      {formatSats(addr.balance_sats)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* New Address Modal */}
      <Modal
        isOpen={showNewAddressModal}
        onClose={() => setShowNewAddressModal(false)}
        title="Generate New Address"
      >
        <div className="space-y-4">
          {/* Address Type Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Address Type</label>
            <div className="grid grid-cols-2 gap-3">
              {addressTypes?.map((type) => (
                <div
                  key={type.address_type}
                  onClick={() => type.available && setNewAddressType(type.address_type as 'p2wpkh' | 'p2tr')}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    !type.available
                      ? 'opacity-50 cursor-not-allowed bg-gray-100'
                      : newAddressType === type.address_type
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{type.name}</p>
                      <p className="text-xs text-gray-500">{type.protocol}</p>
                    </div>
                    {!type.available && (
                      <Badge variant="warning" size="sm">Soon</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{type.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Label Input */}
          <div>
            <label className="block text-sm font-medium mb-2">Label (Optional)</label>
            <Input
              value={newAddressLabel}
              onChange={(e) => setNewAddressLabel(e.target.value)}
              placeholder="e.g., Savings, Business, etc."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowNewAddressModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleDeriveAddress}
              disabled={deriveAddress.isPending}
            >
              {deriveAddress.isPending ? 'Generating...' : 'Generate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
```

### 10.5 Page - `src/pages/admin/Wallets.tsx`

```tsx
import { useState } from 'react';
import { useAllWallets } from '@/hooks/useAdminWallets';
import { Card, Badge, Spinner, Input, Table } from '@/components/common';
import { formatSats, truncateAddress } from '@/utils/formatters';
import { SearchIcon, UsersIcon, WalletIcon } from '@/components/icons';

export function AdminWalletsPage() {
  const { data, isLoading, error } = useAllWallets();
  const [searchQuery, setSearchQuery] = useState('');

  if (isLoading) return <Spinner />;
  if (error) return <div className="text-red-500">Error loading wallets</div>;

  // Filter users by search query
  const filteredUsers = data?.users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.addresses.some(a => a.address.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">All User Wallets</h1>
        <div className="flex gap-4">
          <Badge variant="info" className="flex items-center gap-2">
            <UsersIcon className="w-4 h-4" />
            {data?.total_users || 0} Users
          </Badge>
          <Badge variant="info" className="flex items-center gap-2">
            <WalletIcon className="w-4 h-4" />
            {data?.total_addresses || 0} Addresses
          </Badge>
          <Badge variant="success">
            Total: {formatSats(data?.total_balance_sats || 0)}
          </Badge>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by username, user ID, or address..."
          className="pl-10"
        />
      </div>

      {/* User Cards */}
      {filteredUsers.map((user) => (
        <Card key={user.user_id} className="p-4">
          {/* User Header */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{user.username}</h2>
                <Badge variant={user.role === 'admin' ? 'warning' : 'default'} size="sm">
                  {user.role}
                </Badge>
                {!user.is_active && (
                  <Badge variant="error" size="sm">Inactive</Badge>
                )}
              </div>
              <span className="text-gray-500 text-sm">ID: {user.user_id}</span>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">
                {user.address_count} addresses
              </div>
              <div className="font-mono font-bold">
                {formatSats(user.total_balance_sats)}
              </div>
            </div>
          </div>

          {/* Address Table */}
          {user.addresses.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Type</th>
                  <th>Index</th>
                  <th>Label</th>
                  <th>Balance</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {user.addresses.map((addr) => (
                  <tr key={addr.address}>
                    <td className="font-mono text-sm">
                      {truncateAddress(addr.address)}
                    </td>
                    <td>
                      <Badge
                        variant={addr.address_type === 'p2wpkh' ? 'success' : 'info'}
                        size="sm"
                      >
                        {addr.address_type === 'p2wpkh' ? 'SegWit' : 'Taproot'}
                      </Badge>
                    </td>
                    <td>
                      <Badge size="sm">#{addr.derivation_index}</Badge>
                    </td>
                    <td className="text-gray-500">{addr.label || '-'}</td>
                    <td className="font-mono">{formatSats(addr.balance_sats)}</td>
                    <td className="text-sm text-gray-500">
                      {new Date(addr.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="text-center py-4 text-gray-500">
              No addresses generated yet
            </div>
          )}
        </Card>
      ))}

      {filteredUsers.length === 0 && (
        <Card className="text-center py-8">
          <p className="text-gray-500">No users found matching "{searchQuery}"</p>
        </Card>
      )}
    </div>
  );
}
```

### 10.6 Router Ekleme

```typescript
// src/router.tsx
import { AdminWalletsPage } from '@/pages/admin/Wallets';
import { ReceivePage } from '@/pages/user/Receive';

// Admin routes
{
  path: '/admin/wallets',
  element: <AdminWalletsPage />,
}

// User routes
{
  path: '/user/receive',
  element: <ReceivePage />,
}
```

### 10.7 Admin Sidebar Güncelleme

```tsx
// src/components/layout/AdminSidebar.tsx
const menuItems = [
  // ... existing items ...
  {
    label: 'Wallets',
    path: '/admin/wallets',
    icon: WalletIcon,
  },
];
```

---

## BÖLÜM 11: TEST SENARYOLARI

```bash
# 1. Address types listele
curl localhost:8081/api/v1/addresses/types
# → {"types":[{"address_type":"p2wpkh","available":true,...},{"address_type":"p2tr","available":false,...}]}

# 2. SegWit address derive (user1)
curl -X POST localhost:8081/api/v1/addresses/derive \
  -d '{"user_id":"user1","address_type":"p2wpkh"}' \
  -H "Content-Type: application/json"
# → {"address":"tb1q...","derivation_index":0,"protocol":"CGGMP24"}

# 3. Taproot address derive (SHOULD FAIL)
curl -X POST localhost:8081/api/v1/addresses/derive \
  -d '{"user_id":"user1","address_type":"p2tr"}' \
  -H "Content-Type: application/json"
# → {"error":"Taproot addresses not yet available. FROST DKG integration pending."}

# 4. List user1 addresses
curl localhost:8081/api/v1/addresses/user/user1
# → {"user_id":"user1","total_count":1,"addresses":[...]}

# 5. Admin: List all wallets
curl localhost:8081/api/v1/admin/wallets
# → {"users":[...],"total_users":3,"total_addresses":1,"total_balance_sats":0}

# 6. Send from derived address
curl -X POST localhost:8081/api/v1/transactions \
  -d '{"recipient":"tb1qxyz...","amount_sats":10000,"source_address":"tb1q..."}' \
  -H "Content-Type: application/json"
# → {"txid":"...","state":"pending"}
```

---

## BÖLÜM 12: UYGULAMA CHECKLIST

### Database & Migration
- [x] `04_user_addresses.sql` - Users ve addresses tabloları
- [x] `docker-compose.yml` - Mount eklendi
- [ ] `05_tx_source_address.sql` - Transaction tablosu değişikliği

### Types (crates/types/src/lib.rs)
- [ ] `User` struct
- [ ] `UserAddress` struct
- [ ] `AddressType` enum (P2WPKH, P2TR)
- [ ] `Transaction` struct güncelleme (source_address, derivation_index, user_id)
- [ ] `SigningRequest` struct güncelleme (derivation_index, user_id, root_public_key)

### Storage Layer (crates/storage/src/postgres.rs)
- [ ] `get_user()`
- [ ] `list_users()`
- [ ] `get_next_derivation_index()`
- [ ] `create_user_address()`
- [ ] `get_user_addresses()`
- [ ] `get_address_info()`
- [ ] `update_address_label()`

### Common Utils (crates/common/src/bitcoin_utils.rs)
- [ ] `calculate_proposal_tweak()` - Proposal-compliant tweak
- [ ] `derive_child_pubkey()` - Child key derivation
- [ ] `scalar_add()` - Scalar toplama
- [ ] `pubkey_to_address()` - Address generation

### API Layer
- [ ] `handlers/address.rs` - Address endpoints
- [ ] `handlers/admin.rs` - Admin wallet endpoint
- [ ] `routes/address.rs` - Address routes
- [ ] `routes/admin.rs` - Admin routes
- [ ] `routes/mod.rs` - Router ekleme
- [ ] `handlers/transactions.rs` - source_address desteği

### Orchestrator
- [ ] `signing_coordinator.rs` - `sign_transaction_with_derivation()` method
- [ ] `signing_coordinator.rs` - `get_root_public_key()` helper
- [ ] `service.rs` - derivation_index ve user_id geçirme

### Node Signing
- [ ] `handlers/internal.rs` - `handle_signing_request()` handler
- [ ] `handlers/internal.rs` - `adjust_key_share_cggmp24()` fonksiyonu
- [ ] `handlers/internal.rs` - `adjust_key_share_frost()` placeholder
- [ ] `routes/internal.rs` - Route ekleme

### Frontend
- [ ] `src/types/address.ts` - TypeScript types
- [ ] `src/hooks/useAddresses.ts` - User address hooks
- [ ] `src/hooks/useAdminWallets.ts` - Admin wallet hook
- [ ] `src/pages/user/Receive.tsx` - Address list + QR + type selection
- [ ] `src/pages/admin/Wallets.tsx` - All users wallet view
- [ ] Router updates
- [ ] Admin sidebar link

---

## SONUÇ

Bu plan **tam ve eksiksiz implementasyon** içeriyor:

### Proposal Uyumu
- ✅ `tweak = SHA512(root_pubkey || user_id || "bitcoin" || index)[0:32]`
- ✅ User ID derivation'a dahil
- ✅ Chain ID hardcoded ("bitcoin")

### Adres Tipleri
- ✅ **SegWit (P2WPKH)**: CGGMP24/ECDSA - AKTİF
- 🔒 **Taproot (P2TR)**: FROST/Schnorr - YAKINDA (disabled placeholder)

### Backend Değişiklikleri
- ✅ Database migration
- ✅ Storage layer metodları
- ✅ API endpoints (address, admin)
- ✅ Signing tweak hesaplama
- ✅ Node signing handler
- ✅ Transaction source_address desteği

### Frontend Değişiklikleri
- ✅ User Receive page (QR, address list, type selection)
- ✅ Admin Wallets page (tüm kullanıcıları görme)
- ✅ Hooks ve types

### Signing Flow
1. **Transaction Creation**: source_address → derivation_index + user_id lookup
2. **Voting**: Değişiklik yok
3. **SigningRequest**: derivation_index + user_id + root_public_key eklendi
4. **Node Signing**: Tweak hesapla → key_share + tweak → imzala
5. **Signature Combination**: Değişiklik yok
6. **Broadcast**: Değişiklik yok
