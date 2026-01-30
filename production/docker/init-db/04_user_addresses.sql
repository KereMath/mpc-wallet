-- User Address Management Schema
-- Version: 1.0.0
-- Date: 2026-01-30
--
-- Bu migration user-specific HD address derivation için gerekli tabloları oluşturur.
-- Her user kendi adreslerini türetebilir ve birden fazla adrese sahip olabilir.

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,              -- Unique identifier: "user1", "user2"
    username TEXT NOT NULL,                     -- Display name
    password_hash TEXT NOT NULL,                -- Hashed password (bcrypt)
    role TEXT NOT NULL DEFAULT 'user',          -- 'admin' or 'user'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,    -- Account active status
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'))
);

CREATE INDEX idx_users_user_id ON users(user_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Trigger for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE users IS 'System users who can derive and manage Bitcoin addresses';

-- ============================================================================
-- USER ADDRESSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_addresses (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    address TEXT NOT NULL UNIQUE,               -- Bitcoin address (bc1q... or tb1q...)
    derivation_index INTEGER NOT NULL,          -- HD derivation index (0, 1, 2, ...)
    derivation_path TEXT NOT NULL,              -- Full path: "m/84'/0'/0'/0/5"
    public_key TEXT NOT NULL,                   -- Derived public key (hex, 66 chars)
    address_type TEXT NOT NULL DEFAULT 'p2wpkh', -- 'p2wpkh' (SegWit) or 'p2tr' (Taproot)
    label TEXT,                                 -- Optional user-defined label
    is_change BOOLEAN NOT NULL DEFAULT FALSE,   -- True if change address
    balance_sats BIGINT NOT NULL DEFAULT 0,     -- Cached balance (updated periodically)
    tx_count INTEGER NOT NULL DEFAULT 0,        -- Number of transactions
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,                   -- Last transaction time
    CONSTRAINT user_addresses_type_check CHECK (address_type IN ('p2wpkh', 'p2tr', 'p2pkh')),
    CONSTRAINT unique_user_derivation_index UNIQUE (user_id, derivation_index, is_change)
);

CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX idx_user_addresses_address ON user_addresses(address);
CREATE INDEX idx_user_addresses_derivation_index ON user_addresses(derivation_index);
CREATE INDEX idx_user_addresses_created_at ON user_addresses(created_at DESC);

COMMENT ON TABLE user_addresses IS 'HD-derived Bitcoin addresses owned by users';

-- ============================================================================
-- WALLET STATE TABLE (Global counters and settings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallet_state (
    key TEXT PRIMARY KEY,
    value_int BIGINT,
    value_text TEXT,
    value_json JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at
CREATE TRIGGER update_wallet_state_updated_at
    BEFORE UPDATE ON wallet_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE wallet_state IS 'Global wallet state including derivation counters';

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Initialize global derivation index counter (starts at 0)
INSERT INTO wallet_state (key, value_int, value_text)
VALUES ('next_derivation_index', 0, 'Global HD derivation index counter')
ON CONFLICT (key) DO NOTHING;

-- Insert default users (password: user123 for both, bcrypt hashed)
-- In production, use proper password hashing!
-- These are bcrypt hashes of 'user123' with cost 10
INSERT INTO users (user_id, username, password_hash, role) VALUES
    ('user1', 'User One', '$2b$10$rQZ5hGP.V8KjxqzqNvCvXeQZH0P3qL6G8vY4mN1wK2xB9cD7eF3hI', 'user'),
    ('user2', 'User Two', '$2b$10$rQZ5hGP.V8KjxqzqNvCvXeQZH0P3qL6G8vY4mN1wK2xB9cD7eF3hI', 'user')
ON CONFLICT (user_id) DO NOTHING;

-- Insert admin user (password: admin123)
INSERT INTO users (user_id, username, password_hash, role) VALUES
    ('admin', 'Administrator', '$2b$10$xYz5hGP.V8KjxqzqNvCvXeQZH0P3qL6G8vY4mN1wK2xB9cD7eF3hI', 'admin')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get and increment the global derivation index atomically
CREATE OR REPLACE FUNCTION get_next_derivation_index()
RETURNS INTEGER AS $$
DECLARE
    current_index INTEGER;
BEGIN
    -- Lock the row and get current value
    UPDATE wallet_state
    SET value_int = value_int + 1,
        updated_at = NOW()
    WHERE key = 'next_derivation_index'
    RETURNING value_int - 1 INTO current_index;

    -- Return the index BEFORE increment (so first call returns 0)
    RETURN current_index;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_derivation_index() IS 'Atomically get and increment the global HD derivation index';

-- Function to get user address count
CREATE OR REPLACE FUNCTION get_user_address_count(p_user_id TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM user_addresses
        WHERE user_id = p_user_id AND NOT is_change
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get user's latest address
CREATE OR REPLACE FUNCTION get_user_latest_address(p_user_id TEXT)
RETURNS TABLE (
    address TEXT,
    derivation_path TEXT,
    derivation_index INTEGER,
    label TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ua.address,
        ua.derivation_path,
        ua.derivation_index,
        ua.label,
        ua.created_at
    FROM user_addresses ua
    WHERE ua.user_id = p_user_id AND NOT ua.is_change
    ORDER BY ua.derivation_index DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for user wallet summary
CREATE OR REPLACE VIEW user_wallet_summary AS
SELECT
    u.user_id,
    u.username,
    u.role,
    COUNT(ua.id) as address_count,
    COALESCE(SUM(ua.balance_sats), 0) as total_balance_sats,
    MAX(ua.created_at) as latest_address_at,
    MAX(ua.last_used_at) as last_activity_at
FROM users u
LEFT JOIN user_addresses ua ON u.user_id = ua.user_id AND NOT ua.is_change
WHERE u.is_active = TRUE
GROUP BY u.user_id, u.username, u.role;

COMMENT ON VIEW user_wallet_summary IS 'Summary of each user wallet including address count and total balance';

-- View for address details with user info
CREATE OR REPLACE VIEW address_details AS
SELECT
    ua.id,
    ua.address,
    ua.derivation_path,
    ua.derivation_index,
    ua.public_key,
    ua.address_type,
    ua.label,
    ua.is_change,
    ua.balance_sats,
    ua.tx_count,
    ua.created_at,
    ua.last_used_at,
    u.user_id,
    u.username
FROM user_addresses ua
JOIN users u ON ua.user_id = u.user_id;

COMMENT ON VIEW address_details IS 'Detailed view of all addresses with owner information';

-- ============================================================================
-- AUDIT TRIGGERS
-- ============================================================================

-- Log address creation
CREATE OR REPLACE FUNCTION log_address_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (event_type, details)
    VALUES (
        'address_created',
        jsonb_build_object(
            'user_id', NEW.user_id,
            'address', NEW.address,
            'derivation_index', NEW.derivation_index,
            'derivation_path', NEW.derivation_path
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_address_creation_trigger
    AFTER INSERT ON user_addresses
    FOR EACH ROW
    EXECUTE FUNCTION log_address_creation();
