# User-Specific HD Address Derivation - TAM UYGULAMA PLANI

## Genel Bakış

Her kullanıcının (user1, user2) kendi Bitcoin adreslerini türetebileceği bir sistem.
- Kullanıcılar "Yeni Adres Üret" butonuna basarak yeni adres alabilir
- Her kullanıcı birden fazla adrese sahip olabilir
- Adresler kalıcı olarak veritabanında saklanır
- Tüm adresler aynı MPC public key'den HD derivation ile türetilir
- **Derived adreslerden harcama yapılabilir (signing tweak ile)**

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
Database'e `derivation_index` de kaydedilecek.

**2. Her Node'da İmzalama (Asıl değişiklik)**

Şu an node şunu yapıyor:
```
key_share ile imzala → signature
```

Sonra node şunu yapacak:
```
if (derivation_index var) {
    tweak = hesapla(root_pubkey, index)
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

## BÖLÜM 1: MEVCUT ALTYAPI

### ✅ HD Derivation Kodu (Var)

**Dosya:** `crates/common/src/bitcoin_utils.rs`

```rust
impl ExtendedPubKey {
    pub fn derive_child(&self, index: u32) -> Result<Self> {
        // I = HMAC-SHA512(chain_code, pubkey || index)
        let result = hmac_sha512(&self.chain_code, &data);

        // IL = tweak (ilk 32 byte) ← SIGNING İÇİN BU KULLANILACAK
        // IR = new chain code (son 32 byte)
        let il = &result[0..32];
        let ir = &result[32..64];

        // child_pubkey = parent_pubkey + IL * G
        let child_pubkey = point_add_scalar(&self.public_key, il)?;
    }
}
```

### ✅ Signing Altyapısı (Var)

**Dosya:** `crates/orchestrator/src/signing_coordinator.rs`

---

## BÖLÜM 2: VERİTABANI ✅ YAZILDI

### Migration: `docker/init-db/04_user_addresses.sql`

**Tablolar:**
- `users` - user1, user2, admin
- `user_addresses` - derivation_index, address, user_id
- `wallet_state` - next_derivation_index counter

**Fonksiyonlar:**
- `get_next_derivation_index()` - Atomik index artırma

---

## BÖLÜM 3: BACKEND STORAGE LAYER

### Dosya: `crates/storage/src/postgres.rs` - EKLENECEK METODLAR

```rust
impl PostgresStorage {
    /// Get user by ID
    pub async fn get_user(&self, user_id: &str) -> Result<Option<User>> {
        sqlx::query_as!(
            User,
            r#"SELECT user_id, username, role, is_active, created_at
               FROM users WHERE user_id = $1"#,
            user_id
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(Into::into)
    }

    /// List all active users
    pub async fn list_users(&self) -> Result<Vec<User>> {
        sqlx::query_as!(
            User,
            r#"SELECT user_id, username, role, is_active, created_at
               FROM users WHERE is_active = true ORDER BY created_at"#
        )
        .fetch_all(&self.pool)
        .await
        .map_err(Into::into)
    }

    /// Get next derivation index (atomic increment)
    pub async fn get_next_derivation_index(&self) -> Result<u32> {
        let row = sqlx::query_scalar!(
            r#"SELECT get_next_derivation_index() as "index!""#
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
    ) -> Result<()> {
        sqlx::query!(
            r#"INSERT INTO user_addresses
               (user_id, address, derivation_index, derivation_path, public_key, address_type, label)
               VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
            user_id, address, derivation_index as i32,
            derivation_path, public_key, address_type, label
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Get user's addresses
    pub async fn get_user_addresses(&self, user_id: &str) -> Result<Vec<UserAddress>> {
        sqlx::query_as!(
            UserAddress,
            r#"SELECT address, derivation_index, derivation_path, public_key,
                      address_type, label, balance_sats, created_at
               FROM user_addresses WHERE user_id = $1 AND NOT is_change
               ORDER BY derivation_index DESC"#,
            user_id
        )
        .fetch_all(&self.pool)
        .await
        .map_err(Into::into)
    }

    /// Get derivation index for address (signing için)
    pub async fn get_address_derivation_index(&self, address: &str) -> Result<Option<u32>> {
        let row = sqlx::query_scalar!(
            r#"SELECT derivation_index FROM user_addresses WHERE address = $1"#,
            address
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(|i| i as u32))
    }
}
```

---

## BÖLÜM 4: API ENDPOINTS

### Dosya: `crates/api/src/handlers/address.rs` (YENİ)

```rust
use axum::{extract::{Path, State}, Json};
use common::bitcoin_utils::MpcHdWallet;
use bitcoin::Network;

/// POST /api/v1/addresses/derive
pub async fn derive_address(
    State(state): State<AppState>,
    Json(req): Json<DeriveAddressRequest>,
) -> ApiResult<Json<DeriveAddressResponse>> {
    // 1. Verify user exists
    let _user = state.postgres.get_user(&req.user_id).await?
        .ok_or_else(|| ApiError::NotFound("User not found".into()))?;

    // 2. Get root public key from completed DKG
    let root_pubkey = get_root_public_key(&state).await?;

    // 3. Get next derivation index (atomic)
    let index = state.postgres.get_next_derivation_index().await?;

    // 4. Create HD wallet and derive address
    let hd_wallet = MpcHdWallet::new(&root_pubkey, Network::Testnet)?;
    let derived = hd_wallet.get_receiving_address(index)?;

    // 5. Save to database
    state.postgres.create_user_address(
        &req.user_id,
        &derived.address,
        index,
        &derived.path,
        &derived.public_key,
        "p2wpkh",
        req.label.as_deref(),
    ).await?;

    Ok(Json(DeriveAddressResponse {
        address: derived.address,
        derivation_path: derived.path,
        derivation_index: index,
        public_key: derived.public_key,
        address_type: "p2wpkh".into(),
    }))
}

/// GET /api/v1/addresses/user/:user_id
pub async fn list_user_addresses(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> ApiResult<Json<UserAddressesResponse>> {
    let addresses = state.postgres.get_user_addresses(&user_id).await?;
    Ok(Json(UserAddressesResponse {
        user_id,
        total_count: addresses.len(),
        addresses: addresses.into_iter().map(Into::into).collect(),
    }))
}

/// Helper: Get root public key from DKG
async fn get_root_public_key(state: &AppState) -> Result<Vec<u8>, ApiError> {
    let ceremonies = state.dkg_service.list_ceremonies().await?;
    let completed = ceremonies.iter()
        .filter(|c| matches!(c.status, DkgStatus::Completed))
        .max_by_key(|c| c.completed_at);

    completed
        .and_then(|c| c.public_key.clone())
        .ok_or_else(|| ApiError::NotFound("No completed DKG".into()))
}
```

### Routes: `crates/api/src/routes/address.rs`

```rust
use axum::{routing::{get, post, put}, Router};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/derive", post(handlers::address::derive_address))
        .route("/user/:user_id", get(handlers::address::list_user_addresses))
        .route("/:address/label", put(handlers::address::update_label))
}

// main router'a ekle:
// .nest("/addresses", address::router())
```

---

## BÖLÜM 5: SIGNING INTEGRATION (KRİTİK)

### 5.1 Tweak Hesaplama - `crates/common/src/bitcoin_utils.rs`

```rust
/// Calculate BIP-32 signing tweak for derived address
///
/// Bu tweak, key share'e eklenerek derived address için imzalama yapılır.
/// tweak = IL_change + IL_index (iki derivation step'in toplamı)
pub fn calculate_signing_tweak(
    root_pubkey: &[u8],
    derivation_index: u32,
) -> Result<[u8; 32], MpcWalletError> {
    use hmac::{Hmac, Mac};
    use sha2::Sha512;

    if root_pubkey.len() != 33 {
        return Err(MpcWalletError::InvalidPublicKey("Expected 33 bytes".into()));
    }

    // Create extended pubkey from root
    let xpub = ExtendedPubKey::from_public_key(root_pubkey)?;

    // Step 1: Calculate tweak for change=0 derivation
    let mut data1 = Vec::with_capacity(37);
    data1.extend_from_slice(&xpub.public_key);
    data1.extend_from_slice(&0u32.to_be_bytes()); // change = 0

    type HmacSha512 = Hmac<Sha512>;
    let mut mac1 = HmacSha512::new_from_slice(&xpub.chain_code)?;
    mac1.update(&data1);
    let result1 = mac1.finalize().into_bytes();
    let tweak1 = &result1[0..32];
    let chain_code1 = &result1[32..64];

    // Calculate child pubkey for change=0 (needed for step 2)
    let child_pubkey = point_add_scalar(&xpub.public_key, tweak1)?;

    // Step 2: Calculate tweak for index derivation
    let mut data2 = Vec::with_capacity(37);
    data2.extend_from_slice(&child_pubkey);
    data2.extend_from_slice(&derivation_index.to_be_bytes());

    let mut mac2 = HmacSha512::new_from_slice(chain_code1)?;
    mac2.update(&data2);
    let result2 = mac2.finalize().into_bytes();
    let tweak2 = &result2[0..32];

    // Total tweak = tweak1 + tweak2 (mod curve order)
    let total_tweak = scalar_add(tweak1, tweak2)?;

    tracing::debug!("Signing tweak for index {}: {}", derivation_index, hex::encode(&total_tweak));
    Ok(total_tweak)
}

/// Add two scalars mod secp256k1 order
fn scalar_add(a: &[u8], b: &[u8]) -> Result<[u8; 32], MpcWalletError> {
    use generic_ec::{Scalar, curves::Secp256k1};

    let mut a32 = [0u8; 32];
    let mut b32 = [0u8; 32];
    a32.copy_from_slice(a);
    b32.copy_from_slice(b);

    let scalar_a = Scalar::<Secp256k1>::from_be_bytes(&a32)
        .map_err(|_| MpcWalletError::Protocol("Invalid scalar".into()))?;
    let scalar_b = Scalar::<Secp256k1>::from_be_bytes(&b32)
        .map_err(|_| MpcWalletError::Protocol("Invalid scalar".into()))?;

    let sum = scalar_a + scalar_b;
    Ok(sum.to_be_bytes().try_into().unwrap())
}
```

### 5.2 SigningRequest'e derivation_index Ekle

**Dosya:** `crates/orchestrator/src/signing_coordinator.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SigningRequest {
    pub tx_id: TxId,
    pub unsigned_tx: Vec<u8>,
    pub message_hash: Vec<u8>,
    pub presignature_id: Option<PresignatureId>,
    pub protocol: SignatureProtocol,
    pub session_id: Uuid,
    pub derivation_index: Option<u32>,  // ← YENİ: None = root address
}
```

### 5.3 Transaction Request'e source_address Ekle

**Dosya:** `crates/api/src/routes/transactions.rs`

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTransactionRequest {
    pub recipient: String,
    pub amount_sats: u64,
    pub source_address: Option<String>,  // ← YENİ: Hangi adresten gönderilecek
    pub metadata: Option<String>,
}
```

### 5.4 Signing Flow Değişikliği

**Dosya:** `crates/protocols/src/cggmp24/signing_fast.rs`

```rust
/// Sign with optional HD derivation tweak
pub async fn sign_message_with_derivation(
    party_index: u16,
    parties: &[u16],
    session_id: &str,
    message_hash: &[u8; 32],
    key_share_data: &[u8],
    aux_info_data: &[u8],
    derivation_index: Option<u32>,
    root_pubkey: Option<&[u8]>,
    // ... other params
) -> SigningResult {
    // Apply tweak if derived address
    let adjusted_key_share = match (derivation_index, root_pubkey) {
        (Some(index), Some(pubkey)) => {
            let tweak = common::bitcoin_utils::calculate_signing_tweak(pubkey, index)?;
            adjust_key_share(key_share_data, &tweak)?
        }
        _ => key_share_data.to_vec(),
    };

    // Continue with normal signing
    sign_message_fast(
        party_index, parties, session_id, message_hash,
        &adjusted_key_share,  // Tweaked share
        aux_info_data,
        // ...
    ).await
}

/// Key share'e tweak ekle
fn adjust_key_share(key_share_data: &[u8], tweak: &[u8; 32]) -> Result<Vec<u8>> {
    // Deserialize
    let mut key_share: cggmp24::KeyShare<...> = bincode::deserialize(key_share_data)?;

    // Add tweak to secret share
    use generic_ec::{Scalar, curves::Secp256k1};
    let tweak_scalar = Scalar::<Secp256k1>::from_be_bytes(tweak)?;
    key_share.secret_share = key_share.secret_share + tweak_scalar;

    // Serialize back
    Ok(bincode::serialize(&key_share)?)
}
```

### 5.5 Full Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER: "Send 0.01 BTC from tb1q111... (index=0) to tb1qxyz..."      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND: POST /api/v1/transactions                                │
│  {                                                                  │
│    "recipient": "tb1qxyz...",                                       │
│    "amount_sats": 1000000,                                          │
│    "source_address": "tb1q111..."  ← Derived address                │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND (create_transaction):                                      │
│  1. SELECT derivation_index FROM user_addresses                     │
│     WHERE address = 'tb1q111...'  → index = 0                       │
│  2. Create transaction with derivation_index = 0                    │
│  3. Start voting (4/5 threshold)                                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  VOTING COMPLETE → Threshold reached                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SIGNING COORDINATOR:                                               │
│  Broadcast SigningRequest {                                         │
│    tx_id, message_hash, presig_id,                                  │
│    derivation_index: Some(0)  ← Bu önemli!                          │
│  } to all 5 nodes                                                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │  NODE 1   │   │  NODE 2   │   │  NODE 3   │  ...
            │           │   │           │   │           │
            │ 1. tweak  │   │ 1. tweak  │   │ 1. tweak  │
            │    = f(0) │   │    = f(0) │   │    = f(0) │
            │           │   │           │   │           │
            │ 2. adj_   │   │ 2. adj_   │   │ 2. adj_   │
            │    share  │   │    share  │   │    share  │
            │  = share  │   │  = share  │   │  = share  │
            │  + tweak  │   │  + tweak  │   │  + tweak  │
            │           │   │           │   │           │
            │ 3. sign   │   │ 3. sign   │   │ 3. sign   │
            │    with   │   │    with   │   │    with   │
            │  adj_     │   │  adj_     │   │  adj_     │
            │  share    │   │  share    │   │  share    │
            └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
                  │               │               │
                  └───────────────┼───────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  COORDINATOR: Combine 4 partial signatures                          │
│  → Final signature valid for tb1q111... (derived address)           │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Broadcast to Bitcoin network ✅                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## BÖLÜM 6: FRONTEND

### `src/hooks/useAddresses.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';

export function useUserAddresses(userId: string) {
  return useQuery({
    queryKey: ['addresses', userId],
    queryFn: async () => {
      const { data } = await api.get(`/addresses/user/${userId}`);
      return data;
    },
    enabled: !!userId,
  });
}

export function useDeriveAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: { userId: string; label?: string }) => {
      const { data } = await api.post('/addresses/derive', req);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['addresses', variables.userId] });
    },
  });
}
```

### `src/pages/user/Receive.tsx` - Güncellenmiş

```tsx
export function ReceivePage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useUserAddresses(user?.id || '');
  const deriveAddress = useDeriveAddress();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const addresses = data?.addresses || [];
  const selectedAddress = addresses[selectedIndex];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Receive Bitcoin</h1>
        <Button onClick={() => deriveAddress.mutate({ userId: user.id })}>
          + New Address
        </Button>
      </div>

      {/* QR Code */}
      {selectedAddress && (
        <Card className="text-center">
          <QRCodeSVG value={`bitcoin:${selectedAddress.address}`} size={200} />
          <p className="font-mono mt-4">{selectedAddress.address}</p>
          <Badge>Index #{selectedAddress.derivation_index}</Badge>
        </Card>
      )}

      {/* Address List */}
      <Card>
        <h3>My Addresses ({addresses.length})</h3>
        {addresses.map((addr, i) => (
          <div
            key={addr.address}
            onClick={() => setSelectedIndex(i)}
            className={i === selectedIndex ? 'border-primary-500' : ''}
          >
            {addr.address.slice(0, 12)}...{addr.address.slice(-8)}
            <Badge>#{addr.derivation_index}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
```

---

## BÖLÜM 7: TEST SENARYOLARI

```bash
# 1. Address derivation
curl -X POST localhost:8081/api/v1/addresses/derive \
  -d '{"user_id": "user1"}' -H "Content-Type: application/json"
# → {"address": "tb1q...", "derivation_index": 0}

# 2. User2 derives
curl -X POST localhost:8081/api/v1/addresses/derive \
  -d '{"user_id": "user2"}' -H "Content-Type: application/json"
# → {"address": "tb1q...", "derivation_index": 1}

# 3. List user1 addresses
curl localhost:8081/api/v1/addresses/user/user1
# → {"addresses": [...], "total_count": 1}

# 4. Send from derived address
curl -X POST localhost:8081/api/v1/transactions \
  -d '{"recipient":"tb1qxyz...","amount_sats":10000,"source_address":"tb1q..."}' \
  -H "Content-Type: application/json"
```

---

## BÖLÜM 8: TRANSACTION FLOW ANALİZİ

### 8.1 Mevcut Transaction Flow

Aşağıdaki akış incelendi ve HD address için değişiklik noktaları belirlendi:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 1. CREATE TRANSACTION                                                       │
│    Dosya: crates/api/src/handlers/transactions.rs                          │
│    Fonksiyon: create_transaction()                                          │
│                                                                            │
│    - Bitcoin fee estimate al                                                │
│    - Demo UTXO oluştur (production'da gerçek UTXO kullanılacak)            │
│    - TransactionBuilder ile unsigned tx oluştur                            │
│    - Transaction kaydını DB'ye yaz (state: Pending)                        │
│    ⚠️ DEĞİŞİKLİK: source_address parametresi eklenmeli                     │
│    ⚠️ DEĞİŞİKLİK: derivation_index DB'de saklanmalı                        │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 2. VOTING PROCESS                                                           │
│    Dosya: crates/orchestrator/src/service.rs                               │
│    Fonksiyon: process_pending_transactions()                                │
│                                                                            │
│    - Pending → Voting state geçişi                                          │
│    - VotingRound oluştur                                                    │
│    - Tüm node'lardan oy topla (4-of-5 threshold)                           │
│    - Votes collected → ThresholdReached / Approved                          │
│    ✅ DEĞİŞİKLİK GEREKMİYOR (derivation_index voting'i etkilemez)          │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 3. SIGNING INITIATION                                                       │
│    Dosya: crates/orchestrator/src/service.rs                               │
│    Fonksiyon: transition_approved_to_signing()                              │
│                                                                            │
│    - Approved → Signing state geçişi                                        │
│    - protocol_router.route(&tx.recipient) ile protokol seç                  │
│    - signing_coordinator.sign_transaction() çağır                           │
│    ⚠️ DEĞİŞİKLİK: derivation_index'i signing_coordinator'a geçir           │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 4. SIGNING COORDINATOR                                                      │
│    Dosya: crates/orchestrator/src/signing_coordinator.rs                   │
│    Fonksiyon: sign_transaction()                                            │
│                                                                            │
│    - Presignature al (CGGMP24 için)                                         │
│    - Message hash hesapla                                                   │
│    - SigningRequest oluştur ve broadcast et                                 │
│    - SignatureShare'leri topla (threshold kadar)                            │
│    - Share'leri birleştir → Final signature                                 │
│    ⚠️ DEĞİŞİKLİK: SigningRequest'e derivation_index ekle                   │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 5. NODE SIGNING (Her node'da)                                               │
│    Dosya: crates/protocols/src/cggmp24/signing_fast.rs                     │
│    Fonksiyon: sign_message_fast()                                           │
│                                                                            │
│    - SigningRequest al (derivation_index içeriyor)                          │
│    - Key share'i yükle                                                      │
│    ⚠️ YENİ: derivation_index varsa tweak hesapla                           │
│    ⚠️ YENİ: adjusted_share = key_share + tweak                              │
│    - adjusted_share ile imzalama protokolünü çalıştır                       │
│    - Partial signature üret                                                 │
│    - SignatureShare olarak gönder                                           │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 6. SIGNATURE COMBINATION & VERIFICATION                                     │
│    Dosya: crates/orchestrator/src/signing_coordinator.rs                   │
│    Fonksiyon: combine_signature_shares()                                    │
│                                                                            │
│    - Threshold (4) share toplandı                                           │
│    - CGGMP24: Tüm share'ler aynı final signature üretmeli                  │
│    - Signature format doğrula (DER encoded ECDSA)                          │
│    ✅ DEĞİŞİKLİK GEREKMİYOR (tweak node'da uygulandı)                      │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 7. BROADCAST                                                                │
│    Dosya: crates/orchestrator/src/service.rs                               │
│    Fonksiyon: broadcast_transaction()                                       │
│                                                                            │
│    - Signed → Broadcasting state                                            │
│    - Bitcoin network'e gönder                                               │
│    - Confirmed → state güncelle                                             │
│    ✅ DEĞİŞİKLİK GEREKMİYOR                                                │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Transactions Tablosu Değişikliği

**Dosya:** `docker/init-db/01_schema.sql` - Ekleme yapılacak

```sql
-- Transactions tablosuna eklenecek kolonlar:
ALTER TABLE transactions ADD COLUMN source_address TEXT;
ALTER TABLE transactions ADD COLUMN derivation_index INTEGER;

-- Index for address lookup
CREATE INDEX idx_transactions_source_address ON transactions(source_address) WHERE source_address IS NOT NULL;
```

VEYA migration dosyası olarak:

**Dosya:** `docker/init-db/05_tx_source_address.sql` (YENİ)

```sql
-- Add source address tracking to transactions
-- This enables HD address signing by tracking which derived address is spending

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_address TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS derivation_index INTEGER;

CREATE INDEX IF NOT EXISTS idx_transactions_source_address
    ON transactions(source_address) WHERE source_address IS NOT NULL;

COMMENT ON COLUMN transactions.source_address IS 'Source address for spending (derived HD address)';
COMMENT ON COLUMN transactions.derivation_index IS 'HD derivation index for signing tweak calculation';
```

### 8.3 Service.rs Değişikliği

**Dosya:** `crates/orchestrator/src/service.rs`

```rust
// transition_approved_to_signing() fonksiyonunda değişiklik:

async fn transition_approved_to_signing(&self, tx: &Transaction) -> Result<()> {
    // ... mevcut kod ...

    // YENİ: Derivation index'i al (eğer derived address ise)
    let derivation_index = tx.derivation_index; // Transaction struct'ta olmalı

    // Step 3: Initiate MPC signing via SigningCoordinator
    let combined_signature = match self.signing_coordinator
        .sign_transaction_with_derivation(  // ← YENİ METHOD
            &tx.txid,
            &tx.unsigned_tx,
            protocol_selection.protocol,
            derivation_index,  // ← YENİ PARAMETRE
        )
        .await
    // ... devamı aynı ...
}
```

### 8.4 SigningCoordinator Tam Değişiklik

**Dosya:** `crates/orchestrator/src/signing_coordinator.rs`

```rust
// SigningRequest struct'ına ekleme:
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SigningRequest {
    pub tx_id: TxId,
    pub unsigned_tx: Vec<u8>,
    pub message_hash: Vec<u8>,
    pub presignature_id: Option<PresignatureId>,
    pub protocol: SignatureProtocol,
    pub session_id: Uuid,
    pub derivation_index: Option<u32>,  // ← YENİ: None = root, Some(n) = derived
    pub root_public_key: Option<Vec<u8>>, // ← YENİ: Tweak hesaplama için
}

// Yeni method:
pub async fn sign_transaction_with_derivation(
    &self,
    tx_id: &TxId,
    unsigned_tx: &[u8],
    protocol: SignatureProtocol,
    derivation_index: Option<u32>,
) -> Result<CombinedSignature> {
    let start = Instant::now();
    info!(
        "Starting {} signing for tx_id={}, derivation_index={:?}",
        protocol, tx_id, derivation_index
    );

    // Get root public key if signing from derived address
    let root_public_key = if derivation_index.is_some() {
        // Query from completed DKG
        match self.get_root_public_key().await {
            Ok(pk) => Some(pk),
            Err(e) => {
                error!("Failed to get root public key for derived signing: {}", e);
                return Err(OrchestrationError::Internal(
                    "Root public key not available for derived address signing".into()
                ));
            }
        }
    } else {
        None
    };

    // Create signing session
    let session_id = Uuid::new_v4();

    // ... presignature acquisition (aynı) ...

    // Broadcast signing request with derivation info
    let request = SigningRequest {
        tx_id: tx_id.clone(),
        unsigned_tx: unsigned_tx.to_vec(),
        message_hash: message_hash.clone(),
        presignature_id: presignature_id.clone(),
        protocol,
        session_id,
        derivation_index,  // ← YENİ
        root_public_key,   // ← YENİ
    };

    // ... devamı aynı ...
}

// Helper method:
async fn get_root_public_key(&self) -> Result<Vec<u8>> {
    // Query from etcd or postgres for completed DKG public key
    let key = "/mpc/dkg/root_public_key";
    match self.etcd.get(key).await {
        Ok(Some(pk)) => Ok(pk),
        Ok(None) => Err(OrchestrationError::Internal("No root public key found".into())),
        Err(e) => Err(OrchestrationError::Storage(e.into())),
    }
}
```

---

## BÖLÜM 9: NODE SIGNING DEĞİŞİKLİĞİ (KRİTİK)

### 9.1 Internal Signing Handler

**Dosya:** `crates/api/src/handlers/internal.rs` (mevcut dosyaya ekleme)

```rust
/// Handle signing request from coordinator
/// Bu handler her node'da çalışır ve signing request'i alır
pub async fn handle_signing_request(
    State(state): State<AppState>,
    Json(request): Json<SigningRequest>,
) -> ApiResult<Json<SignatureShare>> {
    info!(
        "Received signing request: session={}, derivation_index={:?}",
        request.session_id, request.derivation_index
    );

    // 1. Load key share from storage
    let key_share_data = state.load_key_share().await?;

    // 2. Load aux info
    let aux_info_data = state.load_aux_info().await?;

    // 3. Calculate tweak if derived address
    let adjusted_key_share = match (&request.derivation_index, &request.root_public_key) {
        (Some(index), Some(root_pk)) => {
            info!("Applying HD derivation tweak for index {}", index);

            // Calculate signing tweak
            let tweak = common::bitcoin_utils::calculate_signing_tweak(root_pk, *index)
                .map_err(|e| ApiError::InternalError(format!("Tweak calculation failed: {}", e)))?;

            // Adjust key share
            adjust_key_share(&key_share_data, &tweak)
                .map_err(|e| ApiError::InternalError(format!("Key share adjustment failed: {}", e)))?
        }
        _ => {
            // Root address - use original key share
            key_share_data.clone()
        }
    };

    // 4. Execute signing protocol with adjusted share
    let partial_signature = match request.protocol {
        SignatureProtocol::CGGMP24 => {
            cggmp24_sign(
                &adjusted_key_share,
                &aux_info_data,
                &request.message_hash,
                request.presignature_id.as_ref(),
            ).await?
        }
        SignatureProtocol::FROST => {
            frost_sign(
                &adjusted_key_share,
                &request.message_hash,
            ).await?
        }
    };

    Ok(Json(SignatureShare {
        tx_id: request.tx_id,
        node_id: state.node_id,
        partial_signature,
        presignature_id: request.presignature_id,
        session_id: request.session_id,
    }))
}

/// Adjust key share by adding tweak
fn adjust_key_share(key_share_data: &[u8], tweak: &[u8; 32]) -> Result<Vec<u8>, String> {
    use generic_ec::{Scalar, curves::Secp256k1};

    // Deserialize key share
    let mut key_share: cggmp24::KeyShare<Secp256k1> = bincode::deserialize(key_share_data)
        .map_err(|e| format!("Deserialize error: {}", e))?;

    // Convert tweak to scalar
    let tweak_scalar = Scalar::<Secp256k1>::from_be_bytes(tweak)
        .ok_or("Invalid tweak scalar")?;

    // Add tweak to secret share: adjusted = original + tweak
    key_share.x = key_share.x + tweak_scalar;

    // Serialize back
    bincode::serialize(&key_share)
        .map_err(|e| format!("Serialize error: {}", e))
}
```

### 9.2 Internal Routes Güncelleme

**Dosya:** `crates/api/src/routes/internal.rs`

```rust
pub fn router() -> Router<AppState> {
    Router::new()
        // Mevcut routes...
        .route("/signing-join", post(handlers::internal::handle_signing_join))
        .route("/signing-request", post(handlers::internal::handle_signing_request)) // ← YENİ
}
```

---

## BÖLÜM 10: UYGULAMA CHECKLIST (GÜNCEL)

### Database & Migration
- [x] `04_user_addresses.sql` - Users ve addresses tabloları
- [x] `docker-compose.yml` - Mount eklendi
- [ ] `05_tx_source_address.sql` - Transaction tablosu değişikliği

### Storage Layer (crates/storage/src/postgres.rs)
- [ ] `get_user()` - User lookup
- [ ] `list_users()` - User listesi
- [ ] `get_next_derivation_index()` - Atomic index
- [ ] `create_user_address()` - Address kaydetme
- [ ] `get_user_addresses()` - User adresleri
- [ ] `get_address_derivation_index()` - Address'ten index bulma

### Common Utils (crates/common/src/bitcoin_utils.rs)
- [ ] `calculate_signing_tweak()` - HD tweak hesaplama
- [ ] `scalar_add()` - Scalar toplama
- [ ] `point_add_scalar()` güncelleme (varsa kontrol et)

### API Layer
- [ ] `handlers/address.rs` - Yeni dosya
- [ ] `routes/address.rs` - Yeni dosya
- [ ] `routes/mod.rs` - Address router ekleme
- [ ] `handlers/transactions.rs` - source_address desteği

### Orchestrator
- [ ] `signing_coordinator.rs` - SigningRequest güncelleme
- [ ] `signing_coordinator.rs` - `sign_transaction_with_derivation()` method
- [ ] `service.rs` - derivation_index geçirme

### Node Signing
- [ ] `handlers/internal.rs` - `handle_signing_request()` handler
- [ ] `handlers/internal.rs` - `adjust_key_share()` fonksiyonu
- [ ] `routes/internal.rs` - Route ekleme

### Types (crates/types/src/lib.rs)
- [ ] `Transaction` struct - `source_address`, `derivation_index` alanları
- [ ] `User` struct
- [ ] `UserAddress` struct

### Frontend
- [ ] `src/hooks/useAddresses.ts`
- [ ] `src/pages/user/Receive.tsx` - Address listesi ve QR
- [ ] `src/pages/user/Send.tsx` - Source address seçimi
- [ ] `src/api/endpoints/addresses.ts`

---

## SONUÇ

Bu plan **tam implementasyon** içeriyor:
- ✅ Veritabanı şeması + migration
- ✅ Storage layer metodları (tam SQL)
- ✅ API handlers (tam Rust kodu)
- ✅ Signing tweak hesaplama (tam matematik)
- ✅ Key share adjustment (tam kod)
- ✅ Transaction flow analizi (tüm değişiklik noktaları)
- ✅ Node signing handler (tweak uygulama)
- ✅ Frontend hooks ve components
- ✅ Full signing flow diagram

**Değişiklik Özeti:**
1. **Transaction Creation**: `source_address` ve `derivation_index` ekleniyor
2. **Voting**: Değişiklik yok
3. **Signing Coordinator**: `derivation_index` ve `root_public_key` SigningRequest'e ekleniyor
4. **Node Signing**: Her node `derivation_index` varsa tweak hesaplayıp key share'e ekliyor
5. **Signature Combination**: Değişiklik yok (tweak zaten uygulandı)
6. **Broadcast**: Değişiklik yok
