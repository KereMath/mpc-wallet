# 🔴 MPC-WALLET - Aktif Sorunlar

**Tarih**: 2026-01-29
**Son Test**: 2026-01-29 14:20
**Durum**: 🔴 **1 KRİTİK SORUN - CONCURRENT SESSIONS**

---

## 🚨 SORUN: Presignature Generation - Concurrent Sessions Causing Message Collision

### 📝 Durum

**Fix #1, #2, #3, #4, #5 BAŞARILI ✅**
- Threshold party count ✅
- Party index conversion ✅
- Session broadcast ✅
- Protocol instance creation ✅
- Semaphore sequential processing ✅
- **Etcd lock-based leader election ✅**

**AMA Yeni Sorun Keşfedildi: Concurrent Sessions! ❌**

### Test Sonuçları (14:20)

**Fix #5 Çalışıyor:**
```
Node-1: Acquired lock at 14:11:59 ✅
Node-2: Acquired lock at 14:06:57 ✅
Node-3: Acquired lock at 14:01:55 ✅
Node-4: Acquired lock at 14:01:53 ✅
Node-5: Acquired lock at 14:06:57 ✅

Sadece 1 node aynı anda generate ediyor ✅
Diğer 4 node "already locked" alıp bekliyor ✅
```

**Ama:**
```
Node-2 received 8 presig join requests at 14:06:57:
- session 3ac80dab...
- session 7300d276...
- session 5d2e7eff...
- session 59111293...
- session dff5b5d7...
- session d8b894ee...
- session 0765576d...
- session 3257e34b...

ERROR: AttemptToOverwriteReceivedMsg { msgs_ids: [2, 3], sender: 1 }
```

### Kök Sebep

**Concurrent Presignature Sessions:**

```rust
// presig_service.rs - generate_batch_impl()
for i in 0..actual_count {  // Line 375
    let session_id = PresignatureId::new();

    // Register session
    message_router.register_session(...).await;

    // Broadcast join request to participants
    broadcast_presig_join_request(...).await;  // Line 426

    // Generate presignature (async spawned)
    generate_presignature(...).await;
}
```

**Sorun**:
- Loop içinde 20 presignature için 20 AYRI session oluşturuluyor
- Her session için AYRI broadcast join request gidiyor
- Participant node'lar 20 task spawn ediyor (tokio::spawn)
- Semaphore serialize ediyor (1 at a time) ✅
- AMA: **QUIC mesajları 20 farklı session'dan overlapping geliyor!**
- Protocol aynı sender'dan duplicate mesaj alıyor
- **"AttemptToOverwriteReceivedMsg"** error!

### Sonuç

- 1 node generate batch(20) çağırıyor
- 20 session oluşturuluyor
- Her session için 3 participant'a join request
- 3 × 20 = 60 join request broadcast
- Participant node'lar 20 paralel task spawn ediyor
- Semaphore sırayla işliyor AMA
- **QUIC messages colliding between sessions!**

---

## ✅ FİX: Sequential Presignature Generation

### Strateji

**Parallel yerine Sequential:**
- Her presignature generate ettikten sonra bir sonrakine geç
- AWAIT protocol completion BEFORE starting next session
- Session cleanup BEFORE creating new session
- Deterministik ve güvenilir ✅

### Değişiklik

`generate_batch_impl()` içinde:
1. ❌ Parallel loop ile 20 session oluşturmayı KALDIR
2. ✅ Sequential loop - her presignature AWAIT completion
3. ✅ Session cleanup BEFORE next iteration
4. ✅ Single session active at a time per batch

### Kod Değişikliği

```rust
// ÖNCESİ (BOZUK - PARALLEL):
for i in 0..actual_count {
    let session_id = PresignatureId::new();

    // Register + broadcast (no await for completion)
    message_router.register_session(...).await;
    broadcast_presig_join_request(...).await;

    // Generate (spawned async - doesn't wait!)
    let result = generate_presignature(...).await;  // Just spawns!
}

// SONRASI (DÜZELTİLMİŞ - SEQUENTIAL):
for i in 0..actual_count {
    let session_id = PresignatureId::new();

    // Register + broadcast
    message_router.register_session(...).await;
    broadcast_presig_join_request(...).await;

    // Generate and WAIT for completion
    let result = generate_presignature(...).await;  // BLOCK until done!

    // Cleanup session BEFORE next iteration
    message_router.unregister_session(session_id).await;

    // Small delay to ensure cleanup
    tokio::time::sleep(Duration::from_millis(100)).await;
}
```

### Beklenen Sonuç

- ✅ Sadece 1 presignature session aynı anda active
- ✅ Session complete olana kadar yeni session başlamaz
- ✅ QUIC messages collision olmaz
- ✅ No duplicate message error
- ✅ Presignature generation tamamlanacak

---

## 📝 Özet

**Uygulanan Fix'ler**:
1. ✅ Fix #1: Threshold party count
2. ✅ Fix #2: Party index conversion
3. ✅ Fix #3: Session broadcast
4. ✅ Fix #4: Protocol instance + semaphore
5. ✅ Fix #5: Etcd lock-based leader election
6. 🔄 **Fix #6**: Sequential presignature generation (UYGULANACAK)

**Son Güncelleme**: 2026-01-29 14:20
